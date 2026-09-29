import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  Landmark,
  Map as MapIcon,
  Mic,
  Package,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Database,
} from "lucide-react";
import {
  ANSWER,
  FEDERATED_ROWS,
  LANG_NAME,
  PIPELINE,
  QUERY_PLAN,
  QUESTION,
  SOURCES,
  type Lang,
  type Source,
} from "./data";
import { Chip, Panel, Prov, useReveal, useTypewriter } from "./ui";

// Mini-map: a real 2024 LULC render of the three answer villages (Esri / Impact Observatory)
const MINI = { w: 640, h: 250, west: 73.64, east: 74.07, south: 18.5, north: 18.64 };
const mx = (lon: number) => (lon * Math.PI * 6378137) / 180;
const my = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 6378137;
const MINI_URL = `https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/exportImage?bbox=${mx(MINI.west)},${my(MINI.south)},${mx(MINI.east)},${my(MINI.north)}&bboxSR=3857&imageSR=3857&size=${MINI.w},${MINI.h}&format=png&time=${Date.UTC(2024, 0, 1)},${Date.UTC(2024, 11, 31)}&renderingRule=${encodeURIComponent('{"rasterFunction":"Cartographic Renderer for Visualization and Analysis"}')}&f=image`;
const pos = (lon: number, lat: number) => ({
  left: `${((mx(lon) - mx(MINI.west)) / (mx(MINI.east) - mx(MINI.west))) * 100}%`,
  top: `${(1 - (my(lat) - my(MINI.south)) / (my(MINI.north) - my(MINI.south))) * 100}%`,
});
const PINS = [
  { name: "Maan", lon: 73.705, lat: 18.593 },
  { name: "Baner", lon: 73.787, lat: 18.561 },
  { name: "Wagholi", lon: 73.982, lat: 18.58 },
];

const KIND_ICON: Record<Source["kind"], typeof FileText> = {
  Dataset: Database,
  Act: Scale,
  Report: FileText,
  Records: Landmark,
};

function JsonPlan() {
  const entries = Object.entries(QUERY_PLAN);
  return (
    <pre className="wf-json" aria-label="JSON query plan">
      <span className="p">{"{"}</span>
      {entries.map(([k, v], i) => (
        <span key={k} className="row">
          {"  "}
          <span className="k">"{k}"</span>
          <span className="p">: </span>
          {Array.isArray(v) ? (
            <>
              <span className="p">[</span>
              <span className="n">{v.join(", ")}</span>
              <span className="p">]</span>
            </>
          ) : (
            <span className="s">"{String(v)}"</span>
          )}
          {i < entries.length - 1 && <span className="p">,</span>}
          {"\n"}
        </span>
      ))}
      <span className="p">{"}"}</span>
    </pre>
  );
}

function downloadBrief(lang: Lang) {
  const text = ANSWER[lang].map((s) => (typeof s === "number" ? ` [${s}]` : s)).join("");
  const body = [
    "NIRVANA — Copilot brief (prototype)",
    "",
    `Question (${LANG_NAME[lang]}): ${QUESTION[lang]}`,
    "",
    "Query plan:",
    JSON.stringify(QUERY_PLAN, null, 2),
    "",
    "Answer:",
    text,
    "",
    "Village | Agri 2019 | Built-up 2024",
    ...FEDERATED_ROWS.map((r) =>
      r.suppressed
        ? `${r.village} | suppressed (k < 5) |`
        : `${r.village} | ${r.agri}% | ${r.built}%`,
    ),
    "",
    "Sources:",
    ...SOURCES.map(
      (s) =>
        `[${s.n}] ${s.kind}: ${s.title} — ${s.note}${s.prov === "synthetic" ? " (synthetic)" : ""}`,
    ),
    "",
    "Records moved: 0 · Cells suppressed (k < 5): 1 · RAGAS 0.94 · Evidence grade B",
    "Prototype · Real LULC + synthetic land records. Illustrative — not a legal record.",
  ].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "nirvana-copilot-brief.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export function CopilotScreen({
  head,
  lang,
  onNext,
}: {
  head: ReactNode;
  lang: Lang;
  onNext: () => void;
}) {
  // The demo asks in Hindi by default; the top-bar language switch changes it
  const [qLang, setQLang] = useState<Lang>(lang === "en" ? "hi" : lang);
  useEffect(() => setQLang(lang === "en" ? "hi" : lang), [lang]);

  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<"listen" | "asked">("listen");
  const [hot, setHot] = useState<number | null>(null);
  const [capsule, setCapsule] = useState(false);

  const question = QUESTION[qLang];
  const typed = useTypewriter(question, 34, phase === "listen");
  useEffect(() => {
    setPhase("listen");
    setCapsule(false);
  }, [run, qLang]);
  useEffect(() => {
    if (phase === "listen" && typed === question) {
      const t = window.setTimeout(() => setPhase("asked"), 450);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [typed, question, phase]);

  const steps = useReveal(PIPELINE.length + 1, 520, phase === "asked", `${run}-${qLang}`);
  const answered = steps > PIPELINE.length;

  return (
    <div className="wf-screen">
      {head}
      <div className="wf-ask">
        {/* ---------------- Chat ---------------- */}
        <section className="wf-chat">
          <div className="wf-chat-scroll">
            {phase === "asked" && (
              <div className="wf-msg user">
                <div className="wf-bubble" lang={qLang}>
                  {question}
                </div>
                <span className="wf-msg-meta">
                  <Mic size={11} /> Voice · {LANG_NAME[qLang]} · auto-detected
                </span>
              </div>
            )}

            {phase === "asked" && !answered && (
              <div className="wf-msg bot">
                <span className="wf-bot-ava">
                  <Sparkles size={14} />
                </span>
                <div className="wf-thinking">
                  Planning a safe query
                  <span className="dots" />
                </div>
              </div>
            )}

            {answered && (
              <div className="wf-msg bot">
                <span className="wf-bot-ava">
                  <Sparkles size={14} />
                </span>
                <article className="wf-answer">
                  <header>
                    <span>
                      NIRVANA Copilot · answered in <b>{LANG_NAME[qLang]}</b>
                    </span>
                    <Chip tone="green" icon={<ShieldCheck size={12} />}>
                      Every sentence cited
                    </Chip>
                  </header>
                  <p lang={qLang}>
                    {ANSWER[qLang].map((seg, i) =>
                      typeof seg === "number" ? (
                        <button
                          key={i}
                          type="button"
                          className={`wf-cite ${hot === seg ? "on" : ""}`}
                          onMouseEnter={() => setHot(seg)}
                          onMouseLeave={() => setHot(null)}
                        >
                          {seg}
                        </button>
                      ) : (
                        <span key={i}>{seg}</span>
                      ),
                    )}
                  </p>

                  <div className="wf-answer-grid">
                    <figure className="wf-mini">
                      <img
                        src={MINI_URL}
                        alt="2024 land cover around Maan, Baner and Wagholi"
                        loading="lazy"
                      />
                      {PINS.map((p) => (
                        <span key={p.name} className="wf-pin" style={pos(p.lon, p.lat)}>
                          <i />
                          {p.name}
                        </span>
                      ))}
                      <figcaption>
                        <span>
                          <i style={{ background: "#ed022a" }} />
                          Built-up 2024
                        </span>
                        <span>
                          <i style={{ background: "#ffdb5c" }} />
                          Crops
                        </span>
                        <em>Esri / IO 10 m LULC · real</em>
                      </figcaption>
                    </figure>
                    <table className="wf-table compact">
                      <thead>
                        <tr>
                          <th>Village</th>
                          <th>Agri 2019</th>
                          <th>Built-up 2024</th>
                        </tr>
                      </thead>
                      <tbody>
                        {FEDERATED_ROWS.map((r) => (
                          <tr key={r.village} className={r.suppressed ? "sup" : ""}>
                            <td>{r.village}</td>
                            {r.suppressed ? (
                              <td colSpan={2}>
                                <span className="wf-sup">Suppressed (k &lt; 5)</span>
                              </td>
                            ) : (
                              <>
                                <td>
                                  <span
                                    className="wf-bar agri"
                                    style={{ ["--w" as string]: `${r.agri}%` }}
                                  />
                                  {r.agri}%
                                </td>
                                <td>
                                  <span
                                    className="wf-bar built"
                                    style={{ ["--w" as string]: `${r.built}%` }}
                                  />
                                  {r.built}%
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <footer className="wf-answer-actions">
                    <a className="wf-btn ghost sm" href="/landdifference">
                      <MapIcon size={14} /> Open in map
                    </a>
                    <button
                      type="button"
                      className={`wf-btn sm ${capsule ? "done" : "primary"}`}
                      onClick={() => setCapsule(true)}
                    >
                      {capsule ? <Check size={14} /> : <Package size={14} />}
                      {capsule ? "Capsule EC-PUNE-2026-0041 created" : "Create Evidence Capsule"}
                    </button>
                    <button
                      type="button"
                      className="wf-btn ghost sm"
                      onClick={() => downloadBrief(qLang)}
                    >
                      <Download size={14} /> Download brief
                    </button>
                  </footer>
                </article>
              </div>
            )}

            {answered && (
              <div className="wf-sources">
                <span className="wf-eyebrow">Sources · 6 retrieved</span>
                <div className="wf-sources-row">
                  {SOURCES.map((s) => {
                    const Icon = KIND_ICON[s.kind];
                    return (
                      <div
                        key={s.n}
                        className={`wf-src ${hot === s.n ? "on" : ""}`}
                        onMouseEnter={() => setHot(s.n)}
                        onMouseLeave={() => setHot(null)}
                      >
                        <span className="n">{s.n}</span>
                        <span className="kind">
                          <Icon size={12} /> {s.kind}
                        </span>
                        <b>{s.title}</b>
                        <small>{s.note}</small>
                        {s.prov === "synthetic" && <Prov kind="synthetic" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* composer */}
          <div className={`wf-composer ${phase === "listen" ? "listening" : ""}`}>
            <button
              type="button"
              className="wf-mic"
              onClick={() => setRun((r) => r + 1)}
              aria-label="Ask by voice (replays the demo question)"
            >
              <Mic size={18} />
            </button>
            {phase === "listen" ? (
              <div className="wf-listen">
                <span className="wave" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </span>
                <span className="txt" lang={qLang}>
                  {typed}
                  <span className="caret" />
                </span>
              </div>
            ) : (
              <span className="wf-composer-ph">Ask about land in Pune — by voice or text</span>
            )}
            <div className="wf-seg sm">
              {(["en", "hi", "mr"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={qLang === l ? "on" : ""}
                  onClick={() => setQLang(l)}
                >
                  {l === "en" ? "EN" : l === "hi" ? "हि" : "म"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- How this answer was made ---------------- */}
        <Panel
          className="wf-how"
          eyebrow="Trust chain"
          title="How this answer was made"
          right={
            <button type="button" className="wf-btn ghost sm" onClick={() => setRun((r) => r + 1)}>
              <RotateCcw size={13} /> Replay
            </button>
          }
        >
          <ol className="wf-pipe">
            {PIPELINE.map((p, i) => {
              const state = i < steps ? "done" : i === steps && phase === "asked" ? "run" : "wait";
              return (
                <li key={p.title} className={state}>
                  <span className="wf-pipe-dot">
                    {state === "done" ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="wf-pipe-body">
                    <b>{p.title}</b>
                    {state !== "wait" &&
                      (i === 0 ? (
                        <span className="wf-pipe-detail">
                          → <code>landuse_change</code>
                        </span>
                      ) : i === 1 ? (
                        <JsonPlan />
                      ) : i === 2 ? (
                        <span className="wf-pipe-chips">
                          <Chip tone="green">district ✓</Chip>
                          <Chip tone="green">layers ✓</Chip>
                          <Chip tone="green">years ✓</Chip>
                          <Chip tone="forest" icon={<ShieldCheck size={12} />}>
                            0 AI-written SQL
                          </Chip>
                        </span>
                      ) : i === 3 ? (
                        <span className="wf-pipe-chips">
                          <Chip tone="green">Maharashtra node ✓</Chip>
                          <Chip tone="neutral">Records moved: 0</Chip>
                          <Chip tone="amber">Cells suppressed (k &lt; 5): 1</Chip>
                        </span>
                      ) : i === 4 ? (
                        <span className="wf-pipe-chips">
                          <Chip tone="neutral">BM25</Chip>
                          <Chip tone="neutral">vector</Chip>
                          <Chip tone="neutral">knowledge graph</Chip>
                          <span className="arrow">→ 6 sources</span>
                        </span>
                      ) : (
                        <span className="wf-faith">
                          <span className="meter">
                            <i style={{ width: state === "done" ? "94%" : "0%" }} />
                          </span>
                          <b>0.94</b>
                          <span className="wf-grade">
                            Evidence grade <b>B</b>
                          </span>
                        </span>
                      ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="wf-how-foot">
            <Prov kind="simulated">Scripted replay</Prov>
            <a href="/copilot" className="wf-link">
              Ask the live Copilot on the map <ArrowRight size={13} />
            </a>
          </div>
          {answered && (
            <button type="button" className="wf-btn primary block" onClick={onNext}>
              See how records are protected <ArrowRight size={15} />
            </button>
          )}
        </Panel>
      </div>
    </div>
  );
}
