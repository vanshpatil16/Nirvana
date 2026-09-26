import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  FileLock2,
  Lock,
  LockOpen,
  Package,
  X,
} from "lucide-react";
import { C, CONTROLS, DID, KPI, PLACEBO_FAILED, PLACEBOS, TREATED_DISTRICTS, TRENDS } from "./data";
import { Chip, Panel, Prov, useTypewriter } from "./ui";

const WIZ = ["Policy details", "Define KPI", "Evaluation design", "Review", "Lock"] as const;

function Field({
  label,
  value,
  locked,
  wide,
}: {
  label: string;
  value: ReactNode;
  locked: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`wf-field ${locked ? "locked" : ""} ${wide ? "wide" : ""}`}>
      <span>
        {label}
        {locked && <Lock size={10} />}
      </span>
      <div>{value}</div>
    </div>
  );
}

/** When the demo registration was locked (kept across chapter navigation). */
let LOCKED_AT: string | null = null;

function stamp() {
  return (
    new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }) + " IST"
  );
}

// ---------------------------------------------------------------------------
// Part A — pre-registration wizard
// ---------------------------------------------------------------------------

function Wizard({
  locked,
  onLock,
  onUnlock,
  onEvaluate,
}: {
  locked: boolean;
  onLock: () => void;
  onUnlock: () => void;
  onEvaluate: () => void;
}) {
  const [step, setStep] = useState(locked ? 4 : 0);
  const [locking, setLocking] = useState(false);
  const [lockedAt, setLockedAt] = useState(() => LOCKED_AT ?? "");
  const hash = useTypewriter(KPI.hashFull, 70, locking);

  const doLock = () => {
    setLocking(true);
    LOCKED_AT = stamp();
    setLockedAt(LOCKED_AT);
  };
  useEffect(() => {
    if (locking && hash === KPI.hashFull) {
      const t = window.setTimeout(() => {
        setLocking(false);
        onLock();
      }, 500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [locking, hash, onLock]);

  const L = locked;
  const content = [
    <div className="wf-form" key="0">
      <Field label="Policy / reform" value={KPI.policy} locked={L} wide />
      <Field label="Owning department" value={KPI.owner} locked={L} />
      <Field label="Linked sandbox run" value="S3 · 5-year horizon" locked={L} />
      <Field
        label="Treated districts (5)"
        value={
          <span className="wf-chips">
            {TREATED_DISTRICTS.map((d) => (
              <Chip key={d} tone="forest">
                {d}
              </Chip>
            ))}
          </span>
        }
        locked={L}
        wide
      />
    </div>,
    <div className="wf-form" key="1">
      <Field label="Indicator" value={KPI.indicator} locked={L} wide />
      <Field label="Baseline" value={<b className="big">{KPI.baseline} days</b>} locked={L} />
      <Field label="Target" value={<b className="big green">{KPI.target} days</b>} locked={L} />
      <Field
        label="Data source"
        value="Mutation register (e-Ferfar) · synthetic panel"
        locked={L}
        wide
      />
    </div>,
    <div className="wf-form" key="2">
      <Field label="Design" value={KPI.design} locked={L} />
      <Field label="Evaluation period" value={KPI.period} locked={L} />
      <Field label="Treated" value={`${KPI.treated} districts`} locked={L} />
      <Field
        label="Matched controls"
        value={`${KPI.control} districts (pre-trend match)`}
        locked={L}
      />
      <Field
        label="Pre-committed checks"
        value={
          <span className="wf-chips">
            <Chip>Parallel trends</Chip>
            <Chip>Placebo tests</Chip>
            <Chip>Robustness</Chip>
          </span>
        }
        locked={L}
        wide
      />
    </div>,
    <div className="wf-review" key="3">
      {[
        ["Policy", KPI.policy],
        ["KPI", `${KPI.indicator} · baseline ${KPI.baseline} d → target ${KPI.target} d`],
        ["Design", `${KPI.design} · ${KPI.treated} treated / ${KPI.control} matched controls`],
        ["Period", KPI.period],
        ["Checks", "Parallel trends · placebo · robustness"],
      ].map(([k, v]) => (
        <div key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
      <p className="dim">
        Once locked, the target and design cannot change without a visible, audited amendment.
      </p>
    </div>,
    <div className="wf-lockstep" key="4">
      <div className={`wf-padlock ${L ? "closed" : locking ? "closing" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 80 96" width="80" height="96">
          <path
            className="shackle"
            d="M22 44 V28 a18 18 0 0 1 36 0 V44"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <rect x="10" y="42" width="60" height="48" rx="12" fill="currentColor" />
          <circle cx="40" cy="62" r="6" fill="#fff" />
          <rect x="37" y="64" width="6" height="12" rx="3" fill="#fff" />
        </svg>
      </div>
      {L ? (
        <>
          <b className="wf-lock-title">Pre-registration locked</b>
          <code className="wf-hash">{KPI.hash}</code>
          <span className="dim">{lockedAt} · immutable · anchored to the evidence ledger</span>
          <div className="wf-lock-actions">
            <button type="button" className="wf-btn primary" onClick={onEvaluate}>
              <BarChart3 size={15} /> Evaluate with 2023–2025 data
            </button>
            <button type="button" className="wf-link" onClick={onUnlock}>
              <LockOpen size={13} /> Reset demo
            </button>
          </div>
        </>
      ) : locking ? (
        <>
          <b className="wf-lock-title">Hashing registration…</b>
          <code className="wf-hash typing">SHA-256: {hash}</code>
        </>
      ) : (
        <>
          <b className="wf-lock-title">Lock the target before seeing any results</b>
          <span className="dim">Targets fixed in advance can’t be moved to fit the outcome.</span>
          <button type="button" className="wf-btn primary lg" onClick={doLock}>
            <FileLock2 size={16} /> Lock pre-registration
          </button>
        </>
      )}
    </div>,
  ];

  return (
    <div className="wf-wizard">
      <ol className="wf-wiz-steps">
        {WIZ.map((w, i) => {
          const st = L || i < step ? "done" : i === step ? "on" : "";
          return (
            <li key={w} className={st}>
              <button type="button" onClick={() => setStep(i)}>
                <span>{st === "done" ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                <b>{w}</b>
                {L && <Lock size={11} className="dim" />}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="wf-wiz-body">
        <div className="wf-wiz-head">
          <span className="wf-eyebrow">
            Step {step + 1} of 5 {L && "· locked"}
          </span>
          <h3>{WIZ[step]}</h3>
        </div>
        <div className="wf-wiz-content" key={step}>
          {step < 4 ? (
            <div className="wf-wiz-grid">
              {content[step]}
              <aside className="wf-wiz-aside">
                <b>Why lock first?</b>
                <ul>
                  <li>
                    <Check size={14} /> The target is fixed before any 2023–2025 data is seen.
                  </li>
                  <li>
                    <Check size={14} /> Controls are chosen on pre-reform trends only.
                  </li>
                  <li>
                    <Check size={14} /> Any later change shows up as an audited amendment.
                  </li>
                </ul>
                <code className="wf-hash">SHA-256 · computed on lock</code>
              </aside>
            </div>
          ) : (
            content[step]
          )}
        </div>
        {step < 4 && (
          <div className="wf-wiz-nav">
            <button
              type="button"
              className="wf-btn ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft size={15} /> Back
            </button>
            <button type="button" className="wf-btn dark" onClick={() => setStep((s) => s + 1)}>
              {step === 3 ? "Continue to lock" : "Next"} <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part B — causal result
// ---------------------------------------------------------------------------

function TrendsChart() {
  const W = 700;
  const H = 250;
  const pad = { l: 40, r: 92, t: 18, b: 30 };
  const n = TRENDS.x.length;
  const X = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + ((32 - v) / (32 - 18)) * (H - pad.t - pad.b);
  const line = (a: number[]) =>
    a.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  // counterfactual for treated: follows the control change after the reform
  const cf = TRENDS.control.map((v, i) =>
    i < TRENDS.reform
      ? null
      : TRENDS.treated[TRENDS.reform]! + (v - TRENDS.control[TRENDS.reform]!),
  );
  const cfPath = cf
    .map((v, i) =>
      v == null ? "" : `${i === TRENDS.reform ? "M" : "L"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`,
    )
    .join(" ");
  const last = n - 1;
  return (
    <svg
      className="wf-trends"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Parallel trends: treated and control move together before the reform, treated falls to 20 days after, control to 28"
    >
      <rect
        x={X(TRENDS.reform)}
        y={pad.t}
        width={X(last) - X(TRENDS.reform)}
        height={H - pad.t - pad.b}
        fill={C.mint}
        opacity="0.55"
      />
      {[20, 24, 28, 32].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke={C.line} />
          <text x={pad.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="10.5" fill={C.faint}>
            {v}
          </text>
        </g>
      ))}
      {TRENDS.x.map((x, i) =>
        i % 2 === 0 ? (
          <text key={x} x={X(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill={C.faint}>
            {x.split(" ")[0]}
          </text>
        ) : null,
      )}
      <line
        x1={X(TRENDS.reform)}
        x2={X(TRENDS.reform)}
        y1={pad.t - 4}
        y2={H - pad.b}
        stroke={C.saffron}
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <text x={X(TRENDS.reform) + 6} y={pad.t + 10} fontSize="10.5" fontWeight="700" fill="#b0650c">
        Reform launched · 2023
      </text>
      <path
        d={line(TRENDS.control)}
        fill="none"
        stroke="#8a978f"
        strokeWidth="2.4"
        className="wf-draw"
      />
      <path
        d={cfPath}
        fill="none"
        stroke={C.forest}
        strokeWidth="1.8"
        strokeDasharray="5 4"
        opacity="0.6"
      />
      <path
        d={line(TRENDS.treated)}
        fill="none"
        stroke={C.forest}
        strokeWidth="3"
        className="wf-draw"
      />
      {TRENDS.treated.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r="3" fill={C.forest} />
      ))}
      {/* effect bracket */}
      <line
        x1={X(last) + 10}
        x2={X(last) + 10}
        y1={Y(cf[last]!)}
        y2={Y(TRENDS.treated[last]!)}
        stroke={C.red}
        strokeWidth="2"
      />
      <line
        x1={X(last) + 5}
        x2={X(last) + 15}
        y1={Y(cf[last]!)}
        y2={Y(cf[last]!)}
        stroke={C.red}
        strokeWidth="2"
      />
      <line
        x1={X(last) + 5}
        x2={X(last) + 15}
        y1={Y(TRENDS.treated[last]!)}
        y2={Y(TRENDS.treated[last]!)}
        stroke={C.red}
        strokeWidth="2"
      />
      <text
        x={X(last) + 20}
        y={(Y(cf[last]!) + Y(TRENDS.treated[last]!)) / 2 + 4}
        fontSize="13"
        fontWeight="800"
        fill={C.red}
      >
        −8 d
      </text>
      <text
        x={X(last) + 20}
        y={Y(TRENDS.control[last]!) - 6}
        fontSize="10.5"
        fontWeight="700"
        fill="#6f7d75"
      >
        Control 28
      </text>
      <text
        x={X(last) + 20}
        y={Y(TRENDS.treated[last]!) + 14}
        fontSize="10.5"
        fontWeight="700"
        fill={C.forest}
      >
        Treated 20
      </text>
    </svg>
  );
}

function Result({ onCapsule }: { onCapsule: () => void }) {
  const [showFail, setShowFail] = useState(false);
  const rows = showFail ? [...PLACEBOS, PLACEBO_FAILED] : PLACEBOS;
  return (
    <div className="wf-result">
      <div className="wf-hero-row">
        <div className="wf-hero naive">
          <span className="k">Before / After says</span>
          <b>
            <s>−10 days</s>
          </b>
          <small>Treated went 30 → 20 — but some of that would have happened anyway.</small>
        </div>
        <div className="wf-hero causal">
          <span className="k">Causal estimate (DiD)</span>
          <b>−8 days</b>
          <small>
            95% CI <strong>[−11, −5]</strong> · against matched controls (30 → 28)
          </small>
        </div>
        <div className="wf-did">
          <span className="k">Difference-in-differences</span>
          <table>
            <tbody>
              <tr>
                <td>Treated</td>
                <td>30 → 20</td>
                <td>−10</td>
              </tr>
              <tr>
                <td>Control</td>
                <td>30 → 28</td>
                <td>−2</td>
              </tr>
              <tr className="eff">
                <td>Effect</td>
                <td />
                <td>−8</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="wf-result-grid">
        <Panel
          eyebrow="Identification"
          title="Parallel pre-trends"
          sub="Median mutation time (days), treated vs matched control"
          right={<Chip tone="green">Parallel trends ✓</Chip>}
        >
          <div className="wf-trend-legend">
            <span>
              <i className="t" />
              Treated (5 districts)
            </span>
            <span>
              <i className="c" />
              Control (5 districts)
            </span>
            <span>
              <i className="cf" />
              Counterfactual
            </span>
          </div>
          <TrendsChart />
        </Panel>
        <Panel
          eyebrow="Control group"
          title="Who counts as “similar”?"
          flush
          right={<Prov kind="synthetic">Synthetic panel</Prov>}
        >
          <table className="wf-table compact">
            <thead>
              <tr>
                <th>District</th>
                <th>Pre-trend sim.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {CONTROLS.map((c) => (
                <tr key={c.district} className={c.ok ? "" : "dimrow"}>
                  <td>
                    <b>{c.district}</b>
                    <small className="block">{c.reason}</small>
                  </td>
                  <td>
                    <span className="wf-bar sim" style={{ ["--w" as string]: `${c.sim * 100}%` }} />
                    {c.sim.toFixed(2)}
                  </td>
                  <td>
                    {c.ok ? (
                      <span className="wf-ok">
                        <Check size={12} strokeWidth={3} /> Selected
                      </span>
                    ) : (
                      <span className="wf-no">
                        <X size={12} strokeWidth={3} /> Rejected
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="wf-result-grid">
        <Panel
          eyebrow="Falsification"
          title="Placebo tests"
          flush
          right={
            <label className="wf-toggle">
              <input
                type="checkbox"
                checked={showFail}
                onChange={(e) => setShowFail(e.target.checked)}
              />
              <span />
              Show a failed example
            </label>
          }
        >
          <table className="wf-table compact">
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.test} className={p.pass ? "" : "failrow"}>
                  <td>{p.test}</td>
                  <td>
                    {p.pass ? (
                      <span className="wf-ok">
                        <Check size={12} strokeWidth={3} /> Passed
                      </span>
                    ) : (
                      <span className="wf-no">
                        <X size={12} strokeWidth={3} /> Failed
                      </span>
                    )}
                  </td>
                  <td className="mono">{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {showFail && (
            <p className="wf-failnote">
              A failed placebo means the claim would not ship — shown here only to demonstrate what
              the check catches.
            </p>
          )}
        </Panel>

        <div className="wf-verdict">
          <span className="wf-eyebrow light">Verdict</span>
          <div className="wf-verdict-main">
            <span className="grade">{DID.grade}</span>
            <div>
              <b>Evidence grade B</b>
              <span>effect ≈ 8 days faster mutation</span>
            </div>
          </div>
          <div className="wf-verdict-checks">
            <span>Parallel trends ✓</span>
            <span>Placebo ✓</span>
            <span>Robustness ✓</span>
          </div>
          <button type="button" className="wf-btn primary block" onClick={onCapsule}>
            <Package size={15} /> Package as Evidence Capsule
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProveScreen({
  head,
  locked,
  onLock,
  onUnlockDemo,
  onCapsule,
}: {
  head: ReactNode;
  locked: boolean;
  onLock: () => void;
  onUnlockDemo: () => void;
  onCapsule: () => void;
}) {
  const [part, setPart] = useState<"A" | "B">(locked ? "B" : "A");
  return (
    <div className="wf-screen">
      {head}
      <div className="wf-prove">
        <div className="wf-parts">
          <button type="button" className={part === "A" ? "on" : ""} onClick={() => setPart("A")}>
            <span>A</span> Pre-register KPI {locked && <Lock size={12} />}
          </button>
          <button
            type="button"
            className={part === "B" ? "on" : ""}
            disabled={!locked}
            onClick={() => setPart("B")}
            title={locked ? "" : "Lock the pre-registration first"}
          >
            <span>B</span> Causal result {!locked && <Lock size={12} />}
          </button>
          <span className="wf-grow" />
          {locked && <code className="wf-hash sm">{KPI.hash}</code>}
        </div>
        {part === "A" ? (
          <Wizard
            locked={locked}
            onLock={onLock}
            onUnlock={() => {
              onUnlockDemo();
            }}
            onEvaluate={() => setPart("B")}
          />
        ) : (
          <Result onCapsule={onCapsule} />
        )}
      </div>
    </div>
  );
}
