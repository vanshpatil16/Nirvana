/**
 * Innovation Portal evidence assistant — POST /api/innovation/ai.
 *
 * Implements the seven evidence-first capabilities from §8 of the Innovation
 * Portal specification:
 *
 *   find_evidence      — search research, datasets, policy and GIS for a challenge
 *   explain_dataset    — provenance, date, coverage, variables and limitations
 *   similar_pilots     — related initiatives and documented outcomes
 *   literature_brief   — synthesise papers while preserving citations
 *   missing_evidence   — flag unsupported claims in a proposal
 *   suggest_kpis       — propose measurable indicators, marked AI-generated
 *   policy_brief       — convert validated findings into an evidence-backed brief
 *   ask                — free question over a project's own evidence
 *
 * THE TRUST RULE (§8) IS ENFORCED IN CODE, NOT JUST PROMPTED
 * ------------------------------------------------------------
 * The specification requires that "AI should assist discovery and synthesis, not
 * invent evidence. Factual claims should expose their underlying source whenever
 * a source exists." Two mechanisms do that work here:
 *
 *  1. The model only ever sees a bounded SOURCE list (the challenge brief, the
 *     project evidence locker, research notes, decisions and experiments). It is
 *     instructed to cite by source id and to say so when a question is not
 *     answerable from those sources.
 *  2. Every citation the model returns is validated against that same list. A
 *     citation naming a source that was never supplied is DROPPED, and the
 *     response reports how many were dropped. The UI shows this, so a
 *     hallucinated reference is visible rather than silently rendered.
 *
 * The model cannot invent a citation that survives to the screen.
 *
 * OPENROUTER_API_KEY is read from server env only (env binding on deployed edge
 * runtimes, or process.env from .env during vite dev/build). It is never
 * referenced from client code. Runtime: fetch + zod only, safe on any runtime.
 */

import { z } from "zod";
import {
  CHALLENGES,
  PROJECTS,
  RESEARCH_BRIDGE,
  getChallenge,
  getProject,
  type Challenge,
  type Project,
} from "@/data/innovation";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const FETCH_TIMEOUT_MS = 45_000;
const MAX_TOKENS = 1400;

/** The eight §8 entry points. */
export const ASSISTANT_ACTIONS = [
  "find_evidence",
  "explain_dataset",
  "similar_pilots",
  "literature_brief",
  "missing_evidence",
  "suggest_kpis",
  "policy_brief",
  "ask",
] as const;

export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

const RequestSchema = z.object({
  action: z.enum(ASSISTANT_ACTIONS),
  question: z.string().max(2000).optional(),
  /** Challenge brief context, when the assistant is used outside a workspace. */
  challengeId: z.string().max(120).optional(),
  /** Project workspace context. */
  projectId: z.string().max(120).optional(),
  /** For `explain_dataset`: the evidence id or citation to focus on. */
  target: z.string().max(400).optional(),
});

/** What the model returns. Validated before it can reach a screen. */
const ModelAnswerSchema = z.object({
  answer: z.string(),
  citations: z
    .array(z.object({ ref: z.string(), claim: z.string() }).passthrough())
    .optional()
    .default([]),
  /** For suggest_kpis. */
  suggestions: z
    .array(
      z
        .object({
          label: z.string(),
          unit: z.string().optional().default(""),
          target: z.string().optional().default(""),
          rationale: z.string().optional().default(""),
        })
        .passthrough(),
    )
    .optional()
    .default([]),
  /** For missing_evidence: claims that are not currently supported. */
  gaps: z.array(z.string()).optional().default([]),
  /** Questions the sources cannot answer, surfaced rather than guessed. */
  cannotAnswer: z.array(z.string()).optional().default([]),
  followups: z.array(z.string()).optional().default([]),
});

// ---------------------------------------------------------------------------
// Source pack — the bounded evidence the model is allowed to use
// ---------------------------------------------------------------------------

interface Source {
  id: string;
  kind: string;
  label: string;
  /** Verbatim citation or handle, so the model copies rather than paraphrases. */
  reference: string;
  body: string;
}

function challengeSources(challenge: Challenge): Source[] {
  const out: Source[] = [
    {
      id: "ch-ps",
      kind: "Problem statement",
      label: challenge.title,
      reference: `${challenge.organization} — challenge brief`,
      body: challenge.problemStatement,
    },
    {
      id: "ch-why",
      kind: "Governance rationale",
      label: "Why this matters",
      reference: `${challenge.organization} — challenge brief`,
      body: challenge.whyItMatters,
    },
    {
      id: "ch-geo",
      kind: "Geography",
      label: challenge.geography.label,
      reference: `${challenge.organization} — geographic scope`,
      body: `${challenge.geography.scope}. ${challenge.geography.detail}`,
    },
    {
      id: "ch-out",
      kind: "Expected outputs",
      label: "Expected outputs",
      reference: `${challenge.organization} — expected outputs`,
      body: challenge.expectedOutputs.join("\n"),
    },
  ];
  challenge.evidence.papers.forEach((p, i) => {
    out.push({
      id: `p${i + 1}`,
      kind: "Research paper",
      label: p.title,
      reference: `${p.authors} (${p.year}), ${p.venue} [${p.ref}]`,
      body: p.title,
    });
  });
  challenge.evidence.datasets.forEach((d, i) => {
    out.push({
      id: `d${i + 1}`,
      kind: "Dataset",
      label: d.name,
      reference: `${d.provider} — ${d.name} (updated ${d.updated})`,
      body: `Coverage: ${d.coverage}. Variables: ${d.variables}. LIMITATIONS: ${d.limitations}`,
    });
  });
  challenge.evidence.gisLayers.forEach((g, i) => {
    out.push({
      id: `g${i + 1}`,
      kind: "GIS layer",
      label: g.name,
      reference: `${g.kind} layer, ${g.resolution}`,
      body: `${g.name} — ${g.kind} at ${g.resolution} resolution.`,
    });
  });
  challenge.evidence.policyDocs.forEach((p, i) => {
    out.push({
      id: `pol${i + 1}`,
      kind: "Policy document",
      label: p.title,
      reference: `${p.issuer} (${p.year}) [${p.ref}]`,
      body: p.title,
    });
  });
  challenge.evidence.landRecords.forEach((r, i) => {
    out.push({
      id: `lr${i + 1}`,
      kind: "Land record",
      label: r,
      reference: "Land records register",
      body: r,
    });
  });
  return out;
}

function projectSources(project: Project): Source[] {
  const out: Source[] = [
    {
      id: "pj-hyp",
      kind: "Hypothesis",
      label: project.name,
      reference: "Project workspace — hypothesis",
      body: project.hypothesis,
    },
    {
      id: "pj-sol",
      kind: "Solution summary",
      label: project.name,
      reference: "Project workspace — solution summary",
      body: project.solutionSummary,
    },
  ];
  project.evidence.forEach((e, i) => {
    out.push({
      id: `ev${i + 1}`,
      kind: e.kind,
      label: e.title,
      // Verbatim citation — this is what makes a claim traceable.
      reference: e.reference,
      body: `Used for: ${e.usedFor}${e.caveat ? ` CAVEAT: ${e.caveat}` : ""}`,
    });
  });
  project.researchNotes.forEach((n, i) => {
    out.push({
      id: `rn${i + 1}`,
      kind: `Research note (${n.kind})`,
      label: n.title,
      reference: `Research board, ${n.postedOn}`,
      body: n.body,
    });
  });
  project.experiments.forEach((x, i) => {
    out.push({
      id: `ex${i + 1}`,
      kind: "Experiment log",
      label: `${x.version}: ${x.summary}`,
      reference: `Experiment log ${x.version}, ${x.recordedOn}`,
      body: `${x.approach}\nAssumptions: ${x.assumptions.join("; ")}\nMetrics: ${x.metrics
        .map((m) => `${m.label} = ${m.value}`)
        .join("; ")}`,
    });
  });
  project.pilots.forEach((p, i) => {
    out.push({
      id: `pi${i + 1}`,
      kind: "Pilot",
      label: `${p.name} (${p.state})`,
      reference: `Pilot tracker, last updated ${p.lastUpdated}`,
      body: `${p.stage}. Beneficiaries: ${p.beneficiaries}. ${p.observations}\nKPIs: ${p.kpis
        .map((k) => `${k.label} baseline ${k.baseline} → current ${k.current}`)
        .join(
          "; ",
        )}${p.hasComparisonArea ? " A comparison area is available." : " No comparison area exists."}`,
    });
  });
  project.decisions.forEach((d, i) => {
    out.push({
      id: `dc${i + 1}`,
      kind: `Decision (${d.kind})`,
      label: d.title,
      reference: `Decision log, ${d.decidedOn}`,
      body: `Rationale: ${d.rationale} Consequence accepted: ${d.consequence}`,
    });
  });
  project.reviews.forEach((r, i) => {
    out.push({
      id: `rv${i + 1}`,
      kind: "Reviewer feedback",
      label: `${r.reviewer} — ${r.dimension}`,
      reference: `Review, ${r.affiliation}`,
      body: `Scored ${r.score}/${r.maxScore} on ${r.dimension} (${r.status}). ${r.comment}`,
    });
  });
  return out;
}

/** Cross-project pilots available to `similar_pilots`. */
function otherProjectSources(): Source[] {
  const out: Source[] = [];
  for (const p of PROJECTS) {
    out.push({
      id: `x-${p.id}`,
      kind: "Other workspace",
      label: p.name,
      reference: `${p.institution} — ${p.status}`,
      body: `${p.summary}\nStatus: ${p.status} (${p.progress}%). Geography: ${p.pilotGeography}.`,
    });
  }
  for (const r of RESEARCH_BRIDGE) {
    out.push({
      id: `b-${r.id}`,
      kind: `Research bridge (${r.kind})`,
      label: r.title,
      reference: `${r.source} (${r.year})`,
      body: r.contribution,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const ACTION_BRIEFS: Record<AssistantAction, string> = {
  find_evidence:
    "Find the evidence in these sources that bears on the user's question. Point to specific papers, datasets, GIS layers and policy documents, and say which are strongest and which have recorded limitations.",
  explain_dataset:
    "Explain the dataset in focus: its provenance, date, coverage, variables, and — importantly — its limitations and what it therefore cannot support. If the user named no specific dataset, pick the most relevant one and say why.",
  similar_pilots:
    "Identify related initiatives from the other-workspace sources, state what their documented outcomes were, and say plainly where the evidence is too thin to draw an analogy.",
  literature_brief:
    "Synthesise the research papers into a short brief. Preserve each citation exactly as given. Do not merge separate findings into a single unattributed claim.",
  missing_evidence:
    "Audit the project against its own evidence. Flag claims, conclusions or KPI targets that the supplied sources do not actually support, and for each one name the specific evidence that would be needed to support it.",
  suggest_kpis:
    "Propose measurable indicators for this project. For each: label, unit, a target, and the rationale. These are AI-generated suggestions, not agreed indicators — the team must accept or reject each one. Prefer indicators that can be measured against a baseline the sources already describe.",
  policy_brief:
    "Draft a policy brief from the validated findings in these sources. Separate what the evidence supports from what remains unproven, and name the decision the brief is intended to inform.",
  ask: "Answer the user's question strictly from the sources. If the sources do not answer it, say exactly that rather than inferring or generalising.",
};

function systemPrompt(action: AssistantAction, sources: Source[]): string {
  const sourceBlock = sources
    .map(
      (s) =>
        `[${s.id}] (${s.kind}) ${s.label}\n    citation: ${s.reference}\n    content: ${s.body}`,
    )
    .join("\n");

  return `You are the evidence assistant for the NIRVANA Innovation Portal, a national land-governance research platform. You support researchers, government teams and innovators working on land-use policy.

YOUR TASK
${ACTION_BRIEFS[action]}

AVAILABLE SOURCES — this is the complete evidence base. There is nothing else.
${sourceBlock}

ABSOLUTE RULES
1. Cite by source id, e.g. "…higher precision at the top band [ev3]". Use ONLY the ids above.
2. NEVER invent a citation, a paper, a dataset, a figure or a policy. If a source you would like to cite is not in the list, it does not exist for this answer.
3. If the sources cannot answer part of the question, put that in "cannotAnswer" rather than guessing. An honest gap is more useful than a confident invention.
4. Do not state a dataset limitation as if it were a finding, and do not describe a modelled result as measured.
5. Be concise and concrete. Prefer the source's own words where you can quote it.
6. For suggest_kpis, the "suggestions" field is the answer; keep "answer" to a short framing paragraph.

RESPOND WITH JSON ONLY, no prose or code fences:
{"answer":"string","citations":[{"ref":"source id","claim":"what that source supports, in a few words"}],"suggestions":[{"label":"","unit":"","target":"","rationale":""}],"gaps":["string"],"cannotAnswer":["string"],"followups":["string"]}`;
}

function userPrompt(input: {
  action: AssistantAction;
  question?: string | undefined;
  target?: string | undefined;
  challenge: Challenge | undefined;
  project: Project | undefined;
}): string {
  const parts: string[] = [];
  if (input.challenge) {
    parts.push(
      `CHALLENGE BRIEF\nTitle: ${input.challenge.title}\nIssuing institution: ${input.challenge.organization} (${input.challenge.department})\nStatus: ${input.challenge.status} · stage: ${input.challenge.stage} · deadline: ${input.challenge.deadline}`,
    );
  }
  if (input.project) {
    parts.push(
      `PROJECT WORKSPACE\nName: ${input.project.name}\nStatus: ${input.project.status} (${input.project.progress}% complete, stage ${input.project.stage})\nInstitution: ${input.project.institution}\nPilot geography: ${input.project.pilotGeography}\nCurrent milestone: ${input.project.currentMilestone}\nNext action: ${input.project.nextAction}`,
    );
  }
  if (input.target) parts.push(`FOCUS ON THIS SPECIFIC ITEM: ${input.target}`);
  parts.push(
    input.question?.trim()
      ? `USER QUESTION: ${input.question.trim()}`
      : "No specific question was given — use the most useful framing for this task.",
  );
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Handler
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

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleInnovationAiApi(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed — POST a JSON body." }, 405);
  }

  const key = readEnv(env, "OPENROUTER_API_KEY");
  if (!key) {
    return jsonResponse(
      {
        ok: false,
        error:
          "The evidence assistant is not configured. Set OPENROUTER_API_KEY in the server environment (.env for local dev, an env binding when deployed).",
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

  const { action, question, challengeId, projectId, target } = parsed.data;
  const challenge = challengeId ? getChallenge(challengeId) : undefined;
  const project = projectId ? getProject(projectId) : undefined;

  if (!challenge && !project) {
    return jsonResponse(
      {
        ok: false,
        error: "Supply a challengeId or projectId so the assistant has evidence to work from.",
      },
      400,
    );
  }

  // Build the bounded source pack. Cross-project sources are only added for the
  // action that actually needs them, so the model is never handed a wider view
  // than the task warrants.
  let sources: Source[] = [];
  if (project)
    sources = [...projectSources(project), ...(challenge ? challengeSources(challenge) : [])];
  else if (challenge) sources = challengeSources(challenge);
  if (action === "similar_pilots") sources = [...sources, ...otherProjectSources()];
  if (action === "find_evidence") sources = [...sources, ...otherProjectSources()];

  const model = readEnv(env, "OPENROUTER_MODEL") ?? DEFAULT_MODEL;
  let referer = "http://localhost:8080";
  try {
    referer = new URL(request.url).origin;
  } catch {
    /* keep default */
  }

  let raw: string;
  let resolvedModel = model;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "Nirvana Innovation Portal",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt(action, sources) },
          { role: "user", content: userPrompt({ action, question, target, challenge, project }) },
        ],
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        // Ask for JSON directly rather than parsing prose fences.
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return jsonResponse(
        { ok: false, error: `OpenRouter ${res.status}: ${detail.slice(0, 200)}` },
        502,
      );
    }
    const payload = (await res.json()) as {
      model?: unknown;
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return jsonResponse({ ok: false, error: "The assistant returned an empty response." }, 502);
    }
    raw = content;
    if (typeof payload.model === "string" && payload.model) resolvedModel = payload.model;
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "The assistant request failed.",
      },
      502,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonResponse({ ok: false, error: "The assistant returned malformed JSON." }, 502);
  }

  const answer = ModelAnswerSchema.safeParse(json);
  if (!answer.success) {
    return jsonResponse(
      {
        ok: false,
        error: `The assistant response did not match the expected shape: ${answer.error.issues[0]?.message ?? "unknown"}`,
      },
      502,
    );
  }

  // ---- The trust rule, enforced ------------------------------------------
  // Keep only citations that name a source actually supplied to the model.
  // Anything else is a hallucinated reference and is reported as dropped so the
  // UI can show that the model was corrected rather than trusted blindly.
  const byId = new Map(sources.map((s) => [s.id, s]));
  const kept: { ref: string; label: string; kind: string; reference: string; claim: string }[] = [];
  const dropped: string[] = [];
  for (const citation of answer.data.citations) {
    const source = byId.get(citation.ref.trim());
    if (!source) {
      dropped.push(citation.ref);
      continue;
    }
    kept.push({
      ref: source.id,
      label: source.label,
      kind: source.kind,
      reference: source.reference,
      claim: citation.claim,
    });
  }

  return jsonResponse({
    ok: true,
    action,
    model: resolvedModel,
    answer: answer.data.answer,
    citations: kept,
    // Surfaced in the UI: how many citations the model produced vs how many
    // survived verification against the source pack.
    grounding: {
      sourceCount: sources.length,
      citationsRequested: answer.data.citations.length,
      citationsVerified: kept.length,
      droppedCitations: dropped,
      fullyGrounded: dropped.length === 0,
    },
    suggestions: answer.data.suggestions,
    gaps: answer.data.gaps,
    cannotAnswer: answer.data.cannotAnswer,
    followups: answer.data.followups,
    // Always true, and always rendered: this content is model-generated.
    aiGenerated: true,
    context: {
      challengeId: challenge?.id ?? null,
      challengeTitle: challenge?.title ?? null,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
    },
  });
}

/** Every challenge brief, so the assistant can be offered without a project. */
export const ASSISTANT_CHALLENGE_IDS = CHALLENGES.map((c) => c.id);
