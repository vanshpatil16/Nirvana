import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Lock, MapPin } from "lucide-react";
import logo from "@/assets/logo.png";
import { CHAPTERS, DISTRICT, ROLES, type ChapterId, type Lang, type Role } from "./data";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Reveal `total` items one by one (ms apart) once `start` is true; restarts when `key` changes. */
export function useReveal(total: number, ms: number, start = true, key: unknown = 0) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) {
      setN(0);
      return;
    }
    setN(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= total) window.clearInterval(t);
    }, ms);
    return () => window.clearInterval(t);
  }, [total, ms, start, key]);
  return n;
}

/** Animate a number towards `to` (ease-out). */
export function useCountUp(to: number, ms = 700) {
  const [v, setV] = useState(to);
  const from = useRef(to);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setV(a + (to - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

/** Type out `text` character by character. */
export function useTypewriter(text: string, cps = 38, start = true) {
  const [out, setOut] = useState(start ? "" : text);
  useEffect(() => {
    if (!start) {
      setOut(text);
      return;
    }
    setOut("");
    const chars = Array.from(text);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setOut(chars.slice(0, i).join(""));
      if (i >= chars.length) window.clearInterval(t);
    }, 1000 / cps);
    return () => window.clearInterval(t);
  }, [text, cps, start]);
  return out;
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function Panel({
  title,
  eyebrow,
  sub,
  right,
  children,
  className = "",
  style,
  flush,
}: {
  title?: ReactNode;
  eyebrow?: string;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  flush?: boolean;
}) {
  return (
    <section className={`wf-panel ${className}`} style={style}>
      {(title || right || eyebrow) && (
        <header className="wf-panel-head">
          <div>
            {eyebrow && <span className="wf-eyebrow">{eyebrow}</span>}
            {title && <h3>{title}</h3>}
            {sub && <p>{sub}</p>}
          </div>
          {right && <div className="wf-panel-right">{right}</div>}
        </header>
      )}
      <div className={flush ? "wf-panel-flush" : "wf-panel-body"}>{children}</div>
    </section>
  );
}

export type ProvKind = "real" | "synthetic" | "simulated" | "illustrative" | "model";
const PROV: Record<ProvKind, string> = {
  real: "Real data",
  synthetic: "Synthetic",
  simulated: "Simulated",
  illustrative: "Illustrative",
  model: "Model output",
};

/** Data-honesty tag. */
export function Prov({ kind, children }: { kind: ProvKind; children?: ReactNode }) {
  return (
    <span className={`wf-prov ${kind}`}>
      <i />
      {children ?? PROV[kind]}
    </span>
  );
}

export function Chip({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: "neutral" | "green" | "red" | "amber" | "forest" | "saffron";
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span className={`wf-chip ${tone}`}>
      {icon}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "hi", label: "हिंदी" },
  { id: "mr", label: "मराठी" },
];

export function TopBar({
  lang,
  onLang,
  role,
  onRole,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  role: Role;
  onRole: (r: Role) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = ROLES.find((r) => r.id === role)!;
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <header className="wf-top">
      <a className="wf-brand" href="/">
        <img src={logo} alt="" />
        <span>
          <b>NIRVANA</b>
          <small>Evidence workflow</small>
        </span>
      </a>

      <button className="wf-district" type="button" title="Pilot district">
        <MapPin size={14} />
        <span>{DISTRICT}</span>
        <ChevronDown size={14} className="dim" />
      </button>

      <div className="wf-seg" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={lang === l.id ? "on" : ""}
            onClick={() => onLang(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="wf-grow" />

      <span className="wf-fed" title="Federated query — only aggregates leave a state node">
        <Lock size={13} strokeWidth={2.4} />
        Federated · 0 records moved · k ≥ 5
      </span>

      <div className="wf-role">
        <button
          type="button"
          className="wf-role-btn"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className={`wf-avatar ${role}`}>{meta.initials}</span>
          <span className="wf-role-text">
            <b>{meta.label}</b>
            <small>{meta.focus}</small>
          </span>
          <ChevronDown size={15} className="dim" />
        </button>
        {open && (
          <div className="wf-role-menu" role="menu">
            {ROLES.map((r) => (
              <button
                key={r.id}
                role="menuitem"
                type="button"
                className={r.id === role ? "on" : ""}
                onClick={() => onRole(r.id)}
              >
                <span className={`wf-avatar ${r.id}`}>{r.initials}</span>
                <span>
                  <b>{r.label}</b>
                  <small>{r.focus}</small>
                </span>
                {r.id === role && <Check size={15} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function Rail({
  current,
  onGo,
  lang,
  visited,
}: {
  current: ChapterId;
  onGo: (c: ChapterId) => void;
  lang: Lang;
  visited: Set<ChapterId>;
}) {
  const idx = CHAPTERS.findIndex((c) => c.id === current);
  const pct = (idx / (CHAPTERS.length - 1)) * 100;
  const prev = CHAPTERS[idx - 1];
  const next = CHAPTERS[idx + 1];
  return (
    <nav className="wf-rail" aria-label="Story chapters">
      <button
        type="button"
        className="wf-rail-arrow"
        disabled={!prev}
        onClick={() => prev && onGo(prev.id)}
        aria-label="Previous chapter"
      >
        <ChevronLeft size={18} />
      </button>
      <ol className="wf-rail-track">
        <span className="wf-rail-line" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
        {CHAPTERS.map((c, i) => {
          const state =
            c.id === current ? "active" : i < idx || visited.has(c.id) ? "done" : "todo";
          return (
            <li key={c.id}>
              <button
                type="button"
                data-step={c.id}
                className={`wf-rail-item ${state}`}
                onClick={() => onGo(c.id)}
                aria-current={c.id === current ? "step" : undefined}
              >
                <span className="dot">
                  {state === "done" ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span className="lbl">{c.verb[lang]}</span>
                <span className={`who ${c.role}`}>
                  {ROLES.find((r) => r.id === c.role)!.initials}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="wf-rail-next"
        disabled={!next}
        onClick={() => next && onGo(next.id)}
      >
        {next ? (
          <>
            <span>
              <small>Next</small>
              {next.verb[lang]}
            </span>
            <ChevronRight size={18} />
          </>
        ) : (
          <span className="done-lbl">
            <small>Story</small>complete
          </span>
        )}
      </button>
    </nav>
  );
}

export function ChapterHead({ id, lang, right }: { id: ChapterId; lang: Lang; right?: ReactNode }) {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  const c = CHAPTERS[i]!;
  const role = ROLES.find((r) => r.id === c.role)!;
  return (
    <div className="wf-chead">
      <div>
        <span className="wf-chead-eyebrow">
          Chapter {i + 1} of {CHAPTERS.length} · {c.verb.en.toUpperCase()}
          <span className="sep" />
          <span className={`wf-avatar xs ${c.role}`}>{role.initials}</span>
          {role.label}
          <span className="sep" />
          <Prov kind={c.prov} />
        </span>
        <h1 lang={lang}>{c.title[lang]}</h1>
      </div>
      {right && <div className="wf-chead-right">{right}</div>}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="wf-foot">
      <span className="wf-foot-proto">
        <i />
        Prototype · Real LULC + synthetic land records
      </span>
      <span className="dim">Illustrative — not legal records · screening signals, not rulings</span>
      <span className="wf-grow" />
      <span className="dim kbd">
        <kbd>←</kbd>
        <kbd>→</kbd> chapters
      </span>
      <a href="/copilot">← Main workspace</a>
    </footer>
  );
}
