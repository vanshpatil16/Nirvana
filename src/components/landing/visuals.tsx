/**
 * Micro-visuals for the seven method panels. Each plays when its panel gains
 * `.is-on` (set by ScrollTrigger); all motion is CSS/SMIL so it costs nothing
 * off-screen. Figures mirror the /workflow demo exactly.
 */

export function VerifyViz() {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="vz vz-verify">
      <div className="vz-card">
        <div className="vz-row">
          <span className="vz-k">Survey 124/2 · Maan</span>
          <span className="vz-pill red">HIGH RISK</span>
        </div>
        <div className="vz-rvr">
          <div>
            <small>Record (7/12)</small>
            <b className="green">Agriculture</b>
          </div>
          <span className="vz-ne">≠</span>
          <div>
            <small>Satellite 2024</small>
            <b className="red">72% built-up</b>
          </div>
        </div>
        <div className="vz-score">
          <svg viewBox="0 0 110 110" width="118" height="118">
            <circle cx="55" cy="55" r={r} fill="none" stroke="#ece7da" strokeWidth="10" />
            <circle
              className="vz-arc"
              cx="55"
              cy="55"
              r={r}
              fill="none"
              stroke="#e0553d"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${0.82 * c} ${c}`}
              transform="rotate(-90 55 55)"
              style={{ ["--c" as string]: c }}
            />
            <text x="55" y="62" textAnchor="middle" fontSize="26" fontWeight="800" fill="#b8402c">
              82
            </text>
          </svg>
          <ul>
            {[
              ["Record vs reality", 40],
              ["Area mismatch", 20],
              ["Owner mismatch", 20],
              ["Mutation staleness", 10],
              ["RCCMS", 10],
            ].map(([k, v], i) => (
              <li key={k}>
                <span>{k}</span>
                <i>
                  <em
                    style={{ width: `${Number(v) * 2.4}%`, transitionDelay: `${0.3 + i * 0.08}s` }}
                  />
                </i>
                <b>{v}%</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CopilotViz() {
  return (
    <div className="vz vz-copilot">
      <div className="vz-bubbles">
        <span lang="hi">2019 से 2024 के बीच पुणे के किन गाँवों में खेती की ज़मीन बदली?</span>
        <span lang="mr">2019 ते 2024 दरम्यान पुण्यातील कोणत्या गावांमध्ये शेतजमीन बदलली?</span>
        <span>Which villages in Pune turned farmland into built-up since 2019?</span>
      </div>
      <pre className="vz-json">
        {[
          ['"intent"', '"landuse_change"'],
          ['"district"', '"Pune"'],
          ['"from_class"', '"agriculture"'],
          ['"to_class"', '"built_up"'],
          ['"years"', "[2019, 2024]"],
          ['"aggregation"', '"village"'],
        ].map(([k, v], i) => (
          <span key={k} style={{ transitionDelay: `${0.2 + i * 0.12}s` }}>
            <i>{k}</i>: <em>{v}</em>
          </span>
        ))}
      </pre>
      <div className="vz-chips">
        <span>district ✓</span>
        <span>years ✓</span>
        <span className="dark">0 AI-written SQL</span>
      </div>
    </div>
  );
}

export function ProtectViz() {
  const nodes = [
    { y: 40, id: "MH", on: true },
    { y: 110, id: "KA", on: false },
    { y: 180, id: "GJ", on: false },
  ];
  return (
    <div className="vz vz-protect">
      <svg viewBox="0 0 360 220" width="100%">
        <rect x="14" y="80" width="108" height="60" rx="14" fill="#0b3d24" />
        <text
          x="68"
          y="106"
          textAnchor="middle"
          fill="#bfe9cf"
          fontSize="9"
          fontWeight="800"
          letterSpacing="1.2"
        >
          ROUTER
        </text>
        <text x="68" y="123" textAnchor="middle" fill="#fff" fontSize="11.5" fontWeight="700">
          plan in → sums out
        </text>
        {nodes.map((n) => {
          const d = `M122 110 C 180 110, 190 ${n.y}, 236 ${n.y}`;
          return (
            <g key={n.id} opacity={n.on ? 1 : 0.4}>
              <path
                d={d}
                fill="none"
                stroke={n.on ? "#0b3d24" : "#b9bfb3"}
                strokeWidth="1.8"
                strokeDasharray="4 5"
                className={n.on ? "vz-flow" : ""}
              />
              {n.on && (
                <>
                  <circle r="5" fill="#e8891d">
                    <animateMotion dur="2.2s" repeatCount="indefinite" path={d} />
                  </circle>
                  <circle r="5" fill="#39c47a">
                    <animateMotion
                      dur="2.2s"
                      begin="1.1s"
                      repeatCount="indefinite"
                      keyPoints="1;0"
                      keyTimes="0;1"
                      calcMode="linear"
                      path={d}
                    />
                  </circle>
                </>
              )}
              <rect
                x="236"
                y={n.y - 24}
                width="112"
                height="48"
                rx="12"
                fill="#fff"
                stroke={n.on ? "#0b3d24" : "#e2ddd0"}
              />
              <text x="254" y={n.y + 4} fill="#0b3d24" fontSize="12" fontWeight="800">
                {n.id}
              </text>
              <text x="276" y={n.y + 4} fill="#5b6d64" fontSize="10">
                {n.on ? "computes locally" : "not in scope"}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="vz-stats">
        <div>
          <b>0</b>
          <span>records moved</span>
        </div>
        <div className="amber">
          <b>1</b>
          <span>cell withheld (k&nbsp;&lt;&nbsp;5)</span>
        </div>
      </div>
    </div>
  );
}

export function SimulateViz() {
  const bars = [
    ["Smallholders", -3],
    ["Large holders", 15],
    ["Tribal areas", 8],
    ["Flood-prone", -5],
  ] as const;
  return (
    <div className="vz vz-sim">
      <div className="vz-sliders">
        {[
          ["Conversion cap", 20],
          ["Flood buffer", 40],
          ["Resurvey coverage", 80],
        ].map(([k, v], i) => (
          <label key={k}>
            <span>{k}</span>
            <i>
              <em style={{ width: `${v}%`, transitionDelay: `${i * 0.12}s` }} />
              <b style={{ left: `${v}%`, transitionDelay: `${i * 0.12}s` }} />
            </i>
          </label>
        ))}
      </div>
      <p className="vz-cap">The average hides who loses</p>
      <div className="vz-diverge">
        {bars.map(([k, v], i) => (
          <div key={k}>
            <span>{k}</span>
            <i>
              <em
                className={v < 0 ? "neg" : "pos"}
                style={{
                  width: `${(Math.abs(v) / 16) * 50}%`,
                  transitionDelay: `${0.35 + i * 0.1}s`,
                }}
              />
            </i>
            <b className={v < 0 ? "neg" : "pos"}>
              {v > 0 ? "+" : "−"}
              {Math.abs(v)}%
            </b>
          </div>
        ))}
      </div>
      <div className="vz-veto">Legal engine vetoed 312 parcels · 73AA · ESZ</div>
    </div>
  );
}

export function ProveViz() {
  const X = (i: number) => 26 + i * 34;
  const Y = (v: number) => 20 + ((31 - v) / 12) * 150;
  const treated = [30.3, 30.1, 30.4, 30.0, 30.0, 27.2, 24.6, 22.4, 21.0, 20.0];
  const control = [30.4, 30.2, 30.3, 30.1, 30.0, 29.6, 29.1, 28.7, 28.3, 28.0];
  const line = (a: number[]) =>
    a.map((v, i) => `${i ? "L" : "M"}${X(i)} ${Y(v).toFixed(1)}`).join(" ");
  return (
    <div className="vz vz-prove">
      <div className="vz-heads">
        <div className="naive">
          <small>Before / after</small>
          <b>
            <s>−10 d</s>
          </b>
        </div>
        <div className="causal">
          <small>Causal (DiD)</small>
          <b>−8 d</b>
          <span>95% CI [−11, −5]</span>
        </div>
      </div>
      <svg viewBox="0 0 360 190" width="100%">
        <rect x={X(4)} y="14" width={X(9) - X(4)} height="160" fill="#e7f5ea" />
        <line x1={X(4)} x2={X(4)} y1="10" y2="176" stroke="#e8891d" strokeDasharray="4 3" />
        <text x={X(4) + 5} y="24" fontSize="9.5" fontWeight="700" fill="#b0650c">
          reform
        </text>
        <path
          className="vz-draw"
          d={line(control)}
          fill="none"
          stroke="#8a978f"
          strokeWidth="2.4"
        />
        <path
          className="vz-draw d2"
          d={line(treated)}
          fill="none"
          stroke="#0b3d24"
          strokeWidth="3"
        />
        <line
          x1={X(9) + 8}
          x2={X(9) + 8}
          y1={Y(28)}
          y2={Y(20)}
          stroke="#e0553d"
          strokeWidth="2"
          className="vz-pop"
        />
        <text
          x={X(9) + 13}
          y={(Y(28) + Y(20)) / 2 + 4}
          fontSize="12"
          fontWeight="800"
          fill="#e0553d"
          className="vz-pop"
        >
          −8
        </text>
      </svg>
    </div>
  );
}

export function CapsuleViz() {
  const lines = [
    "dataset versions ✓   LULC 2024.1 · panel v3",
    "checkout 8f31c0a ✓",
    "re-validate plan ✓",
    "re-estimate DiD ✓   −8.0 d [−11, −5]",
    "placebo suite ✓   3 / 3 passed",
    "sha-256 a3f9…7c21",
  ];
  return (
    <div className="vz vz-capsule">
      <div className="vz-term">
        <header>
          <i />
          <i />
          <i />
          <span>capsule rerun EC-PUNE-2026-0042</span>
        </header>
        <div>
          {lines.map((l, i) => (
            <p key={l} style={{ transitionDelay: `${0.15 + i * 0.22}s` }}>
              {l}
            </p>
          ))}
        </div>
      </div>
      <div className="vz-repro">
        <b>Reproduced ✓</b>
        <span>identical output · hash match</span>
      </div>
    </div>
  );
}

export function LoopViz() {
  const steps = ["Verify", "Ask", "Protect", "Simulate", "Prove", "Capsule"];
  return (
    <div className="vz vz-loop">
      <svg viewBox="0 0 300 300" width="100%">
        <circle cx="150" cy="150" r="104" fill="none" stroke="#dcd6c6" strokeWidth="2" />
        <circle
          cx="150"
          cy="150"
          r="104"
          fill="none"
          stroke="#0b3d24"
          strokeWidth="2.4"
          strokeDasharray="5 9"
          className="vz-flow"
        />
        <g className="vz-orbit">
          <circle cx="150" cy="46" r="7" fill="#e8891d" stroke="#fff" strokeWidth="2.5" />
        </g>
        <circle cx="150" cy="150" r="60" fill="#0b3d24" />
        <text
          x="150"
          y="146"
          textAnchor="middle"
          fill="#bfe9cf"
          fontSize="9"
          fontWeight="800"
          letterSpacing="1.6"
        >
          THE LOOP
        </text>
        <text
          x="150"
          y="165"
          textAnchor="middle"
          fill="#fff"
          fontSize="13"
          fontFamily="Newsreader, Georgia, serif"
        >
          new evidence
        </text>
        {steps.map((s, i) => {
          const a = -Math.PI / 2 + (i / steps.length) * Math.PI * 2;
          const x = 150 + Math.cos(a) * 104;
          const y = 150 + Math.sin(a) * 104;
          return (
            <g key={s} className="vz-node" style={{ transitionDelay: `${i * 0.08}s` }}>
              <circle cx={x} cy={y} r="22" fill="#fff" stroke="#0b3d24" strokeWidth="1.8" />
              <text
                x={x}
                y={y + 3.5}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="800"
                fill="#0b3d24"
              >
                {s.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
