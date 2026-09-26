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
      suggestedFollowups: {
        type: "array",
        items: { type: "string" },
        description: "2-3 concrete questions the user could ask next.",
      },
    },
    required: ["spoken", "summary", "suggestedFollowups"],
  },
} as const;

const TOOLS = [
  { type: "function" as const, function: SHOW_AREA_TOOL },
  { type: "function" as const, function: SUBMIT_ANSWER_TOOL },
];

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
      tools: TOOLS,
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

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(context) },
    ...(history ?? []).map<ChatMessage>((entry) => ({ role: entry.role, content: entry.content })),
    { role: "user", content: message },
  ];

  try {
    const result = await runAgentLoop({ key, model, referer, messages });
    return jsonResponse({
      ok: true,
      model: result.model,
      reply: {
        summary: result.answer.summary,
        framework: result.answer.framework,
        riskAssessment: result.answer.riskAssessment,
        evidence: result.answer.evidence,
        limitation: result.answer.limitation,
        suggestedFollowups: result.answer.suggestedFollowups,
      },
      spoken: result.answer.spoken,
      actions: result.actions,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/ai]", detail);
    return jsonResponse({ ok: false, error: `AI service error: ${detail}` }, 502);
  }
}
