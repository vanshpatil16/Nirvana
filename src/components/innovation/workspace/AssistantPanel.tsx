import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileSearch,
  FlaskConical,
  Lightbulb,
  ListChecks,
  MapPinned,
  Quote,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { Chip, SectionHead } from "@/components/innovation/parts";
import type { Project } from "@/data/innovation";

/**
 * AI Research Assistant (§8) — questions over project evidence, with citations.
 *
 * Every response is rendered with its verified citations and with the grounding
 * report attached, because the specification's trust rule is that AI must not
 * invent evidence and any factual claim should expose its source. The
 * verification happens server-side (see src/server/innovation-ai.ts); this
 * component's job is to make that visible rather than to re-implement it.
 */

type ActionId =
  | "find_evidence"
  | "explain_dataset"
  | "similar_pilots"
  | "literature_brief"
  | "missing_evidence"
  | "suggest_kpis"
  | "policy_brief"
  | "ask";

interface Citation {
  ref: string;
  label: string;
  kind: string;
  reference: string;
  claim: string;
}

interface AssistantResponse {
  ok: boolean;
  error?: string;
  model?: string;
  answer: string;
  citations: Citation[];
  grounding: {
    sourceCount: number;
    citationsRequested: number;
    citationsVerified: number;
    droppedCitations: string[];
    fullyGrounded: boolean;
  };
  suggestions: { label: string; unit: string; target: string; rationale: string }[];
  gaps: string[];
  cannotAnswer: string[];
  followups: string[];
}

const ACTIONS: { id: ActionId; label: string; hint: string; icon: typeof Sparkles }[] = [
  {
    id: "ask",
    label: "Ask about this project",
    hint: "Free question, answered only from project evidence",
    icon: Sparkles,
  },
  {
    id: "find_evidence",
    label: "Find evidence",
    hint: "Which research, data and policy bears on this",
    icon: FileSearch,
  },
  {
    id: "explain_dataset",
    label: "Explain a dataset",
    hint: "Provenance, coverage, variables and limitations",
    icon: BookOpen,
  },
  {
    id: "similar_pilots",
    label: "Find similar pilots",
    hint: "Related initiatives and their documented outcomes",
    icon: MapPinned,
  },
  {
    id: "literature_brief",
    label: "Build a literature brief",
    hint: "Synthesise the papers, preserving citations",
    icon: Quote,
  },
  {
    id: "missing_evidence",
    label: "Identify missing evidence",
    hint: "Which claims are not currently supported",
    icon: AlertTriangle,
  },
  {
    id: "suggest_kpis",
    label: "Suggest KPIs",
    hint: "Proposed indicators, marked AI-generated",
    icon: Target,
  },
  {
    id: "policy_brief",
    label: "Prepare a policy brief",
    hint: "Turn validated findings into a brief",
    icon: ListChecks,
  },
];

/** Render the assistant's plain-text answer, turning [ref] markers into chips. */
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const byRef = new Map(citations.map((c) => [c.ref, c] as const));
  // Split on citation markers like [ev3] and render each as a superscript chip.
  const parts = text.split(/(\[[a-zA-Z][a-zA-Z0-9_-]*\])/g);
  return (
    <p className="inno-answer">
      {parts.map((part, i) => {
        const match = /^\[([a-zA-Z][a-zA-Z0-9_-]*)\]$/.exec(part);
        if (!match) return <span key={i}>{part}</span>;
        const ref = match[1] ?? "";
        const citation = byRef.get(ref);
        return (
          <span
            key={i}
            className={`inno-cite${citation ? "" : " unverified"}`}
            title={citation ? `${citation.label} — ${citation.reference}` : "Unverified citation"}
          >
            {ref}
          </span>
        );
      })}
    </p>
  );
}

export function AssistantPanel({ project }: { project: Project }) {
  const [action, setAction] = useState<ActionId>("ask");
  const [question, setQuestion] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/innovation/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          projectId: project.id,
          challengeId: project.challengeId,
          question: question.trim() || undefined,
          target: target.trim() || undefined,
        }),
      });
      const data = (await res.json()) as AssistantResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "The assistant is unavailable right now.");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the assistant. Check that the dev server is running.");
    } finally {
      setBusy(false);
    }
  };

  const needsTarget = action === "explain_dataset";

  return (
    <div className="inno-mod">
      <SectionHead
        title="AI Research Assistant"
        description="Questions answered over this project's own evidence. Every citation is verified against the source pack before it reaches this screen."
        action={<Chip tone="blue">AI-generated — verify before use</Chip>}
      />

      <div className="inno-assistant-actions" role="group" aria-label="Assistant capability">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              className={action === a.id ? "active" : ""}
              onClick={() => setAction(a.id)}
              aria-pressed={action === a.id}
              title={a.hint}
            >
              <Icon />
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="inno-assistant-input">
        {needsTarget && (
          <label>
            Dataset or source to explain
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Let the assistant choose the most relevant</option>
              {project.evidence.map((e) => (
                <option key={e.id} value={`${e.title} (${e.kind})`}>
                  {e.title} — {e.kind}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {action === "ask" ? "Your question" : "Focus (optional)"}
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              action === "ask"
                ? "e.g. Why was the top confidence band split, and what evidence supports that?"
                : "e.g. Focus on the Ahmednagar baseline, or leave blank for the general answer"
            }
          />
        </label>
        <button className="portal-btn-primary" onClick={run} disabled={busy}>
          {busy ? "Thinking…" : "Ask the assistant"} <Send />
        </button>
      </div>

      {error && (
        <p className="inno-error" role="alert">
          <AlertTriangle /> {error}
        </p>
      )}

      {result && (
        <div className="inno-assistant-result">
          {/* GROUNDING REPORT — the trust rule, made visible */}
          <div className={`inno-grounding ${result.grounding.fullyGrounded ? "ok" : "warn"}`}>
            {result.grounding.fullyGrounded ? <CheckCircle2 /> : <AlertTriangle />}
            <div>
              <strong>
                {result.grounding.fullyGrounded
                  ? "All citations verified against the project evidence"
                  : `${result.grounding.droppedCitations.length} citation(s) could not be verified and were removed`}
              </strong>
              <small>
                Answered from {result.grounding.sourceCount} sources ·{" "}
                {result.grounding.citationsVerified} of {result.grounding.citationsRequested}{" "}
                citations verified · model {result.model}
              </small>
              {!result.grounding.fullyGrounded && (
                <small>
                  Removed unverified references:{" "}
                  {result.grounding.droppedCitations.map((r) => `[${r}]`).join(", ")}
                </small>
              )}
            </div>
          </div>

          <div className="inno-answer-block">
            <Chip tone="green">
              <Sparkles /> AI-generated
            </Chip>
            <AnswerText text={result.answer} citations={result.citations} />
          </div>

          {result.suggestions.length > 0 && (
            <section>
              <h4>
                Suggested KPIs <Chip tone="gold">AI suggestions — not agreed indicators</Chip>
              </h4>
              <ul className="inno-suggestions">
                {result.suggestions.map((s) => (
                  <li key={s.label}>
                    <div>
                      <strong>{s.label}</strong>
                      {s.unit && <small>unit: {s.unit}</small>}
                      {s.target && <small>target: {s.target}</small>}
                    </div>
                    {s.rationale && <p>{s.rationale}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.gaps.length > 0 && (
            <section>
              <h4>
                <AlertTriangle /> Claims not currently supported
              </h4>
              <ul className="inno-gaplist">
                {result.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </section>
          )}

          {result.cannotAnswer.length > 0 && (
            <section>
              <h4>
                <Lightbulb /> The sources cannot answer these
              </h4>
              <ul className="inno-gaplist">
                {result.cannotAnswer.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="inno-side-note">
                Recorded rather than guessed. Collect this evidence before relying on it.
              </p>
            </section>
          )}

          {result.citations.length > 0 && (
            <section>
              <h4>
                <FlaskConical /> Sources cited ({result.citations.length})
              </h4>
              <ol className="inno-citelist">
                {result.citations.map((c) => (
                  <li key={c.ref}>
                    <span className="inno-cite">{c.ref}</span>
                    <div>
                      <strong>{c.label}</strong>
                      <code className="inno-citation">{c.reference}</code>
                      <small>{c.claim}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {result.followups.length > 0 && (
            <section>
              <h4>Suggested next questions</h4>
              <div className="inno-tags">
                {result.followups.map((f) => (
                  <button key={f} className="inno-chip green" onClick={() => setQuestion(f)}>
                    {f}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
