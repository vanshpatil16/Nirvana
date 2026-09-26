/**
 * Policy document reader — POST /api/policy/extract.
 *
 * The New Policy screen accepts a PDF of an instrument that is not in the
 * library. We ask Gemini to read it and return the quantified provisions as
 * structured JSON, each with the section it came from, a page number and a
 * verbatim quote. The client then turns that into a draft policy the user
 * reviews before anything is simulated — the model proposes, the user decides.
 *
 * Design notes:
 *
 *  · The GEMINI_API_KEY is read from server env only, exactly as
 *    OPENROUTER_API_KEY is in `ai-agent.ts`. It never enters the client bundle.
 *  · The PDF travels as base64 in the request body and is handed to the Gemini
 *    Files API, so one code path handles both a 40 KB gazette notification and a
 *    150 MB regional plan report. Small files fall back to inline data if the
 *    resumable upload fails, because losing a whole run to a transient upload
 *    error is a bad trade.
 *  · Output is constrained by `responseSchema` and then validated with zod. If
 *    validation fails we make exactly one repair round-trip, then give up and
 *    return the raw text so the user can see what came back rather than getting
 *    a generic failure.
 *  · Every extracted provision carries a method (`explicit` | `derived` |
 *    `inferred`) and a confidence. The UI shows both, so a confident-sounding
 *    hallucination is visibly distinguishable from a quoted figure.
 *
 * Runtime: fetch and zod only, no Node APIs, safe on any edge runtime.
 */

import { z } from "zod";

const GEMINI_ROOT = "https://generativelanguage.googleapis.com";
/**
 * `gemini-flash-latest` tracks the current stable flash model, so the endpoint
 * keeps working when Google retires a version. Pinned alternatives that were
 * verified against a live key: `gemini-3.8-flash`, `gemini-3.6-flash`.
 *
 * Do not default to `gemini-2.5-flash` / `gemini-2.5-pro`: they are listed by
 * the models endpoint but return 404 "no longer available to new users" on a
 * fresh key, which surfaces as an unhelpful failure at extraction time.
 */
const DEFAULT_MODEL = "gemini-flash-latest";
const UPLOAD_TIMEOUT_MS = 120_000;
const GENERATE_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 45;
/** Base64 inflates by ~4/3; reject well before any platform body limit. */
const MAX_BASE64_CHARS = 190 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Wire schema — what we ask the model for
// ---------------------------------------------------------------------------

const ProvisionSchema = {
  type: "object",
  properties: {
    label: {
      type: "string",
      description: "Short name of the provision, e.g. 'Annual conversion ceiling'.",
    },
    value: {
      type: "string",
      description:
        "The figure exactly as stated, with its unit, e.g. '40 square metres', '4%', '1,500 crore', '20 years'. Use the word 'none' if the provision is a prohibition or duty with no figure.",
    },
    unit: {
      type: "string",
      description: "Unit alone, e.g. 'm²', '%', '₹ crore', 'years', 'months', or 'none'.",
    },
    numericValue: {
      type: "number",
      description: "The figure as a bare number for modelling, or 0 when there is no figure.",
    },
    clause: {
      type: "string",
      description:
        "Section, regulation, schedule or chapter reference, e.g. 'Section 42(2)' or 'Regulation 6.3'.",
    },
    page: {
      type: "integer",
      description: "1-based page in the PDF where the provision appears. 0 if unknown.",
    },
    quote: {
      type: "string",
      description:
        "The verbatim sentence or clause from the document that states the figure. Must be copied exactly, not paraphrased. Empty string if the provision cannot be located in the text.",
    },
    method: {
      type: "string",
      enum: ["explicit", "derived", "inferred"],
      description:
        "explicit = stated in so many words. derived = arithmetic on stated values. inferred = a modelling assumption with no textual basis.",
    },
    confidence: {
      type: "number",
      description:
        "0 to 1. How confident you are that the quote really says what the label claims.",
    },
    isRestriction: {
      type: "boolean",
      description:
        "True if the provision prohibits, bars, restricts or freezes something rather than setting a figure.",
    },
  },
  required: [
    "label",
    "value",
    "unit",
    "numericValue",
    "clause",
    "page",
    "quote",
    "method",
    "confidence",
    "isRestriction",
  ],
  propertyOrdering: [
    "label",
    "value",
    "unit",
    "numericValue",
    "clause",
    "page",
    "quote",
    "method",
    "confidence",
    "isRestriction",
  ],
} as const;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    policyName: { type: "string", description: "Full name of the instrument exactly as titled." },
    shortName: { type: "string", description: "Short label, under 40 characters." },
    issuer: { type: "string", description: "Government, department or authority that issued it." },
    actYear: {
      type: "integer",
      description: "Year of enactment or of the policy. 0 if not stated.",
    },
    enactmentDate: {
      type: "string",
      description:
        "Date of enactment or assent, ISO where possible, else as written. Empty string if not stated.",
    },
    effectiveDate: {
      type: "string",
      description:
        "Date the instrument came into force, ISO where possible. Empty string if not stated.",
    },
    notificationDate: {
      type: "string",
      description:
        "Date of the gazette notification, if the instrument was notified separately. Empty string if none.",
    },
    jurisdiction: {
      type: "string",
      description: "Area of application, e.g. a state, a city or a planning authority area.",
    },
    objective: {
      type: "string",
      description: "One or two sentences on what the instrument is for, in its own terms.",
    },
    domain: {
      type: "string",
      enum: [
        "Land Use & Conversion",
        "Planning & Zoning",
        "Land Records & Cadastral",
        "Tenancy & Holdings Structure",
        "Industrial & Investment Promotion",
        "Logistics & Warehousing",
        "Acquisition & Resettlement",
      ],
      description: "Closest single domain for this instrument.",
    },
    landClasses: {
      type: "array",
      items: {
        type: "string",
        enum: ["agricultural", "orchard", "forest", "built-up", "industrial", "water", "barren"],
      },
      description: "Land classes the instrument acts on.",
    },
    indicatorIds: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "agri_share",
          "forest_share",
          "built_share",
          "water_share",
          "agri_loss",
          "crop_intensity",
          "ror_digitisation",
          "revenue_na_share",
          "parcel_mismatch",
          "parcel_count",
          "mutation_days",
          "land_value",
          "litigation_rate",
          "acquisition_area",
          "rr_displaced",
          "compensation_ratio",
          "rr_compliance",
          "agri_per_capita",
          "rural_density",
          "holdings_avg_size",
          "fragment_share",
          "tenancy_recorded",
          "industrial_share",
          "fsi",
          "industrial_land_supply",
          "project_pipeline",
        ],
      },
      description: "The indicators this instrument would plausibly be evaluated on. Pick 3 to 8.",
    },
    provisions: {
      type: "array",
      items: ProvisionSchema,
      description:
        "Every quantified provision or binding restriction in the instrument, 4 to 14 entries. Prefer provisions that state a figure over general provisions.",
    },
    sourceClauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clause: { type: "string" },
          page: { type: "integer" },
          quote: { type: "string" },
        },
        required: ["clause", "page", "quote"],
        propertyOrdering: ["clause", "page", "quote"],
      },
      description: "1 to 4 clauses that establish the objective, scope or effective date.",
    },
    caveats: {
      type: "array",
      items: { type: "string" },
      description:
        "Anything a reader should know before relying on this extraction: missing text layer, superseded provisions, figures you could not locate.",
    },
    overallConfidence: { type: "number", description: "0 to 1 for the extraction as a whole." },
  },
  required: [
    "policyName",
    "shortName",
    "issuer",
    "actYear",
    "enactmentDate",
    "effectiveDate",
    "notificationDate",
    "jurisdiction",
    "objective",
    "domain",
    "landClasses",
    "indicatorIds",
    "provisions",
    "sourceClauses",
    "caveats",
    "overallConfidence",
  ],
  propertyOrdering: [
    "policyName",
    "shortName",
    "issuer",
    "actYear",
    "enactmentDate",
    "effectiveDate",
    "notificationDate",
    "jurisdiction",
    "objective",
    "domain",
    "landClasses",
    "indicatorIds",
    "provisions",
    "sourceClauses",
    "caveats",
    "overallConfidence",
  ],
} as const;

export interface ExtractedProvision {
  label: string;
  value: string;
  unit: string;
  numericValue: number;
  clause: string;
  page: number;
  quote: string;
  method: "explicit" | "derived" | "inferred";
  confidence: number;
  isRestriction: boolean;
}

export interface ExtractionResult {
  policyName: string;
  shortName: string;
  issuer: string;
  actYear: number;
  enactmentDate: string;
  effectiveDate: string;
  notificationDate: string;
  jurisdiction: string;
  objective: string;
  domain: string;
  landClasses: string[];
  indicatorIds: string[];
  provisions: ExtractedProvision[];
  sourceClauses: { clause: string; page: number; quote: string }[];
  caveats: string[];
  overallConfidence: number;
}

// ---------------------------------------------------------------------------
// Validation — the model's output is untrusted input
// ---------------------------------------------------------------------------

const ProvisionSchemaZ = z.object({
  label: z.string().min(1).max(120),
  value: z.string().max(200),
  unit: z.string().max(40),
  numericValue: z.number(),
  clause: z.string().max(120),
  page: z.number().int().min(0).max(20_000),
  quote: z.string().max(2000),
  method: z.enum(["explicit", "derived", "inferred"]),
  confidence: z.number().min(0).max(1),
  isRestriction: z.boolean(),
});

const ExtractionSchemaZ = z.object({
  policyName: z.string().min(1).max(300),
  shortName: z.string().min(1).max(60),
  issuer: z.string().max(300),
  actYear: z.number().int().min(0).max(2200),
  enactmentDate: z.string().max(60),
  effectiveDate: z.string().max(60),
  notificationDate: z.string().max(60),
  jurisdiction: z.string().max(200),
  objective: z.string().min(1).max(1200),
  domain: z.string().min(1).max(80),
  landClasses: z.array(z.string().max(40)).max(10),
  indicatorIds: z.array(z.string().max(60)).max(20),
  // Empty is a valid answer: a document with no simulation-relevant provision
  // should say so rather than pad the list with administrative clauses.
  provisions: z.array(ProvisionSchemaZ).max(20),
  sourceClauses: z
    .array(
      z.object({
        clause: z.string().max(120),
        page: z.number().int().min(0).max(20_000),
        quote: z.string().max(2000),
      }),
    )
    .max(8),
  caveats: z.array(z.string().max(400)).max(10),
  overallConfidence: z.number().min(0).max(1),
});

const RequestSchema = z.object({
  filename: z.string().min(1).max(260),
  mimeType: z.enum(["application/pdf"]),
  dataBase64: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You read Indian land-governance instruments — Acts, Rules, development control regulations, gazette notifications and sector policies — and report the quantified provisions a policy-simulation engine can use.

Rules you must follow:

1. QUOTE EXACTLY. The \`quote\` field must be copied character for character from the document. Never paraphrase, never tidy, never translate. If you cannot find supporting text, set \`quote\` to an empty string and set \`method\` to "inferred" with low confidence. An empty quote is honest; a reconstructed quote is not.

2. GRADE YOUR OWN CERTAINTY. \`method\` is "explicit" only when the document states the figure in so many words. Use "derived" when you did arithmetic on stated values, and "inferred" when you are supplying a modelling assumption the document does not contain. Set \`confidence\` accordingly — a figure you inferred must never carry high confidence.

3. EXTRACT ONLY FIGURES A SIMULATION WOULD RESPOND TO. A provision earns a place if a number in a land-use or land-record simulation would move when it changes: area thresholds, percentages, distances, monetary limits, plot ratios, caps, ceilings, quotas and prohibitions on land or its use.

   Exclude administrative machinery even when it contains a number. Specifically exclude: laying periods before the legislature, immunity and good-faith clauses, the power to make rules, repeal and savings clauses, difficulty-removal periods, definitions, recitals, appeals procedure, and the machinery of notification. "Rules must be laid for thirty days" is not a policy parameter. "A holding may not exceed 20 hectares" is.

4. CAPTURE RESTRICTIONS AS WELL AS FIGURES. A bar, a freeze, a mandatory requirement or an exemption is a provision even with no number — but it must restrict something substantive, not procedure. Set \`numericValue\` to 0, \`value\` to "none", \`unit\` to "none" and \`isRestriction\` to true.

5. DATES MATTER. Record enactment, effective and notification dates separately and exactly as the document gives them. Do not guess a date the document does not state — leave the field empty instead. If commencement is by notification rather than on a stated day, say so in \`caveats\`.

6. SCANNED DOCUMENTS. If the PDF has no text layer and you are reading it as images, say so in \`caveats\` and lower \`overallConfidence\`. Page numbers are 1-based.

7. Pick the single closest \`domain\` and 3 to 8 \`indicatorIds\` from the supplied enums. Do not invent identifiers outside those lists.

8. If the document contains no provisions that pass rule 3, return an empty \`provisions\` array and say so in \`caveats\`. An empty list is a correct answer; padding it with administrative clauses is not.

Return only the structured object. No prose outside it.`;

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
// Gemini transport
// ---------------------------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface UploadedFile {
  uri: string;
  name: string;
  state: string;
}

/** Resumable upload via the Files API — one path for small and very large PDFs. */
async function uploadFile(
  key: string,
  bytes: Uint8Array,
  mimeType: string,
  displayName: string,
): Promise<UploadedFile> {
  const start = await fetch(`${GEMINI_ROOT}/upload/v1beta/files?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!start.ok) {
    throw new Error(
      `Gemini upload start ${start.status}: ${(await start.text().catch(() => "")).slice(0, 200)}`,
    );
  }
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini upload start returned no upload URL.");

  const done = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": mimeType,
    },
    body: bytes as unknown as BodyInit,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!done.ok) {
    throw new Error(
      `Gemini upload ${done.status}: ${(await done.text().catch(() => "")).slice(0, 200)}`,
    );
  }
  const payload = (await done.json()) as { file?: UploadedFile };
  if (!payload.file?.uri) throw new Error("Gemini upload returned no file URI.");
  return payload.file;
}

async function fileState(key: string, name: string): Promise<string> {
  const res = await fetch(`${GEMINI_ROOT}/v1beta/${name}?key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return "UNKNOWN";
  const payload = (await res.json().catch(() => null)) as { state?: string } | null;
  return payload?.state ?? "UNKNOWN";
}

async function awaitActive(key: string, name: string): Promise<void> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const state = await fileState(key, name);
    if (state === "ACTIVE") return;
    if (state === "FAILED") throw new Error("Gemini could not process the uploaded document.");
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for the document to become readable. Try a smaller file.");
}

interface GenerateInput {
  key: string;
  model: string;
  prompt: string;
  /** either a Files API URI or inline bytes */
  file?: { uri: string };
  inline?: { bytes: Uint8Array; mimeType: string };
}

async function generateJson(input: GenerateInput): Promise<string> {
  const { key, model, prompt, file, inline } = input;
  const parts: unknown[] = [];
  if (file) parts.push({ file_data: { file_uri: file.uri } });
  if (inline) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < inline.bytes.length; i += chunk) {
      binary += String.fromCharCode(...inline.bytes.subarray(i, i + chunk));
    }
    parts.push({ inline_data: { mime_type: inline.mimeType, data: btoa(binary) } });
  }
  parts.push({ text: prompt });

  const res = await fetch(
    `${GEMINI_ROOT}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(describeGeminiError(res.status, detail, model));
  }
  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned an empty response.");
  return text;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Turn a Gemini HTTP failure into something a reader can act on.
 *
 * The three that actually bite in practice are all unactionable if the raw body
 * is passed through: a quota that the plan does not cover, a model this key is
 * not entitled to, and a model Google has retired.
 */
function describeGeminiError(status: number, detail: string, model: string): string {
  const apiMessage = (() => {
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } };
      return parsed.error?.message ?? "";
    } catch {
      return "";
    }
  })();

  if (status === 429 || /quota|rate limit|resource[_ ]exhausted/i.test(apiMessage)) {
    return `Gemini quota exhausted for "${model}". A free-tier key has no quota for the pro models, and flash quotas are small — wait for the limit to reset, or use a different GEMINI_MODEL.`;
  }
  if (status === 404 && /no longer available/i.test(apiMessage)) {
    return `Model "${model}" is not available to this API key (${apiMessage.split(".")[0]}). Set GEMINI_MODEL to gemini-flash-latest.`;
  }
  if (status === 403) {
    return `Gemini rejected the API key (403). Check that GEMINI_API_KEY is valid and that the Generative Language API is enabled for the project.`;
  }
  if (status === 503) {
    return `Gemini is temporarily unavailable for "${model}" (503). This is usually a capacity spike — retry in a moment.`;
  }
  return `Gemini ${status} on "${model}": ${apiMessage || detail.slice(0, 200)}`;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** The model occasionally wraps JSON in a fence or a sentence — dig it out. */
function salvage(raw: string): unknown {
  const direct = safeJson(raw);
  if (direct) return direct;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return safeJson(raw.slice(start, end + 1));
  return null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handlePolicyExtract(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed — POST { filename, mimeType, dataBase64 }." },
      405,
    );
  }

  const key = readEnv(env, "GEMINI_API_KEY");
  if (!key) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Document reading is not configured. Set GEMINI_API_KEY in the server environment (.env for local dev, an env binding when deployed).",
      },
      503,
    );
  }
  const model = readEnv(env, "GEMINI_MODEL") ?? DEFAULT_MODEL;

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

  const { filename, mimeType, dataBase64 } = parsed.data;
  if (dataBase64.length > MAX_BASE64_CHARS) {
    return jsonResponse(
      {
        ok: false,
        error: `That file is too large to read (${Math.round(dataBase64.length / 1024 / 1024)} MB encoded). The limit is about ${Math.round(MAX_BASE64_CHARS / 1024 / 1024)} MB — try splitting the document.`,
      },
      413,
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(dataBase64);
  } catch {
    return jsonResponse({ ok: false, error: "The file could not be decoded. Re-upload it." }, 400);
  }

  const prompt = [
    `Read the attached document and extract its policy parameters.`,
    ``,
    `The file name is "${filename}". Treat it as authoritative only if the document's own`,
    `title agrees with it; if they differ, the document's title wins and you should say so in`,
    `\`caveats\`.`,
    ``,
    `Report between 4 and 14 provisions, choosing those whose figures a land-use simulation would`,
    `actually respond to. Every provision must carry a verbatim \`quote\`.`,
  ].join("\n");

  try {
    let text = "";
    let transport: "files" | "inline" = "files";
    // Held so the repair round-trip can re-send the document rather than asking
    // the model to fix JSON it can no longer see the source for.
    let doc: { file?: { uri: string }; inline?: { bytes: Uint8Array; mimeType: string } } = {};

    try {
      const uploaded = await uploadFile(key, bytes, mimeType, filename);
      await awaitActive(key, uploaded.name);
      doc = { file: { uri: uploaded.uri } };
      text = await generateJson({ key, model, prompt, ...doc });
    } catch (uploadError) {
      // Files API can reject very large or oddly-encoded PDFs; inline still works
      // for anything under the request limit, so try it before giving up.
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
      if (bytes.byteLength > 18 * 1024 * 1024) {
        throw new Error(`Upload failed and the file is too large to send inline. ${message}`);
      }
      transport = "inline";
      doc = { inline: { bytes, mimeType } };
      text = await generateJson({ key, model, prompt, ...doc });
    }

    const first = ExtractionSchemaZ.safeParse(salvage(text));
    if (first.success) {
      return jsonResponse({
        ok: true,
        model,
        transport,
        extraction: first.data,
        repaired: false,
      });
    }

    // One repair round-trip: hand the model its own output and the complaint,
    // with the document still attached so it can re-read rather than guess.
    const repairPrompt = [
      `Your previous response was not valid against the required schema.`,
      ``,
      `Complaint: ${first.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      ``,
      `Re-read the attached document and return the corrected object only, with every required`,
      `field present and no prose outside it.`,
      ``,
      `Previous response:`,
      text.slice(0, 20_000),
    ].join("\n");

    const repairedText = await generateJson({ key, model, prompt: repairPrompt, ...doc });
    const second = ExtractionSchemaZ.safeParse(salvage(repairedText));
    if (second.success) {
      return jsonResponse({
        ok: true,
        model,
        transport,
        extraction: second.data,
        repaired: true,
      });
    }

    // Out of retries — return the raw text so the user can see what came back
    // rather than a bare "failed".
    return jsonResponse(
      {
        ok: false,
        error: "The model returned a response that did not match the required schema, twice.",
        detail: second.error.issues.slice(0, 8),
        raw: repairedText.slice(0, 8000),
      },
      502,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/policy/extract]", detail);
    return jsonResponse({ ok: false, error: `Document reading failed: ${detail}` }, 502);
  }
}
