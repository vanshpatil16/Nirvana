import { useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  EVIDENCE_FLOOR,
  buildDraftPolicy,
  chooseRulePack,
  reviewProvisions,
  type DraftMeta,
  type ExtractionResult,
  type Policy,
  type ReviewedProvision,
} from "@/data/policySimulation";
import { pluralise } from "../lab-helpers";

/**
 * Upload a policy PDF, read it, review what was found, and turn it into a draft
 * policy the engine can run.
 *
 * The review step is the point. Gemini is good at locating a figure and quoting
 * the sentence it came from, and bad at knowing which of a dozen provisions a
 * simulation should respond to. So the model proposes, the table below shows
 * every provision with its clause, page, quote and confidence, and only the rows
 * the user leaves ticked reach the engine. Nothing is applied silently.
 */

const MAX_BYTES = 190 * 1024 * 1024;

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; filename: string }
  | { kind: "sending"; filename: string; mb: number }
  | { kind: "parsing"; filename: string }
  | { kind: "review" }
  | { kind: "error"; message: string; detail?: string | undefined };

const PHASE_COPY: Record<string, string> = {
  reading: "Opening the document",
  sending: "Reading the document",
  parsing: "Finding the provisions",
};

export function PolicyUpload({
  onDraft,
  onToast,
}: {
  onDraft: (policy: Policy, meta: DraftMeta) => void;
  onToast?: ((message: string) => void) | undefined;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [sourceFile, setSourceFile] = useState("");
  const [reviewed, setReviewed] = useState<ReviewedProvision[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase({ kind: "idle" });
    setExtraction(null);
    setMeta(null);
    setReviewed([]);
    setAccepted(new Set());
    setSourceFile("");
  };

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setPhase({ kind: "error", message: "Only PDF files can be read. Pick a .pdf document." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase({
        kind: "error",
        message: `That file is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB — try splitting the document.`,
      });
      return;
    }

    setSourceFile(file.name);
    setPhase({ kind: "reading", filename: file.name });

    try {
      const dataBase64 = await toBase64(file);
      const mb = Math.round((file.size / 1024 / 1024) * 10) / 10;
      setPhase({ kind: "sending", filename: file.name, mb });

      const res = await fetch("/api/policy/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: "application/pdf", dataBase64 }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok: boolean;
        error?: string;
        detail?: unknown;
        extraction?: ExtractionResult;
        model?: string;
        transport?: string;
        repaired?: boolean;
      } | null;

      setPhase({ kind: "parsing", filename: file.name });
      if (!res.ok || !payload?.ok || !payload.extraction) {
        setPhase({
          kind: "error",
          message: payload?.error ?? `The server returned ${res.status}.`,
          detail: Array.isArray(payload?.detail) ? JSON.stringify(payload.detail) : undefined,
        });
        return;
      }

      const found = payload.extraction;
      const { pack } = chooseRulePack(found);
      const rows = reviewProvisions(found, pack);
      // Pre-tick only provisions that feed a value the evaluation responds to,
      // and only where the document supplied the supporting text. Anything else
      // is shown and recorded but left unticked — a ticked control that changes
      // nothing is worse than no control at all.
      const preselected = rows
        .filter((r) => r.disposition === "override" && r.evidence.quote)
        .map((r) => r.key);

      const draftMeta: DraftMeta = {
        acceptedCount: preselected.length,
        sourceFile: file.name,
        readOn: new Date().toISOString().slice(0, 10),
        overallConfidence: found.overallConfidence,
        caveats: found.caveats ?? [],
      };

      setExtraction(found);
      setMeta(draftMeta);
      setReviewed(rows);
      setAccepted(new Set(preselected));
      setPhase({ kind: "review" });
    } catch (error) {
      setPhase({
        kind: "error",
        message: error instanceof Error ? error.message : "The file could not be read.",
      });
    }
  };

  const useDraft = () => {
    if (!extraction || !meta) return;
    const policy = buildDraftPolicy({
      extraction,
      meta,
      acceptedKeys: [...accepted],
      reviewed,
      sourceFile,
    });
    // Report what was actually accepted at the moment of acceptance, not what
    // was pre-ticked on arrival.
    onDraft(policy, { ...meta, acceptedCount: accepted.size });
    onToast?.(
      accepted.size
        ? `Draft ready — ${pluralise(accepted.size, "provision")} carried into the scenario`
        : "Draft ready with the standard parameters only — no provisions were accepted",
    );
  };

  // ---- Busy ---------------------------------------------------------------
  if (phase.kind !== "idle" && phase.kind !== "error" && phase.kind !== "review") {
    return (
      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>Reading policy document</span>
        </div>
        <div className="pl-progress">
          <Loader2 className="spin" />
          <div>
            <b>{PHASE_COPY[phase.kind]}</b>
            <small>
              {phase.filename}
              {phase.kind === "sending" ? ` · ${phase.mb} MB` : ""}
            </small>
          </div>
        </div>
        <ul className="pl-list" style={{ marginTop: 14 }}>
          <li>Large documents and scanned pages are both supported.</li>
          <li>Nothing is used until you accept the provisions on the next screen.</li>
        </ul>
      </div>
    );
  }

  // ---- Review -------------------------------------------------------------
  if (phase.kind === "review" && extraction && meta) {
    const usable = reviewed.filter((r) => accepted.has(r.key));
    const quoted = usable.filter((r) => r.evidence.quote).length;
    const weak = usable.filter((r) => r.evidence.confidence < EVIDENCE_FLOOR).length;
    const wired = reviewed.filter((r) => r.disposition === "override").length;

    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>
              <Sparkles style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
              {extraction.policyName}
            </span>
            <span className={`pl-tag ${meta.overallConfidence >= 0.7 ? "" : "orange"}`}>
              {Math.round(meta.overallConfidence * 100)}% confidence
            </span>
          </div>

          <p className="pl-help" style={{ marginTop: 0 }}>
            {extraction.objective}
          </p>

          <dl className="pl-kv">
            <div>
              <dt>Issuer</dt>
              <dd>{extraction.issuer || "not stated"}</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>{extraction.actYear || "not stated"}</dd>
            </div>
            <div>
              <dt>Enacted</dt>
              <dd>{extraction.enactmentDate || "not stated"}</dd>
            </div>
            <div>
              <dt>In force</dt>
              <dd>{extraction.effectiveDate || "not stated"}</dd>
            </div>
            <div>
              <dt>Notified</dt>
              <dd>{extraction.notificationDate || "not stated"}</dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{extraction.jurisdiction || "not stated"}</dd>
            </div>
            <div>
              <dt>Read on</dt>
              <dd>{meta.readOn}</dd>
            </div>
          </dl>

          {meta.caveats.length > 0 && (
            <div className="pl-note" style={{ marginTop: 12 }}>
              <AlertTriangle />
              <div>
                <b>Before you rely on this</b>
                <ul className="pl-list caution" style={{ marginTop: 6 }}>
                  {meta.caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>
              <BookOpen style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
              Provisions found — {pluralise(reviewed.length, "entry")}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="pl-btn xs ghost"
                onClick={() =>
                  setAccepted(
                    new Set(
                      reviewed
                        .filter((r) => r.disposition === "override" && r.evidence.quote)
                        .map((r) => r.key),
                    ),
                  )
                }
              >
                Reset to wired
              </button>
              <button
                className="pl-btn xs ghost"
                onClick={() =>
                  setAccepted(
                    new Set(reviewed.filter((r) => r.disposition !== "unused").map((r) => r.key)),
                  )
                }
              >
                Accept all
              </button>
              <button className="pl-btn xs ghost" onClick={() => setAccepted(new Set())}>
                Accept none
              </button>
            </div>
          </div>

          <p className="pl-help">
            Each row shows the sentence the figure was read from. Rows already ticked feed a value
            the evaluation responds to. Rows marked{" "}
            <span className="pl-tag orange">new parameter</span> were read from the document but
            nothing in the evaluation uses them — accepting one records it as a citation and adds a
            control, but it will not change an indicator. {quoted} of {usable.length} accepted rows
            carry a verbatim quote
            {weak > 0 && `, and ${weak} sit below the confidence floor`}.
          </p>

          <div className="pl-scroll-box">
            {reviewed.length === 0 ? (
              <div style={{ padding: "18px 4px" }}>
                <p className="pl-help" style={{ margin: 0 }}>
                  <b>No evaluable provision was found in this document.</b> The instrument, its
                  dates and its objective were located and are shown above, but nothing in it sets a
                  figure or restriction this evaluation can use. That is a normal outcome for a
                  document that regulates procedure rather than land. You can still build a scenario
                  from the standard parameters.
                </p>
              </div>
            ) : (
              <>
                <table className="pl-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Provision</th>
                      <th>Value</th>
                      <th>Clause</th>
                      <th>Quoted text</th>
                      <th>Used as</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewed.map((r) => {
                      const on = accepted.has(r.key);
                      const unusable = r.disposition === "unused";
                      return (
                        <tr key={r.key} className={unusable ? "pl-dim" : undefined}>
                          <td style={{ textAlign: "left", width: 34 }}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={unusable}
                              onChange={() =>
                                setAccepted((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(r.key)) next.delete(r.key);
                                  else next.add(r.key);
                                  return next;
                                })
                              }
                              aria-label={`Accept ${r.provision.label}`}
                            />
                          </td>
                          <td className="ind-name">
                            <b>{r.provision.label}</b>
                            <small>
                              {r.provision.isRestriction ? "restriction" : "figure"} ·{" "}
                              {Math.round(r.evidence.confidence * 100)}% confidence
                            </small>
                          </td>
                          <td className="num">
                            {r.provision.value}
                            {r.reconciledLabel && (
                              <small
                                style={{
                                  display: "block",
                                  color: "var(--pl-muted)",
                                  fontWeight: 400,
                                  whiteSpace: "normal",
                                }}
                              >
                                used as {r.reconciledLabel}
                              </small>
                            )}
                            {r.note && (
                              <small
                                style={{
                                  display: "block",
                                  color: "var(--pl-muted)",
                                  fontWeight: 400,
                                  whiteSpace: "normal",
                                  fontStyle: "italic",
                                }}
                              >
                                {r.note}
                              </small>
                            )}
                          </td>
                          <td>
                            <span className="pl-tag grey">
                              {r.provision.clause}
                              {r.provision.page > 0 ? ` · p.${r.provision.page}` : ""}
                            </span>
                          </td>
                          <td style={{ whiteSpace: "normal", maxWidth: 320 }}>
                            {r.evidence.quote ? (
                              <span style={{ fontStyle: "italic", lineHeight: 1.5, opacity: 0.85 }}>
                                “{r.evidence.quote}”
                              </span>
                            ) : (
                              <span className="pl-tag orange">no text located</span>
                            )}
                          </td>
                          <td>
                            {r.disposition === "override" ? (
                              <span className="pl-tag">
                                <CheckCircle2 style={{ width: 10, height: 10, marginRight: 4 }} />
                                {r.targetLabel}
                              </span>
                            ) : r.disposition === "new" ? (
                              <span className="pl-tag orange">new parameter</span>
                            ) : (
                              <span className="pl-tag grey">no figure</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        <div className="pl-cta">
          <button className="pl-btn primary lg" onClick={useDraft}>
            <CheckCircle2 />
            Use these parameters
            <ArrowRightIcon />
          </button>
          <p className="pl-help" style={{ marginTop: 8, marginBottom: 0 }}>
            {usable.length
              ? `${pluralise(usable.length, "provision")} will be carried into the scenario, each with its citation attached.`
              : "No provisions accepted — the scenario will start from the standard parameters."}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
            <button className="pl-btn sm ghost" onClick={reset}>
              <X />
              Read a different document
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Dropzone / error ---------------------------------------------------
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {phase.kind === "error" && (
        <div className="pl-note danger">
          <AlertTriangle />
          <div>
            <b>Could not read that document</b>
            <p style={{ margin: "4px 0 0" }}>{phase.message}</p>
            {phase.detail && (
              <pre
                style={{
                  margin: "8px 0 0",
                  overflowX: "auto",
                  fontSize: 11,
                  opacity: 0.8,
                }}
              >
                {phase.detail}
              </pre>
            )}
          </div>
        </div>
      )}

      <div
        className={`pl-dropzone ${dragging ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <Upload />
        <b>Drop a policy PDF here</b>
        <small>
          An Act, a Rule, a development control regulation, a gazette notification or a sector
          policy. Scanned documents are read as images.
        </small>
        <button className="pl-btn" onClick={() => inputRef.current?.click()}>
          Choose a file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

/** Small inline arrow so the CTA reads as a forward action. */
function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read from disk."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("The file could not be encoded."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}
