import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  CornerDownRight,
  Database,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { C, FEDERATED_ROWS, GUARDRAIL, NODES, SCHEMA_FIELDS } from "./data";
import { Chip, Panel, Prov, useReveal } from "./ui";

/** A packet travelling along an SVG path (rAF, so it works when mounted late). */
function Packet({
  d,
  color,
  reverse = false,
  dur = 900,
}: {
  d: string;
  color: string;
  reverse?: boolean;
  dur?: number;
}) {
  const ref = useRef<SVGPathElement>(null);
  const [p, setP] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const pt = el.getPointAtLength((reverse ? 1 - e : e) * len);
      setP({ x: pt.x, y: pt.y });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [d, reverse, dur]);
  return (
    <>
      <path ref={ref} d={d} fill="none" stroke="none" />
      {p && <circle cx={p.x} cy={p.y} r="6.5" fill={color} stroke="#fff" strokeWidth="2" />}
    </>
  );
}

/** Router → state nodes → aggregates back. Pure SVG + CSS animation. */
function FederationDiagram({ run }: { run: number }) {
  const phase = useReveal(4, 900, true, run); // 1 plan out · 2 compute · 3 aggregates back · 4 done
  const nodeY = [70, 170, 270];
  return (
    <div className="wf-fed-diagram">
      <svg
        viewBox="0 0 760 340"
        role="img"
        aria-label="Federated router sends the validated plan to state nodes; only aggregates return"
      >
        <defs>
          <linearGradient id="wf-router" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={C.forest} />
            <stop offset="1" stopColor={C.forestDeep} />
          </linearGradient>
          <filter id="wf-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#15281b" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* question in */}
        <g>
          <rect
            x="8"
            y="140"
            width="150"
            height="60"
            rx="14"
            fill="#fff"
            stroke={C.line}
            filter="url(#wf-soft)"
          />
          <text
            x="83"
            y="165"
            textAnchor="middle"
            fontSize="10"
            fontWeight="800"
            letterSpacing="1.2"
            fill={C.muted}
          >
            VALIDATED PLAN
          </text>
          <text
            x="83"
            y="184"
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="700"
            fill={C.ink}
            fontFamily="ui-monospace, monospace"
          >
            landuse_change
          </text>
        </g>
        <path
          d="M158 170 H 214"
          stroke={C.forest}
          strokeWidth="2"
          strokeDasharray="5 5"
          className="wf-flow"
        />

        {/* router */}
        <g>
          <rect
            x="214"
            y="118"
            width="170"
            height="104"
            rx="18"
            fill="url(#wf-router)"
            filter="url(#wf-soft)"
          />
          <text
            x="299"
            y="148"
            textAnchor="middle"
            fontSize="10"
            fontWeight="800"
            letterSpacing="1.4"
            fill={C.forestSoft}
          >
            FEDERATED ROUTER
          </text>
          <text x="299" y="172" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">
            Query in →
          </text>
          <text x="299" y="192" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">
            aggregates out
          </text>
          <text x="299" y="211" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.7)">
            k ≥ 5 enforced at the edge
          </text>
        </g>

        {NODES.map((n, i) => {
          const y = nodeY[i]!;
          const path = `M384 170 C 450 170, 450 ${y}, 516 ${y}`;
          return (
            <g key={n.id} opacity={n.active ? 1 : 0.55}>
              <path d={path} fill="none" stroke={n.active ? C.forest : "#b8bdb2"} strokeWidth="2" />
              {n.active && phase >= 1 && phase < 3 && <Packet d={path} color={C.saffron} />}
              {n.active && phase >= 3 && <Packet d={path} color={C.green} reverse />}
              <rect
                x="516"
                y={y - 38}
                width="236"
                height="76"
                rx="16"
                fill="#fff"
                stroke={n.active ? C.forest : C.line}
                strokeWidth={n.active ? 1.6 : 1}
                filter="url(#wf-soft)"
              />
              <circle cx="548" cy={y} r="17" fill={n.active ? C.mint : "#f2f1ea"} />
              <text
                x="548"
                y={y + 4.5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fill={n.active ? C.forest : C.faint}
              >
                {n.id}
              </text>
              <text x="576" y={y - 8} fontSize="13.5" fontWeight="800" fill={C.ink}>
                {n.name} node
              </text>
              <text x="576" y={y + 9} fontSize="10.5" fill={C.muted}>
                {n.active
                  ? phase >= 2
                    ? "Computed locally · 3 aggregates"
                    : "Receiving plan…"
                  : n.role}
              </text>
              <text
                x="576"
                y={y + 24}
                fontSize="10"
                fontWeight="700"
                fill={n.active ? C.green : C.faint}
              >
                {n.active ? "Records stay in state PostGIS" : "Skipped"}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="wf-fed-counters">
        <div>
          <span>Records moved</span>
          <b>0</b>
        </div>
        <div>
          <span>Aggregates returned</span>
          <b>{phase >= 3 ? 3 : 0}</b>
        </div>
        <div className="amber">
          <span>Cells suppressed (k &lt; 5)</span>
          <b>{phase >= 3 ? 1 : 0}</b>
        </div>
      </div>
    </div>
  );
}

export function ProtectScreen({ head }: { head: ReactNode }) {
  const [run, setRun] = useState(0);
  const [asked, setAsked] = useState(false);
  const shown = useReveal(3, 700, true, run);
  useEffect(() => setAsked(false), [run]);

  return (
    <div className="wf-screen">
      {head}
      <div className="wf-protect">
        <div className="wf-col">
          <Panel
            className="wf-guard"
            eyebrow="Guardrail"
            title="Ask for people, get refused"
            sub="The LLM only writes a plan. The plan is checked against an allow-list before anything runs."
            right={
              <button
                type="button"
                className="wf-btn ghost sm"
                onClick={() => setRun((r) => r + 1)}
              >
                <RotateCcw size={13} /> Replay
              </button>
            }
          >
            {shown >= 1 && (
              <div className="wf-msg user">
                <div className="wf-bubble">{GUARDRAIL.question}</div>
              </div>
            )}
            {shown >= 2 && (
              <div className="wf-reject">
                <div className="wf-reject-head">
                  <span className="ico">
                    <Ban size={16} />
                  </span>
                  <div>
                    <b>Request not allowed</b>
                    <p>
                      Field <code>owner_names</code> is not in the allowed schema. Ask for aggregate
                      statistics instead.
                    </p>
                  </div>
                </div>
                <pre className="wf-json err">
                  <span className="p">{"{ "}</span>
                  <span className="k">"intent"</span>
                  <span className="p">: </span>
                  <span className="s">"parcel_owners"</span>
                  <span className="p">, </span>
                  <span className="k">"fields"</span>
                  <span className="p">: [</span>
                  <span className="bad">"owner_names"</span>
                  <span className="p">] {"}"}</span>
                  {"\n"}
                  <span className="errline">
                    ✗ ValidationError: owner_names ∉ AllowedFields — plan rejected before any query
                    ran
                  </span>
                </pre>
              </div>
            )}
            {shown >= 3 && !asked && (
              <button type="button" className="wf-suggest" onClick={() => setAsked(true)}>
                <CornerDownRight size={14} />
                Try instead: “{GUARDRAIL.rephrase}”
              </button>
            )}
            {asked && (
              <>
                <div className="wf-msg user">
                  <div className="wf-bubble">{GUARDRAIL.rephrase}</div>
                </div>
                <div className="wf-allow">
                  <Sparkles size={14} />
                  <div>
                    <b>Allowed · aggregate query</b>
                    <p>
                      Plan uses <code>village</code>, <code>lulc_class</code>, <code>year</code>{" "}
                      only → routed to the Maharashtra node. Count released because k ≥ 5.
                    </p>
                  </div>
                </div>
              </>
            )}
          </Panel>

          <Panel
            className="wf-schema"
            eyebrow="Allowed schema"
            title="What a plan may ask for"
            right={
              <Chip tone="forest" icon={<Lock size={12} />}>
                Pydantic
              </Chip>
            }
          >
            <ul>
              {SCHEMA_FIELDS.map((f) => (
                <li key={f.field} className={f.allowed ? "ok" : "no"}>
                  {f.allowed ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <X size={13} strokeWidth={3} />
                  )}
                  <code>{f.field}</code>
                  <small>{f.why}</small>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="wf-col">
          <Panel
            className="wf-fed-panel"
            eyebrow="Federation"
            title="The plan travels. The records don't."
            right={<Prov kind="simulated">Simulated nodes</Prov>}
          >
            <FederationDiagram run={run} />
          </Panel>

          <Panel
            className="wf-kanon"
            eyebrow="Federated result · Maharashtra node"
            title="Aggregates only — small cells withheld"
            right={
              <Chip tone="green" icon={<ShieldCheck size={12} />}>
                0 records moved
              </Chip>
            }
            flush
          >
            <table className="wf-table">
              <thead>
                <tr>
                  <th>Village</th>
                  <th>Parcels changed</th>
                  <th>Agri 2019</th>
                  <th>Built-up 2024</th>
                  <th>Released</th>
                </tr>
              </thead>
              <tbody>
                {FEDERATED_ROWS.map((r) => (
                  <tr key={r.village} className={r.suppressed ? "sup" : ""}>
                    <td>
                      <b>{r.village}</b>
                    </td>
                    <td>{r.suppressed ? "< 5" : "≥ 5"}</td>
                    <td>{r.suppressed ? "—" : `${r.agri}%`}</td>
                    <td>{r.suppressed ? "—" : `${r.built}%`}</td>
                    <td>
                      {r.suppressed ? (
                        <span className="wf-sup">
                          <ShieldAlert size={12} /> Suppressed (k &lt; 5)
                        </span>
                      ) : (
                        <span className="wf-ok">
                          <Check size={12} strokeWidth={3} /> Aggregated
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="wf-kanon-foot">
              <Database size={13} />
              Village D had fewer than 5 changed parcels — releasing it could identify a single
              owner, so the cell never leaves the state node.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
