/**
 * Bhumi-Niti land-intelligence agent — POST /api/ai.
 *
 * The Ask Bhumi prompt layer (src/components/home/MapFirstHome.tsx) posts the
 * user's text here — typed, or spoken via the browser's SpeechRecognition
 * STT. We run an OpenRouter (OpenAI-compatible) chat with a small tool loop,
 * following the voice-agejt reference project but feeding tool results back
 * to the model so it stays a real agent loop:
 *
 *   show_area     → map navigation action returned to the client, which flies
 *                   its map to the place and loads the plots around it
 *   submit_answer → the structured answer card, schema-validated with zod
 *
 * Future tools (e.g. dummy land-policy lookup) plug in by adding one entry to
 * TOOLS plus one branch in runAgentLoop below.
 *
 * The OPENROUTER_API_KEY is read from server env only — the `env` binding on
 * deployed edge runtimes, or process.env populated from .env by vite.config.ts
 * during `vite dev`/`vite build`. It is never referenced from client code.
 * Runtime: fetch + zod only (no Node APIs), safe on any runtime.
 */

import { z } from "zod";
import { detectLanguage, type LanguageCode, type LanguageInfo } from "@/copilot/language";
import { RawPlanSchema, validatePlan, type QueryPlan, type RawPlan, type ValidationNote } from "@/copilot/plan";
import { chipsFor, followupsFor, mapActionsFor } from "@/copilot/actions";
import { evidenceFor, executePlan, type DataResult } from "./copilot-data";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_TOOL_ROUNDS = 3;
const MAX_TOKENS = 1600;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

interface ToolCall {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface AssistantMessage {
  content?: string | null;
  tool_calls?: ToolCall[];
}

// ---------------------------------------------------------------------------
// Tool declarations (OpenAI function-calling format)
// ---------------------------------------------------------------------------

const SHOW_AREA_TOOL = {
  name: "show_area",
  description:
    "Fly the user's map to a place in India and load the land plots/parcels around it. " +
    "Call this whenever the user asks to see, show, open, explore, go to, zoom to, find, or " +
    "locate a place or its plots — e.g. 'show me the plots in Mira Road'. Call it BEFORE " +
    "submit_answer so the map moves while you write the answer.",
  parameters: {
    type: "object",
    properties: {
      place: {
        type: "string",
        description: "Place name as the user said it, e.g. 'Mira Road'.",
      },
      lat: {
        type: "number",
        description: "Approximate latitude of the place centre (WGS84). Include it if you know it.",
      },
      lon: {
        type: "number",
        description:
          "Approximate longitude of the place centre (WGS84). Include it if you know it.",
      },
      zoom: {
        type: "number",
        description: "Map zoom level 8-17: 13-14 for a neighbourhood, 11-12 for a city.",
      },
      reason: {
        type: "string",
        description: "One short clause on why you are navigating there.",
      },
    },
    required: ["place"],
  },
} as const;

const SUBMIT_ANSWER_TOOL = {
  name: "submit_answer",
  description:
    "Submit your final answer to the user. ALWAYS call this exactly once per turn, after any " +
    "show_area call. Never reply with plain text outside a tool call.",
  parameters: {
    type: "object",
    properties: {
      spoken: {
        type: "string",
        description:
          "1-3 short conversational sentences that will be read aloud to the user. " +
          "Plain text only — no markdown, no emoji, no lists.",
      },
      summary: {
        type: "string",
        description: "Headline finding shown in the answer card, 1-3 sentences.",
      },
      framework: {
        type: "array",
        items: { type: "string" },
        description:
          "0-5 regulatory points, each exactly 'Label: detail' " +
          "(e.g. 'Zoning & Land Use: ...', 'Dispute & Record Status: ...'). " +
          "Include ONLY when specific regulations apply to this query; otherwise [] — never pad with filler.",
      },
      riskAssessment: {
        type: "string",
        description:
          "Risk verdict in 1-2 sentences beginning with Low, Moderate, or High. " +
          "Include ONLY when the question concerns land, legal, environmental or financial risk; " +
          'otherwise "" — do not invent a risk for greetings or how-to questions.',
      },
      evidence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            type: { type: "string" },
          },
          required: ["label", "type"],
        },
        description: "1-5 real sources you actually relied on; [] if none apply.",
      },
      limitation: {
        type: "string",
        description: 'One sentence data caveat — only when a real caveat applies, otherwise "".',
      },
      evidenceBreakdown: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            detail: { type: "string" },
          },
          required: ["section", "detail"],
        },
        description:
          "For substantive land answers, break the claim down into evidence classes, " +
          'each as {"section","detail"} with section EXACTLY one of: OBSERVED ' +
          "(what platform data / imagery actually shows), DERIVED (computed from " +
          'those inputs), LEGAL EVIDENCE (official record: 7/12, Bhulekh, orders), ' +
          "INTERPRETATION (your reading of it), LIMITATIONS (what this cannot prove), " +
          "SOURCES (where to verify officially). Include only sections that apply; " +
          "[] for greetings or capability questions. Never invent sources.",
      },
      suggestedFollowups: {
        type: "array",
        items: { type: "string" },
        description: "2-3 concrete questions the user could ask next.",
      },
    },
    required: ["spoken", "summary", "suggestedFollowups"],
  },
} as const;

// Step 1 of the NL-GIS pipeline: turn the question into a structured plan (never an answer)
const PLAN_QUERY_TOOL = {
  name: "plan_query",
  description:
    "Convert the user's land question (any Indian language) into a structured query plan. " +
    "Do not answer the question. Normalise place names to English.",
  parameters: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: [
          "land_use_change",
          "land_use_summary",
          "parcel_lookup",
          "conversion_eligibility",
          "dispute_check",
          "climate_risk",
          "socio_economic",
          "compare_regions",
          "policy_research",
          "show_location",
          "general",
        ],
      },
      location: {
        type: "object",
        description: "Main place in the question, in English. Omit when none is named.",
        properties: {
          name: { type: "string" },
          district: { type: "string" },
          state: { type: "string", description: "Indian state the place is in, in English" },
          lat: { type: "number" },
          lon: { type: "number" },
        },
      },
      uses_map_context: {
        type: "boolean",
        description: "true when the user means the map selection or their own location: 'near me', 'here', 'this area/village/parcel', 'surrounding parcels'",
      },
      refers_to_previous: {
        type: "boolean",
        description: "true when the question refines or continues the previous analysis ('only agriculture to built-up', 'compare it with Nashik', 'what about 2020?')",
      },
      compare_with: {
        type: "object",
        description: "Second place when comparing",
        properties: { name: { type: "string" }, state: { type: "string" }, lat: { type: "number" }, lon: { type: "number" } },
      },
      from_year: { type: "integer" },
      to_year: { type: "integer" },
      from_class: { type: "string", enum: ["agriculture", "forest", "built_up", "water", "barren", "other"] },
      to_class: { type: "string", enum: ["agriculture", "forest", "built_up", "water", "barren", "other"] },
      operation: { type: "string", enum: ["summarise", "compare", "trend", "lookup", "explain"] },
      datasets: {
        type: "array",
        items: {
          type: "string",
          enum: ["land_records", "cadastral", "lulc", "satellite", "climate", "socio_economic", "registration", "disputes", "research_policy", "policy_library"],
        },
      },
      map_action: { type: "string", enum: ["zoom", "highlight_change", "show_layer", "highlight_parcels", "compare", "none"] },
      layer: { type: "string", enum: ["lulc", "climate_risk", "disputes", "parcels", "satellite"] },
      topic: {
        type: "string",
        description:
          "Short English search keywords: the Act/policy name, section or regulation numbers, and the subject (e.g. 'Maharashtra Land Revenue Code section 42 non-agricultural conversion permission')",
      },
    },
    required: ["intent", "uses_map_context", "refers_to_previous"],
  },
} as const;

const TOOLS = [
  { type: "function" as const, function: SHOW_AREA_TOOL },
  { type: "function" as const, function: SUBMIT_ANSWER_TOOL },
];
const PLAN_TOOLS = [{ type: "function" as const, function: PLAN_QUERY_TOOL }];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// Optional card sections arrive as null/undefined/"[]" when the query doesn't
// need them (greetings, how-to questions) — normalise to empty so the client
// can hide the matching UI blocks entirely.
const AnswerSchema = z.object({
  spoken: z.string().min(1),
  summary: z.string().min(1),
  framework: z
    .array(z.string().min(1))
    .max(8)
    .nullish()
    .transform((v) => v ?? []),
  riskAssessment: z
    .string()
    .max(600)
    .nullish()
    .transform((v) => (v ?? "").trim()),
  evidence: z
    .array(z.object({ label: z.string().min(1), type: z.string().min(1) }))
    .max(8)
    .nullish()
    .transform((v) => v ?? []),
  limitation: z
    .string()
    .max(400)
    .nullish()
    .transform((v) => (v ?? "").trim()),
  evidenceBreakdown: z
    .array(
      z.object({
        section: z.enum(["OBSERVED", "DERIVED", "LEGAL EVIDENCE", "INTERPRETATION", "LIMITATIONS", "SOURCES"]),
        detail: z.string().min(1).max(400),
      }),
    )
    .max(6)
    .nullish()
    .transform((v) => v ?? []),
  suggestedFollowups: z
    .array(z.string().min(1))
    .max(5)
    .nullish()
    .transform((v) => v ?? []),
});
type Answer = z.infer<typeof AnswerSchema>;

const ShowAreaArgsSchema = z.object({
  place: z.string().trim().min(1).max(160),
  lat: z.number().min(-90).max(90).nullish(),
  lon: z.number().min(-180).max(180).nullish(),
  zoom: z.number().min(8).max(17).nullish(),
  reason: z.string().max(240).nullish(),
});

const ContextSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  state: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  taluka: z.string().max(80).optional(),
  village: z.string().max(80).optional(),
  surveyNumber: z.string().max(60).nullish(),
  parcelId: z.string().max(80).nullish(),
  areaAcres: z.number().nullish(),
  landUse: z.string().max(80).optional(),
  source: z.string().max(120).optional(),
});
type MapContext = z.infer<typeof ContextSchema>;

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(30)
    .optional(),
  context: ContextSchema.nullish(),
  /** The previous turn's validated plan, for follow-ups ("compare it with Nashik") */
  previousPlan: z.record(z.string(), z.unknown()).nullish(),
  /** Language of the previous turn, used when a message is too short to detect */
  languageHint: z.string().max(5).nullish(),
});

export interface FlyToAction {
  type: "fly_to";
  place: string;
  lat: number | null;
  lon: number | null;
  zoom: number | null;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Env access (edge-safe: binding first, then Node process.env in dev)
// ---------------------------------------------------------------------------

function readEnv(env: unknown, name: string): string | null {
  if (typeof env === "object" && env !== null) {
    const bound = (env as Record<string, unknown>)[name];
    if (typeof bound === "string" && bound.trim()) return bound.trim();
  }
  if (typeof process !== "undefined") {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function systemPrompt(context: MapContext | null | undefined): string {
  const base = `You are Bhumi-Niti AI, the land-intelligence analyst inside the Bhumi-Niti map platform for India. You answer questions about land parcels, survey and mutation records, zoning and land use, NA (non-agricultural) conversion, revenue litigation, CRZ and environmental restrictions, flood and climate risk, satellite land-use change, and Indian land policies.

Every turn you work in this order:
1. If the user asks to see, show, open, go to, explore, find, zoom to, or locate a place — a city, ward, village, locality, area, or its plots — call show_area with that place name and its coordinates (if you know them) so the map flies there and loads the plots around it. Do NOT call show_area when the user is asking about the already-selected parcel ("here", "this plot", "this land") — the map is already there.
2. Finish every turn by calling submit_answer exactly once with the full answer. Never reply with plain text or markdown outside a tool call.

Answer rules:
- Ground claims in real Indian sources: MahaBhumi / Bhu-Naksha, Bhulekh and 7/12 extracts, District Collector and Tehsil offices, MLRC 1966, CRZ notifications, municipal development plans, IMD, Sentinel-2 imagery.
- Never invent survey numbers, file numbers, case details, or policy text. If you lack live data for something, say plainly what must be verified officially.
- spoken: 1-3 short conversational sentences that will be read aloud — plain text only, no markdown, no emoji, no lists.
- summary: the headline finding in 1-3 sentences (always required).
- Card sections are OPTIONAL — include ONLY what this particular question needs, and leave the rest empty. The UI hides empty sections:
  · framework: 0-5 items "Label: detail" — only when specific rules/regulations apply (zoning, NA conversion, CRZ, revenue procedure, dispute law). For greetings, capability questions, or general explanations use [].
  · riskAssessment: 1-2 sentences beginning Low, Moderate, or High — only when the user asks about risk (dispute, flood, environmental, conversion, encumbrance, financial). For greetings/how-to use "".
  · evidence: for substantive land answers cite 1-3 sources you actually relied on (7/12 & Bhulekh extracts, MahaBhumi/Bhu-Naksha, CRZ notification, IMD, District Collector orders); use [] only for greetings or capability questions.
  · limitation: only when a genuine data caveat applies — use "" otherwise.
  · evidenceBreakdown: for substantive land answers, split the claim into its evidence classes so the user can see what is proven versus inferred — sections OBSERVED (platform data / imagery), DERIVED (computed from those inputs), LEGAL EVIDENCE (official record), INTERPRETATION (your reading), LIMITATIONS (what it cannot prove), SOURCES (where to verify officially). Include only the sections that apply; [] for greetings/capability questions.
  Never pad these sections with generic filler to fill the card, but never drop a section the answer genuinely relies on either.
- suggestedFollowups: 2-3 concrete questions the user could ask next.`;

  if (!context) {
    return `${base}\n\nNo parcel is currently selected on the map; answer generally for India.`;
  }

  const place = [context.village, context.taluka, context.district, context.state]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `- Coordinates: ${context.lat.toFixed(5)}, ${context.lon.toFixed(5)}`,
    place ? `- Place: ${place}` : null,
    context.surveyNumber
      ? `- Survey No.: ${context.surveyNumber}`
      : context.parcelId
        ? `- Parcel ID: ${context.parcelId}`
        : null,
    `- Land use: ${context.landUse ?? "unknown"}${context.areaAcres != null ? ` · Area: ${context.areaAcres} ac` : ""}${context.source ? ` · Source: ${context.source}` : ""}`,
    'When the user says "here", "this plot", or "this land", they mean this selection.',
  ].filter((line): line is string => line !== null);

  return `${base}\n\nActive map selection (the user is looking at this right now):\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// OpenRouter call + agent loop
// ---------------------------------------------------------------------------

async function callOpenRouter(
  key: string,
  model: string,
  messages: ChatMessage[],
  toolChoice: unknown,
  referer: string,
  tools: readonly unknown[] = TOOLS,
): Promise<{ message: AssistantMessage; model: string }> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": "Bhumi-Niti",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: toolChoice,
      temperature: 0.4,
      max_tokens: MAX_TOKENS,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 200)}`);
  }
  const payload = (await res.json()) as {
    model?: unknown;
    choices?: Array<{ message?: AssistantMessage }>;
  };
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("OpenRouter returned no message");
  return {
    message,
    model: typeof payload.model === "string" && payload.model ? payload.model : model,
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Salvage a JSON object out of prose in case the model ignored tool calling. */
function extractAnswer(text: string): Answer | null {
  if (!text.trim()) return null;
  const direct = AnswerSchema.safeParse(safeJson(text));
  if (direct.success) return direct.data;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const nested = AnswerSchema.safeParse(safeJson(text.slice(start, end + 1)));
    if (nested.success) return nested.data;
  }
  return null;
}

function toFlyToAction(args: z.infer<typeof ShowAreaArgsSchema>): FlyToAction {
  return {
    type: "fly_to",
    place: args.place,
    lat: typeof args.lat === "number" ? args.lat : null,
    lon: typeof args.lon === "number" ? args.lon : null,
    zoom: typeof args.zoom === "number" ? args.zoom : null,
    reason: args.reason ?? null,
  };
}

function isDuplicateAction(actions: FlyToAction[], next: FlyToAction): boolean {
  return actions.some((a) => a.place === next.place && a.lat === next.lat && a.lon === next.lon);
}

function fallbackAnswer(message: string, prose: string, actions: FlyToAction[]): Answer {
  const where = actions[0]?.place;
  const cleanProse = prose.trim();
  const summary =
    cleanProse ||
    (where
      ? `The map is now focused on ${where} with the plots around it loaded for inspection.`
      : "Here is what could be assembled for that query without a full model answer.");
  return {
    spoken: cleanProse
      ? cleanProse
      : where
        ? `Done — the map is now showing the plots around ${where}.`
        : summary,
    summary,
    // Degraded reply: no model verdict exists, so keep the optional card
    // sections empty (the UI hides them) and surface only the genuine caveat.
    framework: [],
    riskAssessment: "",
    evidence: [],
    limitation:
      "This reply was assembled without a full model response — verify details against certified records.",
    evidenceBreakdown: [],
    suggestedFollowups: [
      "Show me the plots in Mira Road",
      "What approvals are needed for NA conversion here?",
      "Check flood and climate risk for this area",
    ],
  };
}

interface LoopResult {
  answer: Answer;
  actions: FlyToAction[];
  model: string;
}

async function runAgentLoop(params: {
  key: string;
  model: string;
  referer: string;
  messages: ChatMessage[];
}): Promise<LoopResult> {
  const { key, model, referer, messages } = params;
  const actions: FlyToAction[] = [];
  let answer: Answer | null = null;
  let prose = "";
  let usedModel = model;
  let forceSubmit = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Last round (or after a prose reply): force the structured answer so the
    // loop always terminates with a parseable submit_answer call.
    const toolChoice =
      forceSubmit || round >= MAX_TOOL_ROUNDS - 1
        ? { type: "function", function: { name: SUBMIT_ANSWER_TOOL.name } }
        : "auto";
    const reply = await callOpenRouter(key, model, messages, toolChoice, referer);
    usedModel = reply.model;
    const toolCalls = reply.message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      const content = typeof reply.message.content === "string" ? reply.message.content : "";
      const parsed = extractAnswer(content);
      if (parsed) {
        answer = parsed;
        prose = content;
        break;
      }
      // Model replied in plain prose — keep it (as fallback text / context)
      // and force a structured submit_answer on the next round.
      if (content.trim()) messages.push({ role: "assistant", content });
      prose = content;
      forceSubmit = true;
      continue;
    }

    messages.push({
      role: "assistant",
      content: reply.message.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const name = call.function?.name;
      const args = safeJson(call.function?.arguments ?? "{}");
      if (name === SHOW_AREA_TOOL.name) {
        const parsed = ShowAreaArgsSchema.safeParse(args);
        if (parsed.success) {
          const action = toFlyToAction(parsed.data);
          if (!isDuplicateAction(actions, action)) actions.push(action);
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(
            parsed.success
              ? { ok: true, navigated: parsed.data.place }
              : { ok: false, error: "invalid show_area arguments" },
          ),
        });
      } else if (name === SUBMIT_ANSWER_TOOL.name) {
        const parsed = AnswerSchema.safeParse(args);
        if (parsed.success) answer = parsed.data;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(
            parsed.success
              ? { ok: true }
              : {
                  ok: false,
                  error: `invalid submit_answer arguments: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
                },
          ),
        });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: `unknown tool ${name ?? "undefined"}` }),
        });
      }
    }

    if (answer) break;
  }

  const message = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  return { answer: answer ?? fallbackAnswer(message, prose, actions), actions, model: usedModel };
}

// ---------------------------------------------------------------------------
// NL-GIS Copilot pipeline: plan → (validate, query data server-side) → explain
// ---------------------------------------------------------------------------

function plannerPrompt(context: MapContext | null, previous: QueryPlan | null): string {
  const ctx = context
    ? `Map selection: ${[context.village, context.taluka, context.district, context.state].filter(Boolean).join(", ") || "unnamed point"} at ${context.lat.toFixed(4)}, ${context.lon.toFixed(4)}${context.landUse ? ` (land use: ${context.landUse})` : ""}.`
    : "Nothing is selected on the map.";
  const prev = previous
    ? `Previous analysis (for follow-ups): ${JSON.stringify({ intent: previous.intent, location: previous.location?.name, state: previous.location?.state, from_year: previous.from_year, to_year: previous.to_year, from_class: previous.from_class, to_class: previous.to_class, compare_with: previous.compare_with?.name })}`
    : "There is no previous analysis.";
  return `You are the query planner of Bhumi-Niti, India's land-governance GIS platform. Convert the user's question into a plan by calling plan_query. Never answer the question.

The user may write in English, Hindi, Marathi or another Indian language (or Hinglish). Understand it in any language, but return place names and topic keywords in English.

Guidance:
- land_use_change: change between years or classes ("agricultural land converted to built-up around Pune since 2019" → from_class agriculture, to_class built_up, from_year 2019, to_year 2024, map_action highlight_change).
- land_use_summary: current land-use mix of a place.
- parcel_lookup / show_location: find or show a place, village, survey number or its plots.
- conversion_eligibility: NA / land-use conversion questions for a parcel or area.
- dispute_check, climate_risk, socio_economic: those indicators for a place.
- compare_regions: comparing two places; put the second place in compare_with.
- policy_research: laws, Acts, sections, rules, regulations, government policies and schemes, research and reports — including anything about the Policy Lab and its instruments (Maharashtra Land Revenue Code, Tenancy & Agricultural Lands Act, Fragmentation & Consolidation of Holdings Act, MR&TP Act, UDCPR / FSI, Industries Policy 2025, Package Scheme of Incentives 2019, MIDC Act, Logistics Policy 2024, Aadhaar Act). Put the Act name and any section number in topic, in English.
- conversion_eligibility also covers "can I convert / NA permission" questions; it pulls the relevant Act text too.
- general: greetings, how the platform works, anything else.
- "near me", "here", "this area/village/parcel", "surrounding parcels" → uses_map_context true.
- A follow-up that refines or continues the previous analysis → refers_to_previous true and only fill what changed ("only agriculture to built-up" → from_class/to_class; "compare it with Nashik" → compare_with Nashik).
- Give the state for every Indian place, and approximate lat/lon for named places.
- "since 2019" means from_year 2019 to_year 2024. Data exists for 2018–2024.

${ctx}
${prev}`;
}

async function planQuery(params: {
  key: string;
  model: string;
  referer: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: MapContext | null;
  previous: QueryPlan | null;
}): Promise<RawPlan> {
  const messages: ChatMessage[] = [
    { role: "system", content: plannerPrompt(params.context, params.previous) },
    ...params.history.slice(-4).map<ChatMessage>((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: params.message },
  ];
  try {
    const reply = await callOpenRouter(
      params.key,
      params.model,
      messages,
      { type: "function", function: { name: PLAN_QUERY_TOOL.name } },
      params.referer,
      PLAN_TOOLS,
    );
    const call = reply.message.tool_calls?.find((c) => c.function?.name === PLAN_QUERY_TOOL.name);
    const parsed = RawPlanSchema.safeParse(safeJson(call?.function?.arguments ?? "{}"));
    if (parsed.success) return parsed.data;
  } catch (error) {
    console.error("[/api/ai] planner failed", error instanceof Error ? error.message : error);
  }
  // Planner unavailable: fall back to a general answer (validation adds a note)
  return { intent: "general", uses_map_context: false, refers_to_previous: false };
}

function groundingPrompt(plan: QueryPlan, notes: ValidationNote[], data: DataResult[], lang: LanguageInfo): string {
  const compact = data.map((d) => ({
    dataset: d.dataset,
    label: d.label,
    provenance: d.provenance,
    headline: d.headline,
    rows: d.rows,
    table: d.table,
    note: d.note,
    quotes: d.quotes?.map((q) => ({
      instrument: q.policy,
      clause: q.clause,
      page: q.page || null,
      text: q.quote.length > 600 ? `${q.quote.slice(0, 600)}…` : q.quote,
      grounding: q.method,
      // A modelling value must never read like a figure from the Act
      parameter: q.parameter
        ? q.method === "inferred"
          ? `MODELLING VALUE, NOT IN THE DOCUMENT — do not state it as law: ${q.parameter} = ${q.value}`
          : `${q.parameter} = ${q.value}`
        : undefined,
    })),
  }));
  return `COPILOT MODE — this turn has already been planned and the platform's data has been queried for you.

LANGUAGE: Write spoken, summary, framework, riskAssessment, limitation and suggestedFollowups in ${lang.name}${lang.code === "en" ? "" : ` (${lang.native}, native script)`}. Keep place names recognisable.

VALIDATED QUERY PLAN:
${JSON.stringify(plan)}

VALIDATION NOTES:
${notes.length ? notes.map((n) => `- [${n.level}] ${n.text}`).join("\n") : "- none"}

PLATFORM DATA RESULTS:
${JSON.stringify(compact)}

Rules for this answer:
1. Every figure about land use, parcels, disputes, climate or households must come from PLATFORM DATA RESULTS, quoted as given. Never invent numbers, survey numbers, case details or dates.
2. provenance "demo" means demonstration / model data: when you use it, call it a demo estimate — never official statistics.
3. provenance "unavailable" means the integration isn't connected: say so and where to verify officially.
4. You may add general explanation of laws and procedures, clearly as explanation, not as platform data.
5. Do not list or name sources yourself (set evidence to []); the platform displays the evidence it actually used.
6. If a validation note is a warning, mention it briefly.
8. When a result has a note saying it is a state-level figure, say explicitly that the number is for the whole state, not the city or district the user named. Never present two places in the same state as having separately measured results.
7. The map is updated automatically for this plan; don't call show_area.
9. provenance "document" is verbatim text from real Acts and policies in the Policy Lab library. When you state what a law or policy says, use ONLY those quotes: paraphrase them faithfully (translate if answering in Hindi/Marathi) and cite them inline as "(Act short name, clause, p. N)" — omit the page when it is null. Never invent section numbers, pages, figures or provisions that are not in the quotes; if the quotes don't cover the question, say the library doesn't cover it.
10. A quote with grounding "inferred" is a Policy Lab modelling value, not something the document states — say so if you mention it. "derived" means it follows from the text but isn't stated as a figure.
11. Policy Lab simulations run on simulated land data; if the user asks about a policy's impact, point them to the Policy Lab and say the impact figures there are simulated.
12. Fill evidenceBreakdown with the sections that genuinely apply (OBSERVED / DERIVED / LEGAL EVIDENCE / INTERPRETATION / LIMITATIONS / SOURCES), each one sentence grounded in the data above. OBSERVED and DERIVED must trace to PLATFORM DATA RESULTS; LEGAL EVIDENCE only for verbatim document quotes; SOURCES only names the real verification channel the user can check — never invent one.`;
}

async function explain(params: {
  key: string;
  model: string;
  referer: string;
  messages: ChatMessage[];
  fallback: string;
}): Promise<{ answer: Answer; model: string }> {
  try {
    const reply = await callOpenRouter(
      params.key,
      params.model,
      params.messages,
      { type: "function", function: { name: SUBMIT_ANSWER_TOOL.name } },
      params.referer,
    );
    const call = reply.message.tool_calls?.find((c) => c.function?.name === SUBMIT_ANSWER_TOOL.name);
    const parsed = AnswerSchema.safeParse(safeJson(call?.function?.arguments ?? ""));
    if (parsed.success) return { answer: parsed.data, model: reply.model };
    const salvaged = extractAnswer(typeof reply.message.content === "string" ? reply.message.content : "");
    if (salvaged) return { answer: salvaged, model: reply.model };
  } catch (error) {
    console.error("[/api/ai] explain failed", error instanceof Error ? error.message : error);
  }
  // Model unavailable: return the platform's own data headline rather than nothing
  const base = fallbackAnswer("", params.fallback, []);
  return { answer: base, model: params.model };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleAiApi(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed — POST a {message} JSON body." },
      405,
    );
  }

  const key = readEnv(env, "OPENROUTER_API_KEY");
  if (!key) {
    return jsonResponse(
      {
        ok: false,
        error:
          "AI is not configured. Set OPENROUTER_API_KEY in the server environment (.env for local dev, an env binding when deployed).",
      },
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error: `Invalid request: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
      },
      400,
    );
  }

  const { message, history, context } = parsed.data;
  const model = readEnv(env, "OPENROUTER_MODEL") ?? DEFAULT_MODEL;
  let referer = "http://localhost:8080";
  try {
    referer = new URL(request.url).origin;
  } catch {
    // keep default
  }

  const pipeline: { step: string; ms: number }[] = [];
  let t = Date.now();
  const mark = (step: string) => {
    const now = Date.now();
    pipeline.push({ step, ms: now - t });
    t = now;
  };

  try {
    // 1. Language detection (local, no model call)
    const detection = detectLanguage(message, (parsed.data.languageHint as LanguageCode | undefined) ?? "en");
    const lang = detection.language;
    mark("detect_language");

    // 2. Intent extraction → structured plan (LLM, forced tool call)
    const previous = (parsed.data.previousPlan ?? null) as QueryPlan | null;
    const raw = await planQuery({ key, model, referer, message, history: history ?? [], context: context ?? null, previous });
    mark("plan");

    // 3. Validation against what the platform can answer
    const { plan, notes } = validatePlan(raw, { language: lang.code, context: context ?? null, previous });
    mark("validate");

    // 4. Data / GIS layer + evidence (server-side, never from the LLM)
    const data = executePlan(plan, message);
    const evidence = evidenceFor(data);
    mark("query_data");

    // 5. Explanation in the user's language, grounded in the data results
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(context) },
      { role: "system", content: groundingPrompt(plan, notes, data, lang) },
      ...(history ?? []).map<ChatMessage>((entry) => ({ role: entry.role, content: entry.content })),
      { role: "user", content: message },
    ];
    const answer = await explain({ key, model, referer, messages, fallback: data[0]?.headline ?? "" });
    mark("explain");

    // 6. Map actions + chips + follow-ups (deterministic, from the validated plan)
    const actions = mapActionsFor(plan);
    const chips = chipsFor(plan, lang.code);
    const followups = Array.from(new Set([...followupsFor(plan, lang.code), ...answer.answer.suggestedFollowups])).slice(0, 4);
    mark("act");

    return jsonResponse({
      ok: true,
      model: answer.model,
      language: { code: lang.code, name: lang.name, native: lang.native, bcp47: lang.bcp47, confidence: detection.confidence, method: detection.method },
      plan,
      validation: notes,
      data,
      evidence: [
        ...evidence,
        { label: `AI explanation · ${answer.model}`, detail: "Wording and general context generated by the language model", provenance: "ai" },
      ],
      chips,
      pipeline,
      reply: {
        summary: answer.answer.summary,
        framework: answer.answer.framework,
        riskAssessment: answer.answer.riskAssessment,
        // Sources come from the data layer, not from the model
        evidence: evidence.map((e) => ({ label: e.label, type: e.provenance })),
        limitation: answer.answer.limitation,
        evidenceBreakdown: answer.answer.evidenceBreakdown,
        suggestedFollowups: followups,
      },
      spoken: answer.answer.spoken,
      actions,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/ai]", detail);
    return jsonResponse({ ok: false, error: `AI service error: ${detail}` }, 502);
  }
}
