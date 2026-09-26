import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Bold,
  Check,
  CheckCircle2,
  Cloud,
  FileText,
  Italic,
  Maximize2,
  Minimize2,
  Link2,
  List,
  MessageSquare,
  Quote,
  Sigma,
  Table2,
  X,
} from "lucide-react";
import { researcher } from "@/data/research-hub";
import { LAND_CLASS_ORDER, STATE_AREA_KM2, scenarioFlows, yearShares } from "@/data/land-scenario";
import { LULC_CLASSES } from "@/components/land-difference/lulcRaster";
import { Avatar } from "./ResearchSections";
import satImage from "@/assets/sat_2024.jpg";

/**
 * Live manuscript — a SIMULATED collaborative paper draft.
 * Collaborator cursors, typing, comments and the activity feed are scripted for
 * demonstration; the figure and table are computed from the platform's demo
 * land-use model so they match the rest of the Research Hub.
 */

const STATE = "Maharashtra";
const color = (id: string) => researcher(id)?.color ?? "#66736C";
const first = (id: string) => researcher(id)?.name.split(" ")[0] ?? id;

// Priya writes these sentences into §3 Results, one after another, then the script loops
const TYPED = [
  "Between 2018 and 2024, built-up land within 5 km of the Samruddhi and Mumbai–Pune expressway interchanges grew by 41%, roughly 1.8× the state-wide rate, and 68% of this new built-up area had been classified as cropland in 2018 [4].",
  " Conversion was concentrated in Haveli, Mulshi and Bhiwandi talukas, where non-agricultural permissions rose sharply after the 2017 deemed-conversion amendment [2].",
];

type Activity = { id: number; who: string; text: string; at: number };

const LOOP_MS = 48000;

const SCRIPT: { at: number; who: string; text: string }[] = [
  { at: 1500, who: "rahul", text: "commented on §1 Introduction" },
  { at: 7000, who: "arjun", text: "suggested an edit in §2 Data and methods" },
  { at: 12000, who: "priya", text: "is drafting §3 Results" },
  { at: 19000, who: "aditi", text: "regenerated Figure 1 from the workspace GIS layer" },
];

const SECTIONS: { id: string; title: string; owner: string; done: boolean }[] = [
  { id: "abstract", title: "Abstract", owner: "aditi", done: true },
  { id: "s1", title: "1  Introduction", owner: "rahul", done: true },
  { id: "s2", title: "2  Data and methods", owner: "arjun", done: true },
  { id: "s3", title: "3  Results", owner: "priya", done: false },
  { id: "s4", title: "4  Policy implications", owner: "rahul", done: false },
  { id: "refs", title: "References", owner: "aditi", done: true },
];

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
};

const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
};

function Caret({ who, typing }: { who: string; typing?: boolean }) {
  return (
    <span
      className={`rh-ms-caret${typing ? " typing" : ""}`}
      style={{ "--c": color(who) } as CSSProperties}
      aria-hidden="true"
    >
      <i>{first(who)}</i>
    </span>
  );
}

function Cite({ n }: { n: number }) {
  return <sup className="rh-ms-cite">[{n}]</sup>;
}

export function LiveManuscript() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const userScrolled = useRef(false);
  const [visible, setVisible] = useState(true);
  const [typed, setTyped] = useState(0); // characters of TYPED written so far
  const [elapsed, setElapsed] = useState(0);
  const [feed, setFeed] = useState<Activity[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [suggestion, setSuggestion] = useState<"open" | "accepted" | "rejected">("open");
  const [commentResolved, setCommentResolved] = useState(false);
  const [reply, setReply] = useState("");
  const [replies, setReplies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const full = TYPED.join("");
  const [isFull, setIsFull] = useState(false);
  const [overlay, setOverlay] = useState(false); // fallback when the Fullscreen API is unavailable

  useEffect(() => {
    const sync = () => setIsFull(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOverlay(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [overlay]);

  const toggleFull = async () => {
    if (overlay) return setOverlay(false);
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => undefined);
    const el = root.current;
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // fall through to the overlay
      }
    }
    setOverlay(true);
  };
  const expanded = isFull || overlay;

  // Only animate while the manuscript is on screen
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), {
      threshold: 0.1,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Reduced motion: show the finished state, no typing
  useEffect(() => {
    if (!reduced) return;
    setTyped(full.length);
    setElapsed(30000);
    setFeed(
      SCRIPT.map((s, i) => ({
        id: i,
        who: s.who,
        text: s.text,
        at: Date.now() - (SCRIPT.length - i) * 45000,
      })),
    );
  }, [reduced, full.length]);

  // Scripted clock: drives typing, activity events and the loop
  useEffect(() => {
    if (reduced || !visible) return;
    const tick = window.setInterval(() => {
      setElapsed((e) => (e >= LOOP_MS ? 0 : e + 100));
      setNow(Date.now());
    }, 100);
    return () => window.clearInterval(tick);
  }, [reduced, visible]);

  useEffect(() => {
    if (reduced) return;
    if (elapsed === 0) {
      setTyped(0);
      setFeed([]);
      return;
    }
    // Priya types from 12 s, with a short thinking pause between sentences
    const start = 12000;
    const pauseAt = TYPED[0]!.length;
    if (elapsed >= start) {
      const t = elapsed - start;
      const chars =
        t < pauseAt * 45
          ? t / 45
          : t < pauseAt * 45 + 1800
            ? pauseAt
            : pauseAt + (t - pauseAt * 45 - 1800) / 45;
      const next = Math.min(full.length, Math.floor(chars));
      if (next !== typed) {
        setTyped(next);
        setSaving(true);
      }
    }
    const event = SCRIPT.find((s) => elapsed === s.at);
    if (event) {
      setFeed((f) =>
        [{ id: Date.now(), who: event.who, text: event.text, at: Date.now() }, ...f].slice(0, 6),
      );
    }
    // `typed` is read only to avoid redundant updates; the clock drives this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, reduced, full.length]);

  const startedTyping = typed > 0;
  useEffect(() => {
    const page = pageRef.current;
    const para = liveRef.current;
    if (!startedTyping || !page || !para || userScrolled.current) return;
    const target = para.offsetTop - page.clientHeight * 0.35;
    page.scrollTo({ top: Math.max(0, target), behavior: reduced ? "auto" : "smooth" });
  }, [startedTyping, reduced]);

  // "Saving… / Saved" indicator trails the edits
  useEffect(() => {
    if (!saving) return;
    const t = window.setTimeout(() => setSaving(false), 900);
    return () => window.clearTimeout(t);
  }, [saving, typed]);

  const priyaTyping = !reduced && typed > 0 && typed < full.length;
  const rahulSelecting = reduced || elapsed >= 1500;
  const words = 2418 + full.slice(0, typed).split(/\s+/).filter(Boolean).length;

  // Figure + table from the shared demo land-use model
  const series = useMemo(
    () =>
      ["2018", "2019", "2020", "2021", "2022", "2023", "2024"].map((y) => ({
        y,
        s: yearShares(STATE, y),
      })),
    [],
  );
  const flows = useMemo(() => {
    const a = series[0]!.s,
      b = series[series.length - 1]!.s;
    return scenarioFlows(a, {
      built: b.built - a.built,
      forest: b.forest - a.forest,
      water: b.water - a.water,
      agri: 0,
    })
      .sort((x, y) => y.pp - x.pp)
      .slice(0, 4);
  }, [series]);
  const label = (c: string) => LULC_CLASSES[LAND_CLASS_ORDER.indexOf(c as never)]!.label;
  const area = STATE_AREA_KM2[STATE] ?? 0;
  const builtMax = Math.max(...series.map((d) => d.s.built));

  const presence: { who: string; where: string }[] = [
    { who: "priya", where: priyaTyping ? "typing in §3" : "in §3 Results" },
    { who: "rahul", where: "commenting in §1" },
    { who: "arjun", where: "suggesting in §2" },
    { who: "aditi", where: "you · viewing" },
  ];

  const typedText = full.slice(0, typed);

  return (
    <div
      ref={root}
      className={`rh-ms${expanded ? " rh-ms-full" : ""}${overlay ? " rh-ms-overlay" : ""}`}
      aria-label="Simulated live collaborative manuscript"
    >
      {/* Document chrome */}
      <header className="rh-ms-top">
        <div className="rh-ms-doc">
          <span className="rh-ms-doc-icon">
            <FileText />
          </span>
          <div>
            <strong>Agricultural land transition around Maharashtra&apos;s urban corridors</strong>
            <small>
              Manuscript · Draft v0.6 · Maharashtra Agricultural Land Transition Study ·{" "}
              <span className={`rh-ms-save${saving ? " busy" : ""}`}>
                <Cloud /> {saving ? "Saving…" : "All changes saved"}
              </span>
            </small>
          </div>
        </div>
        <div className="rh-ms-presence">
          {presence.map((p) => (
            <span
              key={p.who}
              className="rh-ms-person"
              title={`${researcher(p.who)?.name} — ${p.where}`}
            >
              <Avatar id={p.who} online />
            </span>
          ))}
          <span className="rh-ms-live">
            <i /> {presence.length} collaborating
          </span>
          <span className="rh-demo">Simulated live demo</span>
          <button
            type="button"
            className="rh-btn sm"
            onClick={() => void toggleFull()}
            aria-pressed={expanded}
            title={expanded ? "Exit full screen (Esc)" : "Open in full screen"}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}{" "}
            {expanded ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </header>
      <div className="rh-ms-toolbar" role="toolbar" aria-label="Formatting (demo)">
        {[Bold, Italic, List, Quote, Link2, Sigma, Table2].map((I, k) => (
          <button key={k} type="button" tabIndex={-1} aria-hidden="true">
            <I />
          </button>
        ))}
        <span className="rh-ms-sep" />
        <span className="rh-ms-mode">Suggesting mode off · Citation style: APA 7</span>
      </div>

      <div className="rh-ms-body">
        {/* Outline */}
        <nav className="rh-ms-outline" aria-label="Manuscript outline">
          <h5>Outline</h5>
          {SECTIONS.map((s) => (
            <div key={s.id} className={`rh-ms-out${s.id === "s3" ? " active" : ""}`}>
              {s.done ? <CheckCircle2 className="ok" /> : <span className="todo" />}
              <span>{s.title}</span>
              <span
                className="rh-ms-owner"
                style={{ background: color(s.owner) }}
                title={researcher(s.owner)?.name}
              >
                {researcher(s.owner)?.initials}
              </span>
            </div>
          ))}
          <div className="rh-ms-stats">
            <div>
              <b>{words.toLocaleString("en-IN")}</b>
              <span>words</span>
            </div>
            <div>
              <b>6</b>
              <span>references</span>
            </div>
            <div>
              <b>2</b>
              <span>figures</span>
            </div>
          </div>
          <div className="rh-ms-target">
            <span>
              Target: <b>Economic &amp; Political Weekly</b>
            </span>
            <div className="rh-progress">
              <span style={{ width: "72%" }} />
            </div>
            <small>72% complete · due 30 Oct</small>
          </div>
        </nav>

        {/* The page */}
        <article
          ref={pageRef}
          className="rh-ms-page"
          onWheel={() => (userScrolled.current = true)}
          onTouchMove={() => (userScrolled.current = true)}
        >
          <div className="rh-ms-running">
            Bhumi-Niti Research Hub · Working paper draft · Not for citation
          </div>
          <h1>
            Agricultural Land Transition around Maharashtra&apos;s Urban Corridors: Evidence from
            Sentinel-2 and Land Records, 2018–2024
          </h1>
          <p className="rh-ms-authors">
            Aditi Kulkarni<sup>1</sup>, Rahul Deshmukh<sup>2</sup>, Priya Iyer<sup>3</sup>, Arjun
            Menon<sup>4</sup>
          </p>
          <p className="rh-ms-affil">
            <sup>1</sup>IIT Bombay · <sup>2</sup>Ministry of Rural Development · <sup>3</sup>IISc
            Bengaluru · <sup>4</sup>Bhumi-Niti GIS Cell
          </p>

          <section className="rh-ms-abstract">
            <h2>Abstract</h2>
            <p>
              Rapid infrastructure investment is reshaping land use on the fringes of
              Maharashtra&apos;s largest cities. We combine annual Sentinel-2 land-cover
              classification with village record-of-rights extracts to measure agricultural land
              conversion along the Mumbai–Pune–Nashik corridors between 2018 and 2024, and assess
              whether conversion regulation has shaped where that change occurs.
            </p>
            <p className="rh-ms-kw">
              <b>Keywords:</b> land-use change, peri-urbanisation, remote sensing, land records,
              Maharashtra
            </p>
          </section>

          <h2>1&nbsp;&nbsp;Introduction</h2>
          <p>
            India&apos;s urban population is projected to approach 600 million by 2036, and the land
            required for that growth is largely drawn from agriculture on metropolitan fringes{" "}
            <Cite n={1} />.{" "}
            <mark
              className={`rh-ms-sel${rahulSelecting && !commentResolved ? " on" : ""}`}
              style={{ "--c": color("rahul") } as CSSProperties}
            >
              Conversion permissions around Pune rose sharply after 2016, yet their spatial pattern
              has not been compared with satellite-observed change
              {rahulSelecting && !commentResolved && <Caret who="rahul" />}
            </mark>{" "}
            <Cite n={2} />. This paper addresses that gap for the state&apos;s three fastest-growing
            corridors.
          </p>

          <h2>2&nbsp;&nbsp;Data and methods</h2>
          <p>
            Land cover was classified annually from cloud-free Sentinel-2 composites at{" "}
            {suggestion === "open" ? (
              <span className="rh-ms-sugg" style={{ "--c": color("arjun") } as CSSProperties}>
                <del>10 m</del>
                <ins>10 m (SWIR bands resampled from 20 m)</ins>
              </span>
            ) : suggestion === "accepted" ? (
              "10 m (SWIR bands resampled from 20 m)"
            ) : (
              "10 m"
            )}{" "}
            resolution and validated against 1,240 field points, reaching 87% overall accuracy{" "}
            <Cite n={3} />. Classified change was intersected with DILRMP record-of-rights extracts
            to link each transition to its recorded land class.
          </p>

          <figure className="rh-ms-fig">
            <div className="rh-ms-fig-grid">
              <div className="rh-ms-fig-map">
                <img
                  src={satImage}
                  alt="Sentinel-2 view of a peri-urban corridor with land-use overlay"
                />
                <span className="tint" />
                <span className="rh-ms-live-tag">
                  <i /> Live-linked to GIS layer
                </span>
              </div>
              <svg
                viewBox="0 0 220 150"
                className="rh-ms-chart"
                role="img"
                aria-label={`Built-up share of ${STATE}, 2018 to 2024`}
              >
                {series.map((d, i) => {
                  const h = (d.s.built / builtMax) * 104;
                  return (
                    <g key={d.y}>
                      <rect
                        x={14 + i * 29}
                        y={120 - h}
                        width={18}
                        height={h}
                        rx={3}
                        fill={i === series.length - 1 ? "#E53935" : "#e8a5a3"}
                      />
                      <text x={23 + i * 29} y={134} textAnchor="middle">{`'${d.y.slice(2)}`}</text>
                    </g>
                  );
                })}
                <text x={14} y={10} className="t">
                  Built-up, % of state area
                </text>
              </svg>
            </div>
            <figcaption>
              <b>Figure 1.</b> Left: Sentinel-2 cloudless mosaic (2024) of the Pune fringe with
              classified built-up expansion. Right: built-up share of {STATE}, 2018–2024 (demo model
              estimates).
            </figcaption>
          </figure>

          <table className="rh-ms-table">
            <caption>
              <b>Table 1.</b> Largest land-use transitions, {STATE}, 2018 → 2024
            </caption>
            <thead>
              <tr>
                <th>Transition</th>
                <th>% of area</th>
                <th>≈ km²</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => (
                <tr key={`${f.from}-${f.to}`}>
                  <td>
                    {label(f.from)} → {label(f.to)}
                  </td>
                  <td>{f.pp.toFixed(2)}</td>
                  <td>{Math.round((f.pp / 100) * area).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>3&nbsp;&nbsp;Results</h2>
          <p ref={liveRef} className="rh-ms-live-para">
            {typedText}
            {(priyaTyping || (typed === 0 && elapsed > 9000)) && (
              <Caret who="priya" typing={priyaTyping} />
            )}
            {typed === 0 && elapsed <= 9000 && (
              <span className="rh-ms-placeholder">Priya is about to start this section…</span>
            )}
          </p>

          <h2 className="muted">4&nbsp;&nbsp;Policy implications</h2>
          <p className="rh-ms-placeholder">
            Assigned to Rahul Deshmukh · drafting starts after results are reviewed
          </p>

          <h2>References</h2>
          <ol className="rh-ms-refs">
            <li>
              United Nations (2018). <i>World Urbanization Prospects: The 2018 Revision.</i>
            </li>
            <li>
              Joshi, M. &amp; Sathe, P. (2023). Peri-urban land markets and farmland loss around
              Pune. Working paper.
            </li>
            <li>
              Krishnan, S. &amp; Balaji, V. (2024). Sentinel-2 land cover mapping for Indian
              smallholder landscapes.
            </li>
            <li>
              Shetty, G. &amp; Qureshi, F. (2024). Infrastructure corridors and land value capture
              in western India.
            </li>
          </ol>
          <div className="rh-ms-pagefoot">Draft — demonstration content · page 1 of 14</div>
        </article>

        {/* Margin: comments, suggestion, activity */}
        <aside className="rh-ms-margin" aria-label="Comments and activity">
          {!commentResolved ? (
            <div
              className={`rh-ms-note${rahulSelecting ? " in" : ""}`}
              style={{ "--c": color("rahul") } as CSSProperties}
            >
              <Head who="rahul" meta="§1 · comment">
                <button type="button" onClick={() => setCommentResolved(true)} title="Resolve">
                  <Check />
                </button>
              </Head>
              <p>
                <span className="rh-mention">@Aditi</span> should we cite the 2023 NA-order dataset
                here? It covers Haveli and Mulshi.
              </p>
              <div className="rh-ms-reply">
                <Head who="aditi" meta="reply" />
                <p>Yes — adding it as [2]; Arjun has the extract.</p>
              </div>
              {replies.map((r, i) => (
                <div key={i} className="rh-ms-reply">
                  <Head who="aditi" meta="just now" />
                  <p>{r}</p>
                </div>
              ))}
              <form
                className="rh-ms-replybox"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  setReplies((r) => [...r, reply.trim()]);
                  setReply("");
                }}
              >
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply…"
                  aria-label="Reply to comment"
                />
              </form>
            </div>
          ) : (
            <div className="rh-ms-note resolved">
              <CheckCircle2 /> Comment resolved
            </div>
          )}

          {suggestion === "open" ? (
            <div className="rh-ms-note in" style={{ "--c": color("arjun") } as CSSProperties}>
              <Head who="arjun" meta="§2 · suggestion" />
              <p>Replace “10 m” with “10 m (SWIR bands resampled from 20 m)”.</p>
              <div className="rh-ms-actions">
                <button
                  type="button"
                  className="rh-btn sm primary"
                  onClick={() => setSuggestion("accepted")}
                >
                  <Check /> Accept
                </button>
                <button
                  type="button"
                  className="rh-btn sm"
                  onClick={() => setSuggestion("rejected")}
                >
                  <X /> Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="rh-ms-note resolved">
              <CheckCircle2 /> Suggestion {suggestion}
            </div>
          )}

          <div className="rh-ms-feed">
            <h5>
              <MessageSquare /> Activity
            </h5>
            {feed.length === 0 && <p className="rh-muted">Waiting for collaborators…</p>}
            {feed.map((a) => (
              <div key={a.id} className="rh-ms-act">
                <Avatar id={a.who} online={false} />
                <p>
                  <b>{first(a.who)}</b> {a.text}
                  <small>{ago(a.at, now)}</small>
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Head({ who, meta, children }: { who: string; meta: string; children?: ReactNode }) {
  return (
    <div className="rh-ms-head">
      <Avatar id={who} online={false} />
      <div>
        <b>{researcher(who)?.name}</b>
        <small>{meta}</small>
      </div>
      {children}
    </div>
  );
}
