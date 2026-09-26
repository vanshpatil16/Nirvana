import type { ReactNode } from "react";
import { ArrowRight, BookMarked, RotateCcw, Sparkles } from "lucide-react";
import { C, CHAPTERS, type ChapterId, type Lang } from "./data";
import { Panel } from "./ui";

const RESULTS: Record<Exclude<ChapterId, "loop">, { value: string; text: string }> = {
  verify: { value: "82", text: "HIGH-risk parcel in Maan flagged → field check assigned" },
  ask: { value: "B", text: "Hindi question answered with 6 cited sources · RAGAS 0.94" },
  protect: { value: "0", text: "records moved · 1 small cell suppressed (k < 5)" },
  simulate: { value: "312", text: "parcels vetoed by law · smallholders −3% surfaced" },
  prove: { value: "−8 d", text: "causal effect, 95% CI [−11, −5] — not the naive −10" },
  capsule: { value: "✓", text: "EC-PUNE-2026-0042 reproduced with identical output" },
};

const NEXT_QUESTIONS = [
  "Did auto-mutation also reduce land disputes?",
  "Does the effect hold in tribal (73AA) talukas?",
  "Re-score Maan after the field check comes back",
];

export function LoopScreen({
  head,
  lang,
  onRestart,
  onGo,
}: {
  head: ReactNode;
  lang: Lang;
  onRestart: () => void;
  onGo: (c: ChapterId) => void;
}) {
  const steps = CHAPTERS.filter((c) => c.id !== "loop");
  const R = 150;
  const cx = 210;
  const cy = 210;
  return (
    <div className="wf-screen">
      {head}
      <div className="wf-loop">
        <section className="wf-ringbox">
          <svg
            viewBox="0 0 420 420"
            className="wf-ringsvg"
            role="img"
            aria-label="The evidence loop: verify, copilot, protect, simulate, prove, capsule — and back to verify"
          >
            <defs>
              <radialGradient id="wf-core" cx="50%" cy="45%" r="60%">
                <stop offset="0" stopColor={C.forest} />
                <stop offset="1" stopColor={C.forestDeep} />
              </radialGradient>
            </defs>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.line} strokeWidth="2" />
            <circle
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={C.forest}
              strokeWidth="2.5"
              strokeDasharray="6 10"
              className="wf-ring-flow"
            />
            <g className="wf-orbit">
              <circle cx={cx} cy={cy - R} r="7" fill={C.saffron} stroke="#fff" strokeWidth="2.5" />
            </g>
            <circle cx={cx} cy={cy} r="92" fill="url(#wf-core)" />
            <text
              x={cx}
              y={cy - 22}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              letterSpacing="2"
              fill={C.forestSoft}
            >
              THE LOOP
            </text>
            <foreignObject x={cx - 80} y={cy - 12} width="160" height="70">
              <div className="wf-ring-core" lang={lang}>
                {CHAPTERS.find((c) => c.id === "loop")!.title[lang]}
              </div>
            </foreignObject>
            {steps.map((s, i) => {
              const a = -Math.PI / 2 + (i / steps.length) * Math.PI * 2;
              const x = cx + Math.cos(a) * R;
              const y = cy + Math.sin(a) * R;
              return (
                <g
                  key={s.id}
                  className="wf-ring-node"
                  onClick={() => onGo(s.id)}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <circle cx={x} cy={y} r="31" fill="#fff" stroke={C.forest} strokeWidth="2" />
                  <text
                    x={x}
                    y={y - 3}
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="800"
                    fill={C.forest}
                  >
                    {i + 1}
                  </text>
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="800"
                    letterSpacing="0.6"
                    fill={C.ink}
                  >
                    {s.verb.en.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="wf-ring-caption">
            Click any step to revisit it. Each run leaves a capsule behind — the next question
            starts from better evidence.
          </p>
        </section>

        <div className="wf-col">
          <Panel eyebrow="This cycle added" title="Six results, one evidence trail" flush>
            <ol className="wf-recap">
              {steps.map((s, i) => {
                const r = RESULTS[s.id as Exclude<ChapterId, "loop">];
                return (
                  <li key={s.id} onClick={() => onGo(s.id)}>
                    <span className="n">{i + 1}</span>
                    <span className="v">{r.value}</span>
                    <span className="t">
                      <b>{s.verb.en}</b>
                      {r.text}
                    </span>
                    <ArrowRight size={14} className="go" />
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel
            eyebrow="Research gaps opened"
            title="The next cycle starts here"
            right={<BookMarked size={16} color={C.forest} />}
          >
            <div className="wf-nextq">
              {NEXT_QUESTIONS.map((q) => (
                <button key={q} type="button" onClick={onRestart}>
                  <Sparkles size={13} /> {q}
                </button>
              ))}
            </div>
            <button type="button" className="wf-btn primary block lg" onClick={onRestart}>
              <RotateCcw size={16} /> Start the next cycle
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
