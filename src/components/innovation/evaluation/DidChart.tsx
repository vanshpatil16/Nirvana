import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { Chip } from "@/components/innovation/parts";
import { computeDid, type DifferenceInDifferences } from "@/data/innovation";

/**
 * Difference-in-Differences visualisation for a policy experiment (§9).
 *
 * Renders both arms as a small time series with a pre/post divider, and states
 * the derived effect together with the four cell means it came from. When the
 * data cannot support an effect the component says so and refuses to draw one —
 * a blocked experiment must be visible as blocked, because the tempting failure
 * mode here is to show the treated arm's own improvement and let a reader assume
 * it is the causal effect.
 */

const W = 520;
const H = 190;
const PAD = { top: 16, right: 16, bottom: 30, left: 40 };

/** Map a value to a y coordinate, given the axis domain. */
function scaleY(value: number, min: number, max: number): number {
  const span = max - min || 1;
  return PAD.top + (1 - (value - min) / span) * (H - PAD.top - PAD.bottom);
}

function scaleX(i: number, n: number): number {
  const innerW = W - PAD.left - PAD.right;
  return PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
}

export function DidChart({ did }: { did: DifferenceInDifferences }) {
  const result = computeDid(did);
  const n = did.treated.periods.length;
  const all = [...did.treated.values, ...did.control.values].filter((v) => Number.isFinite(v));
  const min = Math.min(...all);
  const max = Math.max(...all);
  // Give the vertical padding some breathing room without distorting the gap.
  const pad = (max - min) * 0.18 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const half = Math.floor(n / 2);

  const path = (values: number[]) =>
    values
      .map((v, i) =>
        Number.isFinite(v) ? `${i === 0 ? "M" : "L"}${scaleX(i, n)} ${scaleY(v, lo, hi)}` : "",
      )
      .filter(Boolean)
      .join(" ");

  const gridValues = [lo, (lo + hi) / 2, hi];

  return (
    <figure className="inno-did">
      <figcaption>
        <strong>{did.outcome}</strong>
        <span>
          {did.treatedLabel} vs {did.controlLabel} · unit: {did.unit}
        </span>
      </figcaption>

      <div className="inno-did-body">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${did.outcome}: difference-in-differences chart`}
        >
          {gridValues.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={scaleY(v, lo, hi)}
                y2={scaleY(v, lo, hi)}
                className="inno-did-grid"
              />
              <text
                x={PAD.left - 6}
                y={scaleY(v, lo, hi) + 3}
                className="inno-did-axis"
                textAnchor="end"
              >
                {Math.round(v)}
              </text>
            </g>
          ))}

          {/* pre/post divider */}
          <line
            x1={scaleX(half - 0.5, n)}
            x2={scaleX(half - 0.5, n)}
            y1={PAD.top - 6}
            y2={H - PAD.bottom}
            className="inno-did-divider"
          />
          <text x={scaleX(half - 0.5, n) + 4} y={PAD.top - 6} className="inno-did-period">
            post-period →
          </text>

          <path d={path(did.treated.values)} className="inno-did-line treated" />
          <path d={path(did.control.values)} className="inno-did-line control" />

          {did.treated.values.map((v, i) =>
            Number.isFinite(v) ? (
              <circle
                key={`t${i}`}
                cx={scaleX(i, n)}
                cy={scaleY(v, lo, hi)}
                r={3.4}
                className="inno-did-dot treated"
              />
            ) : null,
          )}
          {did.control.values.map((v, i) =>
            Number.isFinite(v) ? (
              <circle
                key={`c${i}`}
                cx={scaleX(i, n)}
                cy={scaleY(v, lo, hi)}
                r={3.4}
                className="inno-did-dot control"
              />
            ) : (
              <text
                key={`c${i}`}
                x={scaleX(i, n)}
                y={H - PAD.bottom + 4}
                className="inno-did-missing"
                textAnchor="middle"
              >
                no data
              </text>
            ),
          )}
        </svg>

        <ul className="inno-did-legend">
          <li>
            <i className="treated" /> {did.treatedLabel}
          </li>
          <li>
            <i className="control" /> {did.controlLabel}
          </li>
        </ul>

        <ol className="inno-did-periods">
          {did.treated.periods.map((p, i) => (
            <li key={p} className={i < half ? "pre" : "post"}>
              {p}
            </li>
          ))}
        </ol>
      </div>

      {/* RESULT */}
      {result.computable ? (
        <div className={`inno-did-result ${result.direction ?? "neutral"}`}>
          <div className="inno-did-effect">
            <span>Difference-in-differences effect</span>
            <strong>
              {result.effect !== null && result.effect > 0 ? "+" : ""}
              {result.effect}
              <small> {result.unit}</small>
            </strong>
            <Chip
              tone={
                result.direction === "favourable"
                  ? "green"
                  : result.direction === "adverse"
                    ? "red"
                    : "neutral"
              }
            >
              {result.direction === "favourable"
                ? "Favourable"
                : result.direction === "adverse"
                  ? "Adverse"
                  : "No change"}
            </Chip>
          </div>
          <dl className="inno-did-cells">
            <div>
              <dt>{did.treatedLabel} — change</dt>
              <dd>
                {result.treatedChange !== null && result.treatedChange > 0 ? "+" : ""}
                {result.treatedChange} {result.unit}
              </dd>
              <small>before/after only — not the causal effect</small>
            </div>
            <div>
              <dt>{did.controlLabel} — change</dt>
              <dd>
                {result.controlChange !== null && result.controlChange > 0 ? "+" : ""}
                {result.controlChange} {result.unit}
              </dd>
              <small>general trend, not caused by the intervention</small>
            </div>
            <div>
              <dt>Difference of the two</dt>
              <dd>
                {result.effect} {result.unit}
              </dd>
              <small>the effect attributable to the intervention</small>
            </div>
          </dl>
        </div>
      ) : (
        <div className="inno-did-result blocked">
          <div className="inno-did-effect">
            <span>Difference-in-differences effect</span>
            <strong className="na">Not computable</strong>
            <Chip tone="red">
              <AlertTriangle /> Blocked
            </Chip>
          </div>
          <p className="inno-did-reason">{result.reason}</p>
          {result.treatedChange !== null && (
            <p className="inno-did-caution">
              The treated arm&rsquo;s own change is {result.treatedChange} {result.unit}. That is a
              before/after difference and must <strong>not</strong> be reported as the effect of the
              intervention — without a comparison arm, ordinary improvement is indistinguishable
              from the intervention.
            </p>
          )}
        </div>
      )}

      {/* METHODOLOGY, ALWAYS VISIBLE (§9) */}
      <div className="inno-did-method">
        <h4>
          <FlaskConical /> Method
        </h4>
        <p>{did.method}</p>

        <h4>Assumptions</h4>
        <ul>
          {did.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>

        <h4>Parallel-trend check</h4>
        <p className={did.parallelTrendCheck.passed ? "pass" : "fail"}>
          {did.parallelTrendCheck.passed ? <CheckCircle2 /> : <AlertTriangle />}{" "}
          {did.parallelTrendCheck.note}
        </p>

        <h4>Threats to validity</h4>
        <ul>
          {did.threatsToValidity.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
