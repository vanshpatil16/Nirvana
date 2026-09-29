import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Bot,
  CheckCircle2,
  Compass,
  Database,
  FileText,
  FlaskConical,
  Landmark,
  Layers,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  Plus,
  Quote,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  CASE_STUDIES,
  COLLABORATIONS,
  DATASETS,
  FILTER_TOPICS,
  FOCUS_STATES,
  GAP_LEVELS,
  GAP_MATRIX,
  GAP_THEMES,
  INSTITUTIONS,
  PAPERS,
  POLICIES,
  RESEARCHERS,
  SNAPSHOT,
  WORKSPACE_STAGES,
  datasetById,
  literatureReview,
  paperById,
  policyById,
  researcher,
  searchCatalogue,
  type CaseStudy,
  type Institution,
  type Claim,
  type Dataset,
  type LiteratureReview,
  type Paper,
  type Topic,
  type Workspace,
} from "@/data/research-hub";
import { useHub, type HubView } from "./hub-context";
import { PRESERVATION_ZONE, experimentOutcome, type ExperimentVars } from "./research-model";
import satImage from "@/assets/sat_2024.jpg";
import heroVideo from "@/assets/research_home.mp4";
import heroPoster from "@/assets/research_home_poster.jpg";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

export function Modal({
  title,
  eyebrow,
  onClose,
  wide,
  children,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="rh-overlay rh"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className={`rh-modal${wide ? " wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="rh-modal-head">
          <div>
            {eyebrow && <span className="rh-eyebrow">{eyebrow}</span>}
            <h3>{title}</h3>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="rh-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Avatar({ id, size, online }: { id: string; size?: "lg"; online?: boolean }) {
  const r = researcher(id);
  return (
    <span
      className={`rh-avatar${size ? ` ${size}` : ""}${(online ?? r?.online) ? " online" : ""}`}
      style={{ backgroundColor: r?.color ?? "#66736C" }}
      title={r ? `${r.name} — ${r.institution}` : id}
    >
      {r?.initials ?? id.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Empty({
  icon: Icon = Compass,
  title,
  children,
  action,
}: {
  icon?: typeof Compass;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rh-empty">
      <Icon />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}

export function SourceChips({ claim }: { claim: Claim }) {
  const hub = useHub();
  return (
    <div className="rh-sources">
      {claim.sources.map((s) => {
        const Icon = s.kind === "paper" ? FileText : s.kind === "dataset" ? Database : Landmark;
        return (
          <button
            key={`${s.kind}-${s.id}`}
            className={`rh-source ${s.kind}`}
            onClick={() =>
              s.kind === "paper"
                ? hub.openPaper(s.id)
                : s.kind === "dataset"
                  ? hub.openDataset(s.id)
                  : hub.toast(policyById(s.id)?.title ?? "Policy document")
            }
          >
            <Icon /> {s.label}
          </button>
        );
      })}
    </div>
  );
}

const LIFECYCLE: { label: string; view: HubView; icon: typeof Search }[] = [
  { label: "Discover", view: "discover", icon: Search },
  { label: "Research", view: "my-research", icon: BookOpen },
  { label: "Collaborate", view: "workspaces", icon: Users },
  { label: "Analyze", view: "gis", icon: MapIcon },
  { label: "Simulate", view: "experiments", icon: FlaskConical },
  { label: "Publish", view: "publications", icon: FileText },
  { label: "Inform policy", view: "policy-evidence", icon: Landmark },
];

export function LifecycleStrip({ stage }: { stage: number }) {
  const hub = useHub();
  return (
    <nav className="rh-lifecycle" aria-label="Research lifecycle">
      {LIFECYCLE.map((s, i) => (
        <button
          key={s.label}
          className={i === stage ? "active" : i < stage ? "done" : ""}
          onClick={() => hub.go(s.view)}
          aria-current={i === stage ? "step" : undefined}
        >
          {i < stage ? <CheckCircle2 /> : <s.icon />} {s.label}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Hero video — decorative, muted loop feathered into the hero background
// ---------------------------------------------------------------------------

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  // Respect reduced-motion: show the still poster instead of playing
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setStill(mq.matches);
      const v = ref.current;
      if (!v) return;
      if (mq.matches) v.pause();
      else void v.play().catch(() => undefined);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return (
    <div className="rh-hero-media" aria-hidden="true">
      <video
        ref={ref}
        className="rh-hero-video"
        src={heroVideo}
        poster={heroPoster}
        autoPlay={!still}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        tabIndex={-1}
      />
    </div>
  );
}

export function SnapshotMetrics() {
  return (
    <>
      <div className="rh-metrics">
        {SNAPSHOT.map((m) => (
          <div key={m.label} className="rh-card rh-metric rh-lift">
            <strong>{m.value}</strong>
            <span>{m.label}</span>
            <em>
              <ArrowUp /> {m.trend} <small>{m.note}</small>
            </em>
          </div>
        ))}
      </div>
      <div className="rh-metrics-foot">
        <span className="rh-demo">Platform demonstration data · not official statistics</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Discover: search + results
// ---------------------------------------------------------------------------

export function DiscoverSearch({
  initialQuery = "",
  compact = false,
}: {
  initialQuery?: string;
  compact?: boolean;
}) {
  const hub = useHub();
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [topics, setTopics] = useState<Topic[]>([]);
  const results = useMemo(() => searchCatalogue(submitted, topics), [submitted, topics]);
  const active = submitted.trim().length > 0 || topics.length > 0;
  const example = "How has urban expansion affected agricultural land in Maharashtra?";

  return (
    <div>
      <form
        className="rh-search lg"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query);
        }}
        role="search"
      >
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search research, datasets, policies, case studies, laws…"
          aria-label="Search the knowledge graph"
        />
        <button className="rh-btn primary" type="submit">
          Search
        </button>
      </form>
      <div className="rh-example">
        Try:{" "}
        <button
          type="button"
          onClick={() => {
            setQuery(example);
            setSubmitted(example);
          }}
        >
          {example}
        </button>
      </div>
      <div className="rh-chips" role="group" aria-label="Filter by topic">
        {FILTER_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className={`rh-chip${topics.includes(t) ? " on" : ""}`}
            aria-pressed={topics.includes(t)}
            onClick={() =>
              setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
            }
          >
            {t}
          </button>
        ))}
      </div>

      {active && (
        <div className="rh-results" aria-live="polite">
          <div className="rh-scroll" style={{ "--rh-scroll-h": "760px" } as CSSProperties}>
            <h3>
              Research{" "}
              <span>
                {results.papers.length} result{results.papers.length === 1 ? "" : "s"}
              </span>
            </h3>
            {results.papers.length === 0 && (
              <Empty icon={Search} title="No studies match yet">
                Try fewer filters or a broader phrase.
              </Empty>
            )}
            {results.papers.slice(0, compact ? 3 : 8).map((p, i) => (
              <article
                key={p.id}
                className="rh-card rh-result rh-lift"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="rh-result-meta">
                  <span className="rh-tag blue">{p.type}</span>
                  {p.institution} · {p.year} · {p.states.join(", ")}
                </div>
                <strong>{p.title}</strong>
                <p>{p.finding}</p>
                <div className="rh-result-meta">
                  <button className="rh-btn sm" onClick={() => hub.openPaper(p.id)}>
                    <BookOpen /> Read study
                  </button>
                  <button
                    className="rh-btn sm ghost"
                    onClick={() => hub.addToWorkspace("paper", p.id)}
                  >
                    <Plus /> Add to workspace
                  </button>
                  <span>{p.citations} citations</span>
                </div>
              </article>
            ))}
          </div>
          <div
            className="rh-mini-list rh-scroll"
            style={{ "--rh-scroll-h": "760px" } as CSSProperties}
          >
            <h3>
              Datasets <span>{results.datasets.length}</span>
            </h3>
            {results.datasets.slice(0, 4).map((d, i) => (
              <button
                key={d.id}
                className="rh-card rh-mini rh-lift"
                style={{ animationDelay: `${i * 40}ms`, textAlign: "left", cursor: "pointer" }}
                onClick={() => hub.openDataset(d.id)}
              >
                <Database style={{ color: "#7C5CFC" }} />
                <div>
                  <strong>{d.name}</strong>
                  <small>
                    {d.source} · {d.resolution}
                  </small>
                </div>
              </button>
            ))}
            <h3 style={{ marginTop: 10 }}>
              Policy documents <span>{results.policies.length}</span>
            </h3>
            {results.policies.slice(0, 3).map((g) => (
              <div key={g.id} className="rh-card rh-mini">
                <Landmark style={{ color: "#F59E0B" }} />
                <div>
                  <strong>{g.title}</strong>
                  <small>
                    {g.issuer} · {g.year}
                  </small>
                </div>
              </div>
            ))}
            <h3 style={{ marginTop: 10 }}>
              GIS layers <span>{results.layers.length}</span>
            </h3>
            {results.layers.slice(0, 3).map((l) => (
              <button
                key={l.id}
                className="rh-card rh-mini rh-lift"
                style={{ textAlign: "left", cursor: "pointer" }}
                onClick={() => hub.go("gis")}
              >
                <Layers style={{ color: "#0B7A4B" }} />
                <div>
                  <strong>{l.name}</strong>
                  <small>{l.source}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI literature review
// ---------------------------------------------------------------------------

export function LiteratureReviewPanel() {
  const [q, setQ] = useState(
    "Find research on agricultural land conversion caused by urban expansion in western India.",
  );
  const [review, setReview] = useState<LiteratureReview | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    setReview(null);
    window.setTimeout(() => {
      setReview(literatureReview(q));
      setBusy(false);
    }, 700);
  };
  const maxYear = Math.max(1, ...(review?.byYear.map((y) => y.count) ?? [1]));
  const maxMethod = Math.max(1, ...(review?.methods.map((m) => m.count) ?? [1]));
  return (
    <div className="rh-card" style={{ padding: 22 }}>
      <div className="rh-section-head" style={{ marginBottom: 12 }}>
        <div>
          <span className="rh-eyebrow">
            <BookOpen /> AI Literature Review
          </span>
          <h2 style={{ fontSize: 24 }}>Map a field in seconds — every claim cited</h2>
        </div>
        <span className="rh-demo">Generated from the demo catalogue</span>
      </div>
      <form
        className="rh-search"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <Search />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Literature review topic"
        />
        <button className="rh-btn primary" type="submit" disabled={busy}>
          {busy ? <Loader2 className="rh-spin" /> : <Sparkles />} Review
        </button>
      </form>
      {review &&
        (review.papers.length === 0 ? (
          <div style={{ marginTop: 14 }}>
            <Empty icon={BookOpen} title="No studies found for this topic">
              Broaden the query — this is itself a signal of a research gap.
            </Empty>
          </div>
        ) : (
          <div className="rh-lit">
            <div className="rh-card">
              <h4>Research landscape · {review.papers.length} studies</h4>
              <div className="rh-years" aria-label="Studies by year">
                {review.byYear.map((y) => (
                  <div key={y.year} title={`${y.year}: ${y.count}`}>
                    <b style={{ color: "#17231D" }}>{y.count || ""}</b>
                    <i
                      style={{ height: `${(y.count / maxYear) * 70}%`, minHeight: y.count ? 4 : 0 }}
                    />
                    {y.year}
                  </div>
                ))}
              </div>
              <div className="rh-tags" style={{ marginTop: 10 }}>
                {review.institutions.map((i) => (
                  <span key={i.name} className="rh-tag">
                    {i.name} · {i.count}
                  </span>
                ))}
              </div>
            </div>
            <div className="rh-card">
              <h4>Methods used</h4>
              <div className="rh-bars">
                {review.methods.map((m) => (
                  <div key={m.name} className="rh-bar">
                    <span>{m.name}</span>
                    <i style={{ width: `${(m.count / maxMethod) * 100}%` }} />
                    <b>{m.count}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="rh-card wide">
              <h4>Key findings</h4>
              <div className="rh-claims" style={{ marginTop: 0 }}>
                {review.findings.map((c, i) => (
                  <div key={i} className="rh-claim">
                    {c.text}
                    <SourceChips claim={c} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rh-card">
              <h4>Contradictory findings</h4>
              {review.contradictions.length ? (
                review.contradictions.map((c, i) => (
                  <div key={i} className="rh-claim">
                    {c.text}
                    <SourceChips claim={c} />
                  </div>
                ))
              ) : (
                <p className="rh-muted" style={{ margin: 0, fontSize: 13 }}>
                  No contradicting studies in this set.
                </p>
              )}
            </div>
            <div className="rh-card">
              <h4>Research gaps</h4>
              {review.gaps.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                  {review.gaps.map((g) => (
                    <li key={`${g.theme}-${g.state}`}>
                      <b>{g.theme}</b> in {g.state} — {GAP_LEVELS[g.level]!.label.toLowerCase()}{" "}
                      <span className="rh-muted">(Gap matrix)</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rh-muted" style={{ margin: 0, fontSize: 13 }}>
                  No major gaps for these states.
                </p>
              )}
            </div>
            <div className="rh-card wide">
              <h4>Datasets used across these studies</h4>
              <div className="rh-tags">
                {review.datasets.map((d) => (
                  <span key={d.id} className="rh-tag purple">
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Research cards
// ---------------------------------------------------------------------------

const TYPE_COLOR: Record<Paper["type"], string> = {
  "Journal article": "#3B82F6",
  "Working paper": "#0B7A4B",
  "Government report": "#F59E0B",
  Thesis: "#7C5CFC",
  "Policy brief": "#075B3A",
  "Case study": "#E34D4D",
};

export function PaperCard({ paper }: { paper: Paper }) {
  const hub = useHub();
  const saved = hub.saved.includes(paper.id);
  return (
    <article className="rh-card rh-paper rh-lift">
      <div className="rh-paper-top" style={{ backgroundColor: TYPE_COLOR[paper.type] }} />
      <div className="rh-paper-body">
        <div className="rh-paper-type">
          <span>{paper.type}</span>
          <button
            className="rh-btn ghost sm"
            style={{ minHeight: 26, padding: "0 6px" }}
            onClick={() => hub.toggleSaved(paper.id)}
            aria-pressed={saved}
            aria-label={saved ? "Remove from My Research" : "Save to My Research"}
          >
            {saved ? <BookmarkCheck style={{ color: "#075B3A" }} /> : <Bookmark />}
          </button>
        </div>
        <h3>{paper.title}</h3>
        <div className="rh-paper-meta">
          <b>{paper.institution}</b> · {paper.year}
          <br />
          {paper.authors.join(", ")}
          <br />
          {paper.states.length > 3 ? `${paper.states.length} states` : paper.states.join(", ")}
        </div>
        <div className="rh-tags">
          {paper.topics.slice(0, 3).map((t) => (
            <span key={t} className="rh-tag">
              {t}
            </span>
          ))}
        </div>
        <div className="rh-paper-stats">
          <span>
            <Quote /> {paper.citations} citations
          </span>
          <span>
            <Database /> {paper.datasetIds.length} datasets
          </span>
        </div>
      </div>
      <div className="rh-paper-actions">
        <button className="rh-btn sm primary" onClick={() => hub.openPaper(paper.id)}>
          Read study
        </button>
        <button className="rh-btn sm" onClick={() => hub.openDataset(paper.datasetIds[0] ?? "d1")}>
          Explore data
        </button>
        <button
          className="rh-btn sm ghost"
          onClick={() => hub.addToWorkspace("paper", paper.id)}
          aria-label="Add to workspace"
          title="Add to workspace"
        >
          <Plus /> Add
        </button>
      </div>
    </article>
  );
}

export function PaperDetail({ paper }: { paper: Paper }) {
  const hub = useHub();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="rh-paper-meta" style={{ fontSize: 13 }}>
        <b>{paper.authors.join(", ")}</b> · {paper.institution} · {paper.year} ·{" "}
        {paper.states.join(", ")}
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{paper.abstract}</p>
      <div className="rh-card rh-insight">
        <span className="rh-insight-label">Key finding</span>
        <blockquote style={{ fontSize: 18 }}>{paper.finding}</blockquote>
      </div>
      <div>
        <h4
          className="rh-muted"
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          Methods
        </h4>
        <div className="rh-tags">
          {paper.methods.map((m) => (
            <span key={m} className="rh-tag blue">
              {m}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h4
          className="rh-muted"
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          Datasets used
        </h4>
        <div className="rh-mini-list">
          {paper.datasetIds
            .map((id) => datasetById(id))
            .filter(Boolean)
            .map((d) => (
              <button
                key={d!.id}
                className="rh-card rh-mini rh-lift"
                style={{ textAlign: "left", cursor: "pointer" }}
                onClick={() => hub.openDataset(d!.id)}
              >
                <Database style={{ color: "#7C5CFC" }} />
                <div>
                  <strong>{d!.name}</strong>
                  <small>
                    {d!.source} · {d!.resolution}
                  </small>
                </div>
              </button>
            ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="rh-btn primary" onClick={() => hub.addToWorkspace("paper", paper.id)}>
          <Plus /> Add to workspace
        </button>
        <button className="rh-btn" onClick={() => hub.toggleSaved(paper.id)}>
          {hub.saved.includes(paper.id) ? <BookmarkCheck /> : <Bookmark />}{" "}
          {hub.saved.includes(paper.id) ? "Saved" : "Save"}
        </button>
        <span className="rh-demo" style={{ alignSelf: "center" }}>
          Demonstration record — not a real publication
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace cards
// ---------------------------------------------------------------------------

export function StageBar({ stage }: { stage: number }) {
  return (
    <div className="rh-stages" aria-label={`Stage: ${WORKSPACE_STAGES[stage]}`}>
      {WORKSPACE_STAGES.map((s, i) => (
        <span key={s} className={i < stage ? "done" : i === stage ? "current" : ""} title={s}>
          {s}
        </span>
      ))}
    </div>
  );
}

const statusClass = (s: Workspace["status"]) =>
  s === "Active" ? "active" : s === "In review" ? "review" : "planning";

export function WorkspaceCard({ ws }: { ws: Workspace }) {
  const hub = useHub();
  return (
    <article className="rh-card rh-ws rh-lift">
      <div className="rh-ws-top">
        <span className={`rh-status ${statusClass(ws.status)}`}>{ws.status}</span>
        <div className="rh-avatars">
          {ws.members.slice(0, 5).map((m) => (
            <Avatar key={m} id={m} />
          ))}
          {ws.members.length > 5 && (
            <span className="rh-muted" style={{ marginLeft: 6, fontSize: 12 }}>
              +{ws.members.length - 5}
            </span>
          )}
        </div>
      </div>
      <h3>{ws.title}</h3>
      <div className="rh-ws-inst">{ws.institutions.join(" × ")}</div>
      <div>
        <div className="rh-ws-row" style={{ marginBottom: 6 }}>
          <span>Progress</span>
          <b>{ws.progress}%</b>
        </div>
        <div className="rh-progress">
          <span style={{ width: `${ws.progress}%` }} />
        </div>
      </div>
      <StageBar stage={ws.stage} />
      <div className="rh-ws-row">
        <span>Updated {ws.updated}</span>
        <button className="rh-btn primary sm" onClick={() => hub.openWorkspace(ws.id)}>
          Open workspace <ArrowRight />
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export function DatasetCard({ d, onAdd }: { d: Dataset; onAdd?: () => void }) {
  const hub = useHub();
  return (
    <article className="rh-card rh-ds rh-lift">
      <div className="rh-ds-head">
        <span className="rh-ds-icon">
          <Database />
        </span>
        <div>
          <h3>{d.name}</h3>
          <small>{d.source}</small>
        </div>
      </div>
      <dl>
        <div>
          <dt>Coverage</dt>
          <dd>{d.coverage}</dd>
        </div>
        <div>
          <dt>Years</dt>
          <dd>{d.temporal}</dd>
        </div>
        <div>
          <dt>Resolution</dt>
          <dd>{d.resolution}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{d.format}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>{d.license}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{d.updated}</dd>
        </div>
      </dl>
      <div className="rh-ds-actions">
        <button className="rh-btn sm" onClick={() => hub.openDataset(d.id)}>
          Preview
        </button>
        <button
          className="rh-btn sm primary"
          onClick={onAdd ?? (() => hub.addToWorkspace("dataset", d.id))}
        >
          <Plus /> Add to workspace
        </button>
      </div>
    </article>
  );
}

export function DatasetExplorer() {
  const [kind, setKind] = useState<string>("All");
  const [q, setQ] = useState("");
  const kinds = ["All", ...Array.from(new Set(DATASETS.map((d) => d.kind)))];
  const list = DATASETS.filter(
    (d) =>
      (kind === "All" || d.kind === kind) &&
      `${d.name} ${d.source} ${d.description} ${d.topics.join(" ")}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="rh-filters">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter datasets…"
          aria-label="Filter datasets"
        />
        <div className="rh-chips" style={{ marginTop: 0 }}>
          {kinds.map((k) => (
            <button
              key={k}
              className={`rh-chip${kind === k ? " on" : ""}`}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="rh-ds-grid">
          {list.map((d) => (
            <DatasetCard key={d.id} d={d} />
          ))}
        </div>
      ) : (
        <Empty icon={Database} title="No datasets match">
          Clear the filter to see all {DATASETS.length} datasets.
        </Empty>
      )}
    </>
  );
}

export function DatasetPreview({ d }: { d: Dataset }) {
  const hub = useHub();
  const usedBy = PAPERS.filter((p) => p.datasetIds.includes(d.id));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{d.description}</p>
      {d.kind === "Satellite" || d.kind === "Land use" ? (
        <img
          src={satImage}
          alt={`Preview of ${d.name}`}
          style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 12 }}
        />
      ) : null}
      <div className="rh-ds" style={{ padding: 0 }}>
        <dl>
          <div>
            <dt>Source</dt>
            <dd>{d.source}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>{d.coverage}</dd>
          </div>
          <div>
            <dt>Temporal range</dt>
            <dd>{d.temporal}</dd>
          </div>
          <div>
            <dt>Spatial resolution</dt>
            <dd>{d.resolution}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{d.format}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>{d.license}</dd>
          </div>
        </dl>
      </div>
      <div>
        <h4
          className="rh-muted"
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          Used in {usedBy.length} studies
        </h4>
        <div className="rh-tags">
          {usedBy.map((p) => (
            <button key={p.id} className="rh-source paper" onClick={() => hub.openPaper(p.id)}>
              <FileText /> {p.title}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="rh-btn primary" onClick={() => hub.addToWorkspace("dataset", d.id)}>
          <Plus /> Add to workspace
        </button>
        <button className="rh-btn" onClick={() => hub.go("gis")}>
          <MapIcon /> View on map
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Research gap explorer
// ---------------------------------------------------------------------------

const STATE_CODES: Record<string, string> = {
  Maharashtra: "MH",
  Gujarat: "GJ",
  Karnataka: "KA",
  "Madhya Pradesh": "MP",
  "Uttar Pradesh": "UP",
  Rajasthan: "RJ",
};

export function GapExplorer({ onPropose }: { onPropose: (theme: string, state: string) => void }) {
  const [sel, setSel] = useState<{ theme: (typeof GAP_THEMES)[number]; col: number } | null>({
    theme: "District-level policy impact",
    col: 3,
  });
  const level = sel ? (GAP_MATRIX[sel.theme][sel.col] ?? 0) : 0;
  const state = sel ? FOCUS_STATES[sel.col]! : "";
  const related = sel ? PAPERS.filter((p) => p.states.includes(state)).slice(0, 3) : [];
  return (
    <div className="rh-gap">
      <div className="rh-card" style={{ padding: 18 }}>
        <div className="rh-matrix">
          <table>
            <thead>
              <tr>
                <th />
                {FOCUS_STATES.map((s) => (
                  <th key={s}>
                    <abbr title={s}>{STATE_CODES[s]}</abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GAP_THEMES.map((t) => (
                <tr key={t}>
                  <th className="row" scope="row">
                    {t}
                  </th>
                  {GAP_MATRIX[t].map((v, c) => (
                    <td key={c}>
                      <button
                        className={`rh-lv-${v}${sel?.theme === t && sel.col === c ? " sel" : ""}`}
                        onClick={() => setSel({ theme: t, col: c })}
                        aria-label={`${t} in ${FOCUS_STATES[c]}: ${GAP_LEVELS[v]!.label}`}
                        title={`${t} · ${FOCUS_STATES[c]} — ${GAP_LEVELS[v]!.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rh-legend">
          {[3, 2, 1, 0].map((v) => (
            <span key={v}>
              <i className={`rh-lv-${v}`} />
              {GAP_LEVELS[v]!.label}
            </span>
          ))}
          <span className="rh-demo" style={{ marginLeft: "auto" }}>
            Demo coverage estimates
          </span>
        </div>
      </div>
      <div className="rh-card rh-panel" aria-live="polite">
        {sel ? (
          <>
            <h4>Selected gap</h4>
            <h3 className="rh-display" style={{ margin: 0, fontSize: 22 }}>
              {sel.theme}
            </h3>
            <p className="rh-muted" style={{ margin: "4px 0 12px", fontSize: 13 }}>
              {state}
            </p>
            <span className={`rh-tag ${level <= 1 ? "red" : level === 2 ? "orange" : ""}`}>
              {GAP_LEVELS[level]!.label}
            </span>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              {level === 0
                ? "Too little usable data exists to study this theme here — a data collection effort would come first."
                : level === 1
                  ? "Few studies address this theme here. A focused proposal could produce first-of-its-kind evidence."
                  : level === 2
                    ? "Some evidence exists but with thin coverage of districts or recent years."
                    : "Well studied — consider synthesis or policy translation rather than new primary research."}
            </p>
            {related.length > 0 && (
              <>
                <h4 style={{ marginTop: 14 }}>Nearest existing studies</h4>
                <div className="rh-tags">
                  {related.map((p) => (
                    <span key={p.id} className="rh-tag blue">
                      {p.title}
                    </span>
                  ))}
                </div>
              </>
            )}
            <button
              className="rh-btn primary"
              style={{ marginTop: 16, width: "100%" }}
              onClick={() => onPropose(sel.theme, state)}
            >
              <Lightbulb /> Create research proposal
            </button>
          </>
        ) : (
          <Empty icon={Lightbulb} title="Select a cell">
            Pick a theme × state to see the gap.
          </Empty>
        )}
      </div>
    </div>
  );
}

export function ProposalForm({
  theme,
  state,
  onDone,
}: {
  theme: string;
  state: string;
  onDone: () => void;
}) {
  const hub = useHub();
  const [title, setTitle] = useState(`${theme} in ${state}`);
  const [question, setQuestion] = useState(
    `What is the state of ${theme.toLowerCase()} in ${state}, and which policy levers change outcomes at district level?`,
  );
  const suggested = DATASETS.filter((d) => d.coverage === "India").slice(0, 3);
  return (
    <form
      className="rh-form"
      onSubmit={(e) => {
        e.preventDefault();
        const ws = hub.createWorkspace({
          title,
          question,
          state,
          topics: ["Policy Reform"],
          datasetIds: suggested.map((d) => d.id),
        });
        hub.toast(`Workspace created: ${ws.title}`);
        onDone();
        hub.openWorkspace(ws.id);
      }}
    >
      <label>
        Proposal title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Research question
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} required />
      </label>
      <label>
        Suggested datasets
        <div className="rh-tags">
          {suggested.map((d) => (
            <span key={d.id} className="rh-tag purple">
              {d.name}
            </span>
          ))}
        </div>
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="rh-btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="rh-btn primary">
          <Rocket /> Create workspace from proposal
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Research network
// ---------------------------------------------------------------------------

const INST_COLOR: Record<string, string> = {
  Government: "#075B3A",
  Academic: "#3B82F6",
  "Research institute": "#F59E0B",
};

// Ring order: grouped by type, ordered within groups to keep chords short
const RING_ORDER = [
  "dolr",
  "soi",
  "gom",
  "gog",
  "iitb",
  "tiss",
  "cept",
  "iitd",
  "iisc",
  "iitm",
  "nalsar",
  "nirdpr",
  "cpr",
  "wii",
];
const RING_R = 128;
const GROUP_GAP = 0.32; // radians between type groups

const RING = (() => {
  const insts = RING_ORDER.map((id) => INSTITUTIONS.find((i) => i.id === id)).filter(
    (i): i is Institution => !!i,
  );
  const groups = insts.reduce(
    (n, inst, k) => n + (k > 0 && insts[k - 1]!.type !== inst.type ? 1 : 0),
    1,
  );
  const step = (Math.PI * 2 - groups * GROUP_GAP) / insts.length;
  let angle = -Math.PI / 2 + GROUP_GAP / 2;
  const nodes = insts.map((inst, k) => {
    if (k > 0 && insts[k - 1]!.type !== inst.type) angle += GROUP_GAP;
    const a = angle + step / 2;
    angle += step;
    const links = COLLABORATIONS.filter(([x, y]) => x === inst.id || y === inst.id);
    return {
      inst,
      a,
      x: Math.cos(a) * RING_R,
      y: Math.sin(a) * RING_R,
      degree: links.length,
      joint: links.reduce((s, c) => s + c[2], 0),
    };
  });
  // Arc extent per type, drawn as a thin band outside the ring
  const bands = Object.keys(INST_COLOR).map((type) => {
    const members = nodes.filter((n) => n.inst.type === type);
    return {
      type,
      from: members[0]!.a - step / 2 + 0.03,
      to: members[members.length - 1]!.a + step / 2 - 0.03,
    };
  });
  return { nodes, bands };
})();

const ringNode = (id: string) => RING.nodes.find((n) => n.inst.id === id)!;

const arcPath = (r: number, from: number, to: number) => {
  const p = (a: number) => `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  return `M${p(from)} A${r},${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${p(to)}`;
};

// Chord bent toward the centre of the ring
const chordPath = (a: string, b: string) => {
  const p = ringNode(a);
  const q = ringNode(b);
  const pull = 0.18;
  return `M${p.x.toFixed(1)},${p.y.toFixed(1)} Q${((p.x + q.x) * pull).toFixed(1)},${((p.y + q.y) * pull).toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
};

const MAX_JOINT = Math.max(...COLLABORATIONS.map((c) => c[2]));

function NetworkGraph({
  focus,
  setFocus,
  onPick,
}: {
  focus: string | null;
  setFocus: (id: string | null) => void;
  onPick: (name: string) => void;
}) {
  const partners = focus
    ? COLLABORATIONS.filter(([a, b]) => a === focus || b === focus)
        .map(([a, b, w]) => ({ id: a === focus ? b : a, w }))
        .sort((x, y) => y.w - x.w)
    : [];
  const partnerIds = new Set(partners.map((p) => p.id));
  const focused = focus ? ringNode(focus) : null;
  const top = [...RING.nodes].sort((a, b) => b.joint - a.joint).slice(0, 4);

  return (
    <div className="rh-net">
      <svg
        className="rh-net-svg"
        viewBox="-235 -190 470 380"
        role="img"
        aria-label="Institution collaboration network grouped by institution type"
        onMouseLeave={() => setFocus(null)}
      >
        {RING.bands.map((b) => {
          const mid = (b.from + b.to) / 2;
          const c = Math.cos(mid);
          return (
            <g key={b.type}>
              <path
                d={arcPath(RING_R + 8, b.from, b.to)}
                className="band"
                stroke={INST_COLOR[b.type]}
              />
              <text
                x={c * (RING_R + 66)}
                y={Math.sin(mid) * (RING_R + 48)}
                className="band-label"
                textAnchor={Math.abs(c) < 0.3 ? "middle" : c > 0 ? "start" : "end"}
                fill={INST_COLOR[b.type]}
              >
                {b.type === "Research institute" ? "RESEARCH INSTITUTES" : b.type.toUpperCase()}
              </text>
            </g>
          );
        })}
        {COLLABORATIONS.map(([a, b, w]) => {
          const on = !!focus && (a === focus || b === focus);
          return (
            <path
              key={`${a}-${b}`}
              d={chordPath(a, b)}
              className={`chord${focus ? (on ? " on" : " off") : ""}`}
              strokeWidth={0.8 + (w / MAX_JOINT) * 3.2}
            />
          );
        })}
        {RING.nodes.map((n) => {
          const right = Math.cos(n.a) >= 0;
          const state = !focus
            ? ""
            : n.inst.id === focus
              ? " focus"
              : partnerIds.has(n.inst.id)
                ? " partner"
                : " off";
          return (
            <g
              key={n.inst.id}
              className={`node${state}`}
              tabIndex={0}
              role="button"
              aria-label={`${n.inst.name}: ${n.degree} partner institutions, ${n.joint} joint projects`}
              onMouseEnter={() => setFocus(n.inst.id)}
              onFocus={() => setFocus(n.inst.id)}
              onClick={() => onPick(n.inst.name)}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={4 + n.inst.publications / 16}
                fill={INST_COLOR[n.inst.type]}
              />
              <text
                x={Math.cos(n.a) * (RING_R + 18)}
                y={Math.sin(n.a) * (RING_R + 18) + 4}
                textAnchor={right ? "start" : "end"}
              >
                {n.inst.short}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="rh-net-detail" aria-live="polite">
        {focused ? (
          <>
            <div className="rh-net-detail-head">
              <span className="dot" style={{ background: INST_COLOR[focused.inst.type] }} />
              <div>
                <strong>{focused.inst.name}</strong>
                <small>
                  {focused.inst.type} · {focused.inst.state} · {focused.inst.publications}{" "}
                  publications
                </small>
              </div>
            </div>
            <h5>
              {partners.length} partner institutions · {focused.joint} joint projects
            </h5>
            <ul>
              {partners.map((p) => (
                <li key={p.id}>
                  <span>{ringNode(p.id).inst.name}</span>
                  <i style={{ width: `${(p.w / MAX_JOINT) * 100}%` }} />
                  <b>{p.w}</b>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h5>Most connected institutions · joint projects</h5>
            <ul>
              {top.map((n) => (
                <li key={n.inst.id}>
                  <span>{n.inst.name}</span>
                  <i style={{ width: `${(n.joint / top[0]!.joint) * 100}%` }} />
                  <b>{n.joint}</b>
                </li>
              ))}
            </ul>
            <p>
              Hover an institution to see its partners; click to filter researchers. Line weight =
              joint projects, circle size = publications (demo data).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function ResearchNetwork({ limit }: { limit?: number } = {}) {
  const hub = useHub();
  const [focus, setFocus] = useState<string | null>(null);
  const [instFilter, setInstFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [area, setArea] = useState("All");
  const [q, setQ] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const people = RESEARCHERS.filter(
    (r) =>
      (instFilter === "All" || r.institution.includes(instFilter)) &&
      (stateFilter === "All" || r.state === stateFilter) &&
      (area === "All" || r.expertise.includes(area as Topic)) &&
      `${r.name} ${r.interests} ${r.institution}`.toLowerCase().includes(q.toLowerCase()),
  );
  const states = ["All", ...Array.from(new Set(RESEARCHERS.map((r) => r.state)))];
  const areas = ["All", ...Array.from(new Set(RESEARCHERS.flatMap((r) => r.expertise)))];
  const insts = ["All", ...Array.from(new Set(RESEARCHERS.map((r) => r.institution)))];
  return (
    <div className="rh-network">
      <div className="rh-card" style={{ padding: 18 }}>
        <div className="rh-ws-row" style={{ marginBottom: 4 }}>
          <b style={{ fontSize: 13 }}>
            {INSTITUTIONS.length} institutions · {COLLABORATIONS.length} active collaborations
          </b>
          <span className="rh-demo">Demo data</span>
        </div>
        <NetworkGraph
          focus={focus}
          setFocus={setFocus}
          onPick={(name) => setInstFilter(name.split(" —")[0]!)}
        />
      </div>
      <div>
        <div className="rh-filters">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search researchers…"
            aria-label="Search researchers"
          />
          <select
            value={instFilter}
            onChange={(e) => setInstFilter(e.target.value)}
            aria-label="Institution"
          >
            {insts.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            aria-label="State"
          >
            {states.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Expertise">
            {areas.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {limit && people.length > limit && (
          <button
            className="rh-btn sm"
            style={{ marginBottom: 12 }}
            onClick={() => hub.go("network")}
          >
            View all {people.length} researchers <ArrowRight />
          </button>
        )}
        <div
          className="rh-profiles rh-scroll"
          style={{ "--rh-scroll-h": "720px" } as CSSProperties}
        >
          {people.length ? (
            (limit ? people.slice(0, limit) : people).map((r) => (
              <article key={r.id} className="rh-card rh-profile rh-lift">
                <div className="rh-profile-top">
                  <Avatar id={r.id} size="lg" />
                  <div>
                    <h4>{r.name}</h4>
                    <small>
                      {r.role} · {r.institution}
                    </small>
                  </div>
                </div>
                <div className="rh-tags">
                  {r.expertise.map((e) => (
                    <span key={e} className="rh-tag">
                      {e}
                    </span>
                  ))}
                </div>
                <p>{r.interests}</p>
                <div className="rh-profile-stats">
                  <span>
                    <b>{r.publications}</b> publications
                  </span>
                  <span>
                    <b>{r.projects}</b> projects
                  </span>
                </div>
                <button className="rh-btn sm" onClick={() => setInvite(r.id)}>
                  <Users /> Invite collaborator
                </button>
              </article>
            ))
          ) : (
            <Empty
              icon={Users}
              title="No researchers match these filters"
              action={
                <button
                  className="rh-btn sm"
                  onClick={() => {
                    setInstFilter("All");
                    setStateFilter("All");
                    setArea("All");
                    setQ("");
                  }}
                >
                  Clear filters
                </button>
              }
            />
          )}
        </div>
      </div>
      {invite && (
        <Modal
          title={`Invite ${researcher(invite)?.name}`}
          eyebrow="Research network"
          onClose={() => setInvite(null)}
        >
          <form
            className="rh-form"
            onSubmit={(e) => {
              e.preventDefault();
              hub.toast(`Invitation sent to ${researcher(invite)?.name}`);
              setInvite(null);
            }}
          >
            <label>
              Workspace
              <select>
                {hub.workspaces.map((w) => (
                  <option key={w.id}>{w.title}</option>
                ))}
              </select>
            </label>
            <label>
              Message
              <textarea
                defaultValue={`Hello ${researcher(invite)?.name.split(" ")[0]}, your work on ${researcher(invite)?.interests.toLowerCase()} would strengthen our study. Would you like to join the workspace?`}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="rh-btn" onClick={() => setInvite(null)}>
                Cancel
              </button>
              <button className="rh-btn primary" type="submit">
                Send invitation
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case studies
// ---------------------------------------------------------------------------

export function CaseStudies() {
  const hub = useHub();
  const [open, setOpen] = useState<CaseStudy | null>(null);
  return (
    <>
      <div className="rh-cases">
        {CASE_STUDIES.map((c) => (
          <button
            key={c.id}
            className={`rh-card rh-case rh-lift ${c.tone}`}
            onClick={() => setOpen(c)}
          >
            <small>{c.state}</small>
            <h3>{c.name}</h3>
            <p>{c.transition}</p>
            <div className="rh-tags">
              <span className="rh-tag orange">{c.climate.split(";")[0]}</span>
            </div>
            <span className="go">
              Explore case <ArrowRight />
            </span>
          </button>
        ))}
      </div>
      {open && (
        <Modal
          title={open.name}
          eyebrow={`Case study · ${open.state}`}
          onClose={() => setOpen(null)}
          wide
        >
          <div className="rh-two">
            <div style={{ display: "grid", gap: 12 }}>
              {[
                ["Geography", open.geography],
                ["Land-use transition", open.transition],
                ["Policy context", open.policy],
                ["Climate risk", open.climate],
                ["Dispute context", open.disputes],
              ].map(([k, v]) => (
                <div key={k} className="rh-card rh-panel" style={{ padding: "12px 16px" }}>
                  <h4 style={{ marginBottom: 4 }}>{k}</h4>
                  <div style={{ fontSize: 14, lineHeight: 1.55 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <div className="rh-card rh-panel">
                <h4>Policy interventions</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                  {open.interventions.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
              <div className="rh-card rh-panel">
                <h4>Research papers</h4>
                <div className="rh-tags">
                  {open.paperIds
                    .map((id) => paperById(id))
                    .filter(Boolean)
                    .map((p) => (
                      <button
                        key={p!.id}
                        className="rh-source paper"
                        onClick={() => hub.openPaper(p!.id)}
                      >
                        <FileText /> {p!.title}
                      </button>
                    ))}
                </div>
              </div>
              <div className="rh-card rh-panel">
                <h4>Datasets</h4>
                <div className="rh-tags">
                  {open.datasetIds
                    .map((id) => datasetById(id))
                    .filter(Boolean)
                    .map((d) => (
                      <button
                        key={d!.id}
                        className="rh-source dataset"
                        onClick={() => hub.openDataset(d!.id)}
                      >
                        <Database /> {d!.name}
                      </button>
                    ))}
                </div>
              </div>
              <a className="rh-btn primary" href="/landdifference">
                <MapIcon /> Compare land change on the map
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// National pipeline
// ---------------------------------------------------------------------------

const PIPE: { label: string; note: string; icon: typeof Search }[] = [
  { label: "Research question", note: "Gaps & priorities", icon: Lightbulb },
  { label: "Data", note: "1,840 datasets", icon: Database },
  { label: "Analysis", note: "GIS + remote sensing", icon: MapIcon },
  { label: "Collaboration", note: "72 institutions", icon: Users },
  { label: "Policy experiment", note: "Scenario models", icon: FlaskConical },
  { label: "Pilot", note: "District pilots", icon: Rocket },
  { label: "Evaluation", note: "Impact monitoring", icon: Scale },
  { label: "Policy", note: "Notified reform", icon: Landmark },
];

export function NationalPipeline() {
  return (
    <div className="rh-pipeline" role="list" aria-label="National research-to-policy pipeline">
      {PIPE.map((p, i) => (
        <div
          key={p.label}
          className={`rh-pipe${i === PIPE.length - 1 ? " final" : ""}`}
          role="listitem"
        >
          <span>
            <p.icon />
          </span>
          <strong>{p.label}</strong>
          <small>{p.note}</small>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy experiments (uses the same land-use scenario model as /landdifference)
// ---------------------------------------------------------------------------

export function PolicyExperiment({
  state,
  title = "Agricultural Preservation Zone",
}: {
  state: string;
  title?: string;
}) {
  const hub = useHub();
  const [vars, setVars] = useState<ExperimentVars>(PRESERVATION_ZONE);
  const [name, setName] = useState(title);
  const out = useMemo(() => experimentOutcome(state, vars), [state, vars]);
  const sliders: { key: keyof ExperimentVars; label: string; min: number; max: number }[] = [
    { key: "agri", label: "Agricultural land", min: -15, max: 20 },
    { key: "urban", label: "Urban expansion", min: -20, max: 20 },
    { key: "forest", label: "Forest protection", min: -10, max: 15 },
    { key: "water", label: "Water bodies", min: -10, max: 20 },
  ];
  return (
    <div className="rh-exp">
      <div className="rh-card rh-panel">
        <h4>Scenario · {state}</h4>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rh-display"
          style={{
            width: "100%",
            border: 0,
            borderBottom: "1px dashed #cfd9d1",
            fontSize: 22,
            padding: "2px 0 6px",
            marginBottom: 16,
            background: "transparent",
          }}
          aria-label="Scenario name"
        />
        {sliders.map((s) => (
          <div key={s.key} className="rh-slider">
            <label htmlFor={`exp-${s.key}`}>
              {s.label}
              <b>
                {vars[s.key] > 0 ? "+" : ""}
                {vars[s.key]}%
              </b>
            </label>
            <input
              id={`exp-${s.key}`}
              type="range"
              min={s.min}
              max={s.max}
              value={vars[s.key]}
              onChange={(e) => setVars({ ...vars, [s.key]: Number(e.target.value) })}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <button className="rh-btn sm" onClick={() => setVars(PRESERVATION_ZONE)}>
            Preservation zone preset
          </button>
          <button
            className="rh-btn sm"
            onClick={() => setVars({ agri: 0, urban: 0, forest: 0, water: 0 })}
          >
            Reset
          </button>
          <button
            className="rh-btn sm primary"
            onClick={() => hub.toast(`Scenario “${name}” saved to workspace`)}
          >
            Save scenario
          </button>
        </div>
      </div>
      <div>
        <div className="rh-outcomes">
          {out.map((o) => {
            const good =
              Math.abs(o.value) < 0.05 ? null : o.goodWhenDown ? o.value < 0 : o.value > 0;
            const Icon = o.value < 0 ? ArrowDown : ArrowUp;
            return (
              <div key={o.label} className="rh-outcome">
                <span>{o.label}</span>
                <strong className={good === null ? "" : good ? "rh-good" : "rh-bad"}>
                  <Icon /> {Math.abs(o.value).toFixed(1)}%
                </strong>
                <small>
                  {good === null ? "No change" : good ? "Improves" : "Worsens"} vs. 2024 baseline
                </small>
              </div>
            );
          })}
        </div>
        <p className="rh-muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "12px 0 0" }}>
          Scenario outputs are model estimates from Nirvana's demonstration land-use model, not
          official predictions. Variables are % changes relative to each class's current share.{" "}
          <a href="/landdifference" style={{ color: "#075B3A", fontWeight: 700 }}>
            Open the full scenario simulator →
          </a>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publication builder (policy brief)
// ---------------------------------------------------------------------------

const RECS: Partial<Record<Topic, string>> = {
  Urbanization:
    "Notify agricultural preservation zones along growth corridors, allowing conversion only through planned town-planning schemes.",
  Agriculture:
    "Tie non-agricultural conversion approvals to an annually refreshed, satellite-based district cropland baseline.",
  "Land Disputes":
    "Prioritise record-of-rights reconciliation in villages where observed land use and recorded land class disagree.",
  "Land Records":
    "Integrate registration and mutation so that recorded land class updates within 30 days of approved conversion.",
  Climate:
    "Screen conversion requests against climate-risk and groundwater-stress layers before approval.",
  "Policy Reform":
    "Publish conversion permissions as open data so that researchers and citizens can monitor outcomes.",
  "Forest Protection":
    "Complete cadastral surveys in Scheduled Areas before adjudicating pending forest-rights claims.",
  "Land Use":
    "Adopt a common land-use classification across revenue, planning and forest departments.",
};

type BriefPart = "abstract" | "summary" | "brief" | "citations";

export function BriefBuilder({ ws }: { ws: Workspace }) {
  const [inputs, setInputs] = useState<Record<string, boolean>>({
    "Research notes": true,
    Evidence: true,
    Findings: true,
    Charts: true,
    Maps: true,
    "Policy recommendations": true,
  });
  const [parts, setParts] = useState<BriefPart[]>([]);
  const [busy, setBusy] = useState<BriefPart | null>(null);
  const papers = ws.paperIds.map(paperById).filter((p): p is Paper => !!p);
  const cite = (p: Paper) => papers.indexOf(p) + 1;
  const recs = ws.topics
    .map((t) => RECS[t])
    .filter(Boolean)
    .slice(0, 4) as string[];
  const out = experimentOutcome(ws.state, PRESERVATION_ZONE);
  const generate = (p: BriefPart) => {
    setBusy(p);
    window.setTimeout(() => {
      setParts((prev) => (prev.includes(p) ? prev : [...prev, p]));
      setBusy(null);
    }, 650);
  };
  const has = (p: BriefPart) => parts.includes(p) || (p !== "citations" && parts.includes("brief"));
  return (
    <div className="rh-builder">
      <div>
        <div className="rh-card rh-panel">
          <h4>Include in brief</h4>
          <ul className="rh-steps">
            {Object.keys(inputs).map((k) => (
              <li key={k}>
                <label>
                  <input
                    type="checkbox"
                    checked={inputs[k]}
                    onChange={() => setInputs({ ...inputs, [k]: !inputs[k] })}
                  />
                  {k}
                </label>
              </li>
            ))}
          </ul>
          <div className="rh-gen">
            {(
              [
                ["abstract", "Generate abstract"],
                ["summary", "Generate executive summary"],
                ["brief", "Generate policy brief"],
                ["citations", "Generate citation list"],
              ] as [BriefPart, string][]
            ).map(([p, label]) => (
              <button
                key={p}
                className={`rh-btn${p === "brief" ? " primary" : ""}`}
                onClick={() => generate(p)}
                disabled={!!busy}
              >
                {busy === p ? (
                  <Loader2 className="rh-spin" />
                ) : parts.includes(p) ? (
                  <CheckCircle2 />
                ) : (
                  <Sparkles />
                )}{" "}
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="rh-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Every sentence is assembled from this workspace's linked evidence and scenario results;
          numbered citations point to the reference list.
        </p>
      </div>
      <article className="rh-brief" aria-label="Policy brief preview">
        <div className="rh-brief-band">
          <div>
            <b>Nirvana Research Hub · Department of Land Resources</b>
            <small>Ministry of Rural Development · Government of India</small>
          </div>
          <span className="stamp">DRAFT · DEMO</span>
        </div>
        <div className="rh-brief-doc">
          <span className="series">Research-to-Policy Brief · {ws.state}</span>
          <h1>{ws.title}</h1>
          <div className="byline">
            {ws.institutions.join(" · ")} ·{" "}
            {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
          {!parts.length && !busy && (
            <p className="rh-muted" style={{ marginTop: 20 }}>
              Choose what to generate on the left. The brief assembles here.
            </p>
          )}
          {busy && (
            <p className="rh-typing rh-muted" style={{ marginTop: 20 }}>
              Drafting from linked evidence
            </p>
          )}
          {has("abstract") && (
            <section style={{ animation: "rh-rise .4s ease both" }}>
              <h2>Abstract</h2>
              <p>
                This study asks: {ws.question.charAt(0).toLowerCase() + ws.question.slice(1)}{" "}
                Drawing on {papers.length} studies and {ws.datasetIds.length} datasets using{" "}
                {ws.methods.slice(0, 3).join(", ").toLowerCase()}, it finds that{" "}
                {papers[0] ? (
                  <>
                    {papers[0].finding.charAt(0).toLowerCase() + papers[0].finding.slice(1, -1)}
                    <sup>[{cite(papers[0])}]</sup>.
                  </>
                ) : (
                  "evidence is still being assembled."
                )}
              </p>
            </section>
          )}
          {has("summary") && (
            <section style={{ animation: "rh-rise .4s ease both" }}>
              <h2>Executive summary</h2>
              <ul>
                {papers.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    {p.finding}
                    <sup>[{cite(p)}]</sup>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {parts.includes("brief") && (
            <section style={{ animation: "rh-rise .4s ease both" }}>
              {inputs["Charts"] && inputs["Maps"] && (
                <div className="rh-brief-fig">
                  <figure>
                    <div style={{ display: "grid", gap: 6 }}>
                      {out.slice(0, 4).map((o) => (
                        <div
                          key={o.label}
                          className="rh-bar"
                          style={{ gridTemplateColumns: "110px 1fr 44px" }}
                        >
                          <span>{o.label}</span>
                          <i
                            style={{
                              width: `${Math.min(100, Math.abs(o.value) * 6)}%`,
                              background: (o.goodWhenDown ? o.value < 0 : o.value > 0)
                                ? "#0B7A4B"
                                : "#E34D4D",
                            }}
                          />
                          <b>
                            {o.value > 0 ? "+" : ""}
                            {o.value.toFixed(1)}%
                          </b>
                        </div>
                      ))}
                    </div>
                    <figcaption>
                      Figure 1. Estimated effects of an Agricultural Preservation Zone scenario
                      (model estimate).
                    </figcaption>
                  </figure>
                  <figure>
                    <img src={satImage} alt={`Satellite view of the study area in ${ws.state}`} />
                    <figcaption>
                      Figure 2. Study area, Sentinel-2 cloudless 2024 (EOX, Copernicus).
                    </figcaption>
                  </figure>
                </div>
              )}
              {inputs["Policy recommendations"] && (
                <>
                  <h2>Policy recommendations</h2>
                  <ol>
                    {recs.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          )}
          {parts.includes("citations") && (
            <section style={{ animation: "rh-rise .4s ease both" }}>
              <h2>References</h2>
              <ol className="rh-brief-refs">
                {papers.map((p) => (
                  <li key={p.id}>
                    {p.authors.join(", ")} ({p.year}). {p.title}. {p.institution}. {p.type}.
                    [Demonstration record]
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Translate research into policy
// ---------------------------------------------------------------------------

export function TranslateFlow({ ws, onBrief }: { ws: Workspace; onBrief: () => void }) {
  const [step, setStep] = useState(1);
  const [question, setQuestion] = useState(
    `What if agricultural conversion restrictions are strengthened around ${ws.state === "Maharashtra" ? "Pune" : ws.state}'s growth corridors?`,
  );
  const top = ws.paperIds.map(paperById).find(Boolean) as Paper | undefined;
  const out = experimentOutcome(ws.state, PRESERVATION_ZONE);
  const steps = [
    "Research evidence",
    "Policy question",
    "Scenario",
    "Simulation",
    "Impact",
    "Policy brief",
  ];
  const body = [
    top ? (
      <>
        <b>Finding:</b> {top.finding}{" "}
        <SourceChips
          claim={{
            text: top.finding,
            sources: [{ kind: "paper", id: top.id, label: `${top.authors[0]} et al. ${top.year}` }],
          }}
        />
      </>
    ) : (
      "Link a paper to start."
    ),
    <input
      key="q"
      value={question}
      onChange={(e) => setQuestion(e.target.value)}
      style={{
        width: "100%",
        border: "1px solid #cfd9d1",
        borderRadius: 9,
        padding: "9px 11px",
        font: "inherit",
      }}
      aria-label="Policy question"
    />,
    <>
      Agricultural Preservation Zone — agricultural land <b>+10%</b>, urban expansion <b>−8%</b>,
      forest protection <b>+5%</b> (relative to current shares).
    </>,
    <>Ran the Nirvana land-use scenario model for {ws.state} against the 2024 baseline.</>,
    <div key="i" className="rh-outcomes" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
      {out.slice(0, 6).map((o) => {
        const good = o.goodWhenDown ? o.value < 0 : o.value > 0;
        return (
          <div key={o.label} className="rh-outcome" style={{ padding: 10 }}>
            <span>{o.label}</span>
            <strong className={good ? "rh-good" : "rh-bad"} style={{ fontSize: 20 }}>
              {o.value > 0 ? "+" : ""}
              {o.value.toFixed(1)}%
            </strong>
          </div>
        );
      })}
    </div>,
    <>
      Draft a brief that cites the evidence, scenario and impacts.{" "}
      <button className="rh-btn sm primary" onClick={onBrief} style={{ marginLeft: 6 }}>
        Open publication builder <ArrowRight />
      </button>
    </>,
  ];
  return (
    <div>
      <ol className="rh-flow">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? "done" : i === step ? "current" : ""}>
            <span className="num">{i < step ? <CheckCircle2 style={{ width: 16 }} /> : i + 1}</span>
            <div>
              <h5>{s}</h5>
              {i <= step && <div className="rh-flow-body">{body[i]}</div>}
            </div>
          </li>
        ))}
      </ol>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span className="rh-demo" style={{ alignSelf: "center" }}>
          Scenario outputs are estimates, not official predictions
        </span>
        {step < steps.length - 1 && (
          <button className="rh-btn primary" onClick={() => setStep(step + 1)}>
            {step === 2 ? "Run simulation" : "Next"} <ArrowRight />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy evidence list
// ---------------------------------------------------------------------------

export function PolicyEvidenceList() {
  return (
    <div className="rh-mini-list rh-scroll" style={{ "--rh-scroll-h": "760px" } as CSSProperties}>
      {POLICIES.map((g) => {
        const linked = PAPERS.filter(
          (p) =>
            p.topics.some((t) => g.topics.includes(t)) &&
            (g.jurisdiction === "India" || p.states.includes(g.jurisdiction)),
        ).slice(0, 3);
        return (
          <article key={g.id} className="rh-card rh-result rh-lift">
            <div className="rh-result-meta">
              <span className="rh-tag orange">{g.jurisdiction}</span>
              {g.issuer} · {g.year}
            </div>
            <strong>{g.title}</strong>
            <p>{g.summary}</p>
            <div className="rh-result-meta">
              Evidence linked:{" "}
              {linked.length ? (
                linked.map((p) => (
                  <span key={p.id} className="rh-tag blue">
                    {p.title}
                  </span>
                ))
              ) : (
                <span>none yet — a gap</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
