import { BookOpen, FileText, Link2, Quote, Target } from "lucide-react";
import {
  EVIDENCE_FLOOR,
  type EvaluationBasis,
  type EvidenceRow,
  type PolicyEvidence,
} from "@/data/policySimulation";
import { num, pluralise } from "../lab-helpers";

/**
 * "What exactly are we evaluating, and on what parameter?"
 *
 * The engine has always known which rule each parameter drives. This renders
 * that knowledge instead of leaving it implicit: the instrument and its clause,
 * the two windows being compared, the units, and then for every parameter the
 * rule it activates, the indicators it moves and the evidence that fixes its
 * value. It is the answer to the question a reader has to ask before a
 * difference in the numbers means anything.
 */

const METHOD_LABEL: Record<string, string> = {
  explicit: "stated in the document",
  derived: "derived from the document",
  inferred: "modelling assumption",
};

export function EvaluationBasisPanel({
  basis,
  kind,
  weakCount,
}: {
  basis: EvaluationBasis;
  kind: "existing" | "new";
  weakCount: number;
}) {
  return (
    <div className="pl-card pl-panel">
      <div className="pl-panel-head">
        <span>
          <Target style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
          What is being evaluated
        </span>
        <span className="pl-tag">{kind === "existing" ? "observed comparison" : "modelled"}</span>
      </div>

      <dl className="pl-kv">
        <div>
          <dt>Instrument</dt>
          <dd>{basis.instrument.name}</dd>
        </div>
        <div>
          <dt>Clause</dt>
          <dd>{basis.instrument.clause}</dd>
        </div>
        {basis.instrument.sourceFile && (
          <div>
            <dt>Source file</dt>
            <dd>
              <FileText style={{ width: 12, height: 12, verticalAlign: "-1px", marginRight: 5 }} />
              {basis.instrument.sourceFile}
            </dd>
          </div>
        )}
        <div>
          <dt>Baseline</dt>
          <dd>
            {basis.baseline.label} ({basis.baseline.from}–{basis.baseline.to})
          </dd>
        </div>
        <div>
          <dt>Compared with</dt>
          <dd>
            {basis.compared.label} ({basis.compared.from}–{basis.compared.to})
          </dd>
        </div>
        <div>
          <dt>Units</dt>
          <dd>
            {pluralise(basis.units.length, "unit")} · {basis.units.filter((u) => u.notified).length}{" "}
            notified by the instrument
          </dd>
        </div>
      </dl>

      <div style={{ marginTop: 14 }}>
        <div className="pl-subhead">
          <span>Parameters driving the result</span>
          <span className="pl-muted">
            {pluralise(basis.parameters.length, "parameter")} ·{" "}
            {weakCount > 0 ? (
              <span className="pl-tag orange">{weakCount} unsourced</span>
            ) : (
              <span className="pl-tag">all cited</span>
            )}
          </span>
        </div>

        {basis.parameters.length === 0 ? (
          <p className="pl-help">
            This instrument declares no adjustable parameters — the comparison is a pure
            before/after of observed values.
          </p>
        ) : (
          <div className="pl-scroll-box" style={{ maxHeight: 420 }}>
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>What it moves</th>
                  <th>Grounding</th>
                </tr>
              </thead>
              <tbody>
                {basis.parameters.map((p) => (
                  <tr key={p.id}>
                    <td className="ind-name">
                      <b>{p.label}</b>
                      <small>{p.group}</small>
                    </td>
                    <td className="num">{p.value}</td>
                    <td style={{ whiteSpace: "normal" }}>
                      <div>{p.rule}</div>
                    </td>
                    <td style={{ whiteSpace: "normal" }}>
                      {p.evidence ? (
                        <EvidenceTag evidence={p.evidence} />
                      ) : (
                        <span className="pl-tag grey">no citation</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** One citation, inline. Compact enough to sit in a table cell. */
export function EvidenceTag({ evidence }: { evidence: PolicyEvidence }) {
  const weak = evidence.confidence < EVIDENCE_FLOOR;
  return (
    <span style={{ display: "block" }}>
      <span className={`pl-tag ${weak ? "orange" : ""}`}>
        <Link2 style={{ width: 10, height: 10, marginRight: 4, verticalAlign: "-1px" }} />
        {evidence.clause}
        {evidence.page > 0 ? ` · p.${evidence.page}` : ""}
      </span>
      <small style={{ display: "block", marginTop: 4, color: "var(--pl-muted)", lineHeight: 1.5 }}>
        {METHOD_LABEL[evidence.method] ?? evidence.method} · {Math.round(evidence.confidence * 100)}
        % confidence
      </small>
    </span>
  );
}

/**
 * The full evidence table.
 *
 * Every claim a run rests on, with the sentence it came from. The point is
 * falsifiability: a reader can open the source document, find the clause, and
 * check whether the quote says what the parameter claims it says.
 */
export function EvidencePanel({ rows, weakCount }: { rows: EvidenceRow[]; weakCount: number }) {
  if (!rows.length) {
    return (
      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>
            <BookOpen style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
            Evidence
          </span>
        </div>
        <p className="pl-help">
          This policy carries no source citation. Upload a policy PDF on the New Policy screen, or
          add one to the library, to get an evidence trail behind each figure.
        </p>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => a.confidence - b.confidence);

  return (
    <div className="pl-card pl-panel">
      <div className="pl-panel-head">
        <span>
          <BookOpen style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
          Evidence — {pluralise(rows.length, "citation")}
        </span>
        {weakCount > 0 ? (
          <span className="pl-tag orange">{weakCount} below the confidence floor</span>
        ) : (
          <span className="pl-tag">all citations read directly</span>
        )}
      </div>

      <p className="pl-help" style={{ marginBottom: 12 }}>
        Weakest citations first. A parameter marked as a modelling assumption carries no textual
        basis in the source document — read the result accordingly.
      </p>

      <div className="pl-scroll">
        <table className="pl-table">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Value</th>
              <th>Clause</th>
              <th>Quoted text</th>
              <th>Grounding</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.parameterId}-${r.clause}-${i}`}>
                <td className="ind-name">
                  <b>{r.parameterLabel}</b>
                  <small>{r.claim}</small>
                </td>
                <td className="num">{r.value}</td>
                <td>
                  <span className="pl-tag grey">
                    {r.clause}
                    {r.page > 0 ? ` · p.${r.page}` : ""}
                  </span>
                </td>
                <td style={{ whiteSpace: "normal", maxWidth: 380 }}>
                  <span style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <Quote
                      style={{ width: 12, height: 12, flexShrink: 0, marginTop: 3, opacity: 0.5 }}
                    />
                    <span style={{ fontStyle: "italic", lineHeight: 1.5 }}>{r.quote}</span>
                  </span>
                </td>
                <td>
                  <span className={`pl-tag ${r.confidence < EVIDENCE_FLOOR ? "orange" : ""}`}>
                    {METHOD_LABEL[r.method] ?? r.method}
                  </span>
                  <small style={{ display: "block", marginTop: 4, color: "var(--pl-muted)" }}>
                    {Math.round(r.confidence * 100)}%
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
