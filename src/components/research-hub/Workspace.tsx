import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  FlaskConical,
  GitBranch,
  History,
  KanbanSquare,
  Landmark,
  LayoutDashboard,
  Link2,
  ListChecks,
  Map as MapIcon,
  MessageSquare,
  Network,
  Plus,
  Send,
  Share2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  DATASETS,
  PAPERS,
  POLICIES,
  TASK_COLUMNS,
  datasetById,
  paperById,
  researcher,
  seedCanvas,
  seedComments,
  seedTasks,
  seedVersions,
  type CanvasEdge,
  type CanvasKind,
  type CanvasNode,
  type Comment,
  type Task,
  type Version,
  type Workspace,
} from "@/data/research-hub";
import { LAND_CLASS_ORDER, STATE_AREA_KM2, scenarioFlows, yearShares } from "@/data/land-scenario";
import { LULC_CLASSES } from "@/components/land-difference/lulcRaster";
import { useHub } from "./hub-context";
import {
  Avatar,
  BriefBuilder,
  DatasetCard,
  Empty,
  Modal,
  PolicyExperiment,
  TranslateFlow,
} from "./ResearchSections";
import { ResearchMap } from "./ResearchMap";

// Per-workspace state survives reloads in this browser (demo persistence)
function usePersistent<T>(key: string, init: () => T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // storage unavailable — fall back to seed data
    }
    return init();
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [key, value]);
  return [value, setValue];
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "canvas", label: "Research Canvas", icon: GitBranch },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "datasets", label: "Datasets", icon: Database },
  { id: "gis", label: "GIS", icon: MapIcon },
  { id: "analysis", label: "Analysis", icon: Network },
  { id: "experiments", label: "Policy Experiments", icon: FlaskConical },
  { id: "tasks", label: "Tasks", icon: KanbanSquare },
  { id: "discussion", label: "Discussion", icon: MessageSquare },
  { id: "versions", label: "Versions", icon: History },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function WorkspaceView({ ws, onBack }: { ws: Workspace; onBack: () => void }) {
  const hub = useHub();
  const [tab, setTab] = useState<TabId>("overview");
  const [translate, setTranslate] = useState(false);
  const [brief, setBrief] = useState(false);
  const [comments, setComments] = usePersistent<Comment[]>(`rh:${ws.id}:comments`, () =>
    seedComments(ws),
  );
  const online = ws.members.filter((m) => researcher(m)?.online);

  return (
    <div className="rh-card" style={{ overflow: "hidden" }}>
      <header className="rh-wsx-head">
        <div>
          <button className="rh-back" onClick={onBack}>
            <ArrowLeft /> All workspaces
          </button>
          <h2>{ws.title}</h2>
          <div className="rh-wsx-facts">
            <span
              className={`rh-status ${ws.status === "Active" ? "active" : ws.status === "In review" ? "review" : "planning"}`}
            >
              {ws.status === "Active" ? "Active research" : ws.status}
            </span>
            <span>
              <Users /> {ws.members.length} researchers
            </span>
            <span>
              <Building2 /> {ws.institutions.length} institutions
            </span>
            <span>
              <Clock /> Updated {ws.updated}
            </span>
          </div>
        </div>
        <div className="rh-wsx-actions">
          <div className="rh-avatars" aria-label={`${online.length} online`}>
            {ws.members.map((m) => (
              <Avatar key={m} id={m} />
            ))}
          </div>
          <button className="rh-btn sm" onClick={() => hub.toast("Share link copied")}>
            <Share2 /> Share
          </button>
          <button className="rh-btn sm" onClick={() => setBrief(true)}>
            <FileText /> Policy brief
          </button>
          <button className="rh-btn sm primary" onClick={() => setTranslate(true)}>
            <Landmark /> Translate research into policy
          </button>
        </div>
      </header>
      <nav className="rh-tabs" role="tablist" aria-label="Workspace sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon /> {t.label}
          </button>
        ))}
      </nav>
      <div className="rh-wsx-body" key={tab}>
        {tab === "overview" && (
          <Overview
            ws={ws}
            comments={comments}
            onTranslate={() => setTranslate(true)}
            onTab={setTab}
          />
        )}
        {tab === "canvas" && <ResearchCanvas ws={ws} />}
        {tab === "documents" && <Documents ws={ws} />}
        {tab === "datasets" && <WsDatasets ws={ws} />}
        {tab === "gis" && <ResearchMap initialRegion={ws.state} />}
        {tab === "analysis" && <Analysis ws={ws} />}
        {tab === "experiments" && <PolicyExperiment state={ws.state} />}
        {tab === "tasks" && <TaskBoard ws={ws} />}
        {tab === "discussion" && (
          <Discussion ws={ws} comments={comments} setComments={setComments} />
        )}
        {tab === "versions" && <Versions ws={ws} />}
      </div>
      {translate && (
        <Modal
          title="Translate research into policy"
          eyebrow={ws.title}
          onClose={() => setTranslate(false)}
        >
          <TranslateFlow
            ws={ws}
            onBrief={() => {
              setTranslate(false);
              setBrief(true);
            }}
          />
        </Modal>
      )}
      {brief && (
        <Modal
          title="Turn research into a policy brief"
          eyebrow="Publication builder"
          onClose={() => setBrief(false)}
          wide
        >
          <BriefBuilder ws={ws} />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const TIMELINE = ["Question", "Data collection", "Analysis", "Policy simulation", "Publication"];
// Six workspace stages collapse onto the five-step status timeline (findings + brief = publication)
const timelineIndex = (stage: number) => Math.min(4, Math.max(0, stage));

function Overview({
  ws,
  comments,
  onTranslate,
  onTab,
}: {
  ws: Workspace;
  comments: Comment[];
  onTranslate: () => void;
  onTab: (t: TabId) => void;
}) {
  const current = timelineIndex(ws.stage);
  return (
    <div className="rh-two">
      <div>
        <div className="rh-card rh-panel">
          <h4>Research question</h4>
          <p className="rh-question">“{ws.question}”</p>
        </div>
        <div className="rh-card rh-panel">
          <h4>Objectives</h4>
          <ol className="rh-objectives">
            {ws.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </div>
        <div className="rh-card rh-panel">
          <h4>Methodology</h4>
          <div className="rh-methods">
            {ws.methods.map((m, i) => (
              <span key={m} style={{ display: "contents" }}>
                {i > 0 && <i>+</i>}
                <span className="rh-tag">{m}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="rh-card rh-panel">
          <h4>Evidence base</h4>
          <div className="rh-ev-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <button
              className="rh-card"
              style={{
                textAlign: "left",
                cursor: "pointer",
                padding: "10px 12px",
                background: "#F5F8F3",
                border: 0,
              }}
              onClick={() => onTab("documents")}
            >
              <strong className="rh-display" style={{ fontSize: 26 }}>
                {ws.paperIds.length}
              </strong>
              <span className="rh-muted" style={{ fontSize: 12 }}>
                {" "}
                papers
              </span>
            </button>
            <button
              className="rh-card"
              style={{
                textAlign: "left",
                cursor: "pointer",
                padding: "10px 12px",
                background: "#F5F8F3",
                border: 0,
              }}
              onClick={() => onTab("datasets")}
            >
              <strong className="rh-display" style={{ fontSize: 26 }}>
                {ws.datasetIds.length}
              </strong>
              <span className="rh-muted" style={{ fontSize: 12 }}>
                {" "}
                datasets
              </span>
            </button>
            <button
              className="rh-card"
              style={{
                textAlign: "left",
                cursor: "pointer",
                padding: "10px 12px",
                background: "#F5F8F3",
                border: 0,
              }}
              onClick={() => onTab("gis")}
            >
              <strong className="rh-display" style={{ fontSize: 26 }}>
                {ws.layerIds.length}
              </strong>
              <span className="rh-muted" style={{ fontSize: 12 }}>
                {" "}
                GIS layers
              </span>
            </button>
          </div>
        </div>
      </div>
      <div>
        <div className="rh-card rh-panel">
          <h4>Research status</h4>
          <ol className="rh-timeline">
            {TIMELINE.map((t, i) => (
              <li key={t} className={i < current ? "done" : i === current ? "current" : "todo"}>
                <span className="mark">{i < current && <CheckCircle2 />}</span>
                {t}
                <small>{i < current ? "Complete" : i === current ? "Current" : "Upcoming"}</small>
              </li>
            ))}
          </ol>
          <div className="rh-ws-row" style={{ marginTop: 10 }}>
            <span>Overall progress</span>
            <b>{ws.progress}%</b>
          </div>
          <div className="rh-progress" style={{ marginTop: 6 }}>
            <span style={{ width: `${ws.progress}%` }} />
          </div>
        </div>
        <div className="rh-card rh-panel">
          <h4>Researchers online</h4>
          <div className="rh-people">
            {ws.members.map((m) => {
              const r = researcher(m);
              return r ? (
                <div key={m} className="rh-person">
                  <Avatar id={m} />
                  <div>
                    <strong>{r.name.split(" ")[0]}</strong>
                    <small>{r.institution}</small>
                  </div>
                  <span
                    className={`rh-dot${r.online ? "" : " off"}`}
                    title={r.online ? "Online" : "Offline"}
                  />
                </div>
              ) : null;
            })}
          </div>
        </div>
        <div className="rh-card rh-panel">
          <h4>Latest discussion</h4>
          {comments.slice(0, 1).map((c) => (
            <div key={c.id} className="rh-msg">
              <Avatar id={c.author} />
              <div>
                <div className="rh-msg-head">
                  <b>{researcher(c.author)?.name}</b>
                  <small>{c.time}</small>
                </div>
                <p>
                  <MentionText text={c.text} />
                </p>
              </div>
            </div>
          ))}
          <button
            className="rh-btn sm"
            style={{ marginTop: 12 }}
            onClick={() => onTab("discussion")}
          >
            <MessageSquare /> Open discussion
          </button>
        </div>
        <div
          className="rh-card rh-panel"
          style={{ background: "#06452F", borderColor: "#06452F", color: "#fff" }}
        >
          <h4 style={{ color: "#BDECCF" }}>Research → policy</h4>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.55 }}>
            Carry this workspace's evidence into a policy question, simulate it, and draft a brief.
          </p>
          <button className="rh-btn" onClick={onTranslate}>
            <Landmark /> Translate research into policy <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Research canvas
// ---------------------------------------------------------------------------

const KIND_COLOR: Record<CanvasKind, string> = {
  Question: "#075B3A",
  Hypothesis: "#0B7A4B",
  Dataset: "#7C5CFC",
  Paper: "#3B82F6",
  "GIS Layer": "#2878D0",
  Analysis: "#F59E0B",
  Finding: "#E34D4D",
  Policy: "#06452F",
  Simulation: "#B45309",
};
const KINDS = Object.keys(KIND_COLOR) as CanvasKind[];
const NODE_W = 210;
const NODE_H = 64;

function ResearchCanvas({ ws }: { ws: Workspace }) {
  const [state, setState] = usePersistent(`rh:${ws.id}:canvas`, () => seedCanvas(ws));
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const { nodes, edges } = state;

  const addNode = (kind: CanvasKind) => {
    const id = `n${Date.now()}`;
    const n: CanvasNode = {
      id,
      kind,
      label: `New ${kind.toLowerCase()}`,
      x: 40 + ((nodes.length * 37) % 420),
      y: 360 + ((nodes.length * 23) % 80),
    };
    setState({ nodes: [...nodes, n], edges });
    setFresh(id);
    setEditing(id);
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, n: CanvasNode) => {
    if (connecting) {
      if (!connectFrom) setConnectFrom(n.id);
      else if (connectFrom !== n.id) {
        if (!edges.some((ed) => ed.from === connectFrom && ed.to === n.id))
          setState({ nodes, edges: [...edges, { from: connectFrom, to: n.id }] });
        setConnectFrom(null);
      }
      return;
    }
    if ((e.target as HTMLElement).closest("input,button")) return;
    const rect = area.current!.getBoundingClientRect();
    drag.current = { id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y };
    setDragId(n.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !area.current) return;
    const rect = area.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - NODE_W, e.clientX - rect.left - d.dx));
    const y = Math.max(52, Math.min(rect.height - NODE_H, e.clientY - rect.top - d.dy));
    setState((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) }));
  };
  const onUp = () => {
    drag.current = null;
    setDragId(null);
  };

  const edgePath = (ed: CanvasEdge) => {
    const a = nodes.find((n) => n.id === ed.from),
      b = nodes.find((n) => n.id === ed.to);
    if (!a || !b) return "";
    const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
    if (horizontal) {
      const x1 = b.x > a.x ? a.x + NODE_W : a.x,
        y1 = a.y + NODE_H / 2;
      const x2 = b.x > a.x ? b.x : b.x + NODE_W,
        y2 = b.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    }
    const x1 = a.x + NODE_W / 2,
      y1 = b.y > a.y ? a.y + NODE_H : a.y;
    const x2 = b.x + NODE_W / 2,
      y2 = b.y > a.y ? b.y : b.y + NODE_H;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  };

  return (
    <div className="rh-canvas-wrap">
      <div className="rh-canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        {KINDS.map((k) => (
          <button key={k} onClick={() => addNode(k)} title={`Add ${k}`}>
            <i style={{ background: KIND_COLOR[k] }} /> {k}
          </button>
        ))}
        <hr />
        <button
          className={connecting ? "on" : ""}
          onClick={() => {
            setConnecting(!connecting);
            setConnectFrom(null);
          }}
          aria-pressed={connecting}
        >
          <Link2 style={{ width: 13 }} /> Connect
        </button>
        <button onClick={() => setState(seedCanvas(ws))}>Reset</button>
      </div>
      <div
        ref={area}
        className="rh-canvas"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <svg className="edges" aria-hidden="true">
          {edges.map((ed) => (
            <path key={`${ed.from}-${ed.to}`} d={edgePath(ed)} />
          ))}
          {edges.map((ed) => (
            <path key={`f${ed.from}-${ed.to}`} d={edgePath(ed)} className="flow" />
          ))}
        </svg>
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`rh-node${dragId === n.id ? " dragging" : ""}${connectFrom === n.id ? " source" : ""}${fresh === n.id ? " fresh" : ""}`}
            style={{ left: n.x, top: n.y, borderTop: `3px solid ${KIND_COLOR[n.kind]}` }}
            onPointerDown={(e) => onDown(e, n)}
            onDoubleClick={() => setEditing(n.id)}
          >
            <span>
              <i style={{ background: KIND_COLOR[n.kind] }} />
              {n.kind}
            </span>
            {editing === n.id ? (
              <input
                autoFocus
                defaultValue={n.label}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  const label = e.target.value.trim() || n.label;
                  setState((s) => ({
                    ...s,
                    nodes: s.nodes.map((x) => (x.id === n.id ? { ...x, label } : x)),
                  }));
                  setEditing(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                aria-label="Node label"
              />
            ) : (
              <p>{n.label}</p>
            )}
            <button
              className="x"
              aria-label={`Remove ${n.label}`}
              onClick={() =>
                setState({
                  nodes: nodes.filter((x) => x.id !== n.id),
                  edges: edges.filter((ed) => ed.from !== n.id && ed.to !== n.id),
                })
              }
            >
              <X />
            </button>
          </div>
        ))}
        <div className="rh-canvas-hint">
          {connecting
            ? connectFrom
              ? "Now click the node to connect to"
              : "Click a source node"
            : "Drag to arrange · double-click to rename · Connect links nodes"}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents & datasets
// ---------------------------------------------------------------------------

function Documents({ ws }: { ws: Workspace }) {
  const hub = useHub();
  const papers = ws.paperIds.map(paperById).filter(Boolean);
  const policies = POLICIES.filter(
    (g) =>
      g.jurisdiction === ws.state ||
      (g.jurisdiction === "India" && g.topics.some((t) => ws.topics.includes(t))),
  );
  const candidates = PAPERS.filter(
    (p) => !ws.paperIds.includes(p.id) && p.topics.some((t) => ws.topics.includes(t)),
  ).slice(0, 4);
  return (
    <div className="rh-two">
      <div className="rh-mini-list rh-scroll" style={{ "--rh-scroll-h": "720px" } as CSSProperties}>
        <h4
          className="rh-muted"
          style={{ margin: 0, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}
        >
          Research papers · {papers.length}
        </h4>
        {papers.length === 0 && (
          <Empty
            icon={FileText}
            title="No papers linked yet"
            action={
              <button className="rh-btn sm" onClick={() => hub.go("discover")}>
                Discover research
              </button>
            }
          />
        )}
        {papers.map((p, i) => (
          <article key={p!.id} className="rh-card rh-result">
            <div className="rh-result-meta">
              <span className="rh-tag blue">{p!.type}</span>
              {p!.institution} · {p!.year}
              <span className="rh-anchor" style={{ marginLeft: "auto" }}>
                <MessageSquare style={{ width: 11 }} /> {(i * 3 + 2) % 7} annotations
              </span>
            </div>
            <strong>{p!.title}</strong>
            <p>{p!.finding}</p>
            <div>
              <button className="rh-btn sm" onClick={() => hub.openPaper(p!.id)}>
                Read & annotate
              </button>
            </div>
          </article>
        ))}
        <h4
          className="rh-muted"
          style={{
            margin: "12px 0 0",
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          Policy documents · {policies.length}
        </h4>
        {policies.map((g) => (
          <div key={g.id} className="rh-card rh-mini">
            <Landmark style={{ color: "#F59E0B" }} />
            <div>
              <strong style={{ whiteSpace: "normal" }}>{g.title}</strong>
              <small>
                {g.issuer} · {g.year}
              </small>
            </div>
          </div>
        ))}
      </div>
      <div className="rh-card rh-panel">
        <h4>Suggested for this workspace</h4>
        {candidates.length ? (
          candidates.map((p) => (
            <div
              key={p.id}
              className="rh-mini"
              style={{ padding: "8px 0", borderBottom: "1px solid #e2e8e0" }}
            >
              <FileText style={{ color: "#3B82F6" }} />
              <div style={{ flex: 1 }}>
                <strong style={{ whiteSpace: "normal" }}>{p.title}</strong>
                <small>
                  {p.institution} · {p.year}
                </small>
              </div>
              <button
                className="rh-btn sm"
                onClick={() => hub.addToWorkspace("paper", p.id, ws.id)}
              >
                <Plus /> Add
              </button>
            </div>
          ))
        ) : (
          <p className="rh-muted" style={{ fontSize: 13 }}>
            All related studies are already linked.
          </p>
        )}
      </div>
    </div>
  );
}

function WsDatasets({ ws }: { ws: Workspace }) {
  const hub = useHub();
  const linked = ws.datasetIds.map(datasetById).filter(Boolean);
  const others = DATASETS.filter((d) => !ws.datasetIds.includes(d.id));
  return (
    <>
      {linked.length ? (
        <div className="rh-ds-grid">
          {linked.map((d) => (
            <DatasetCard key={d!.id} d={d!} onAdd={() => hub.toast("Already in this workspace")} />
          ))}
        </div>
      ) : (
        <Empty
          icon={Database}
          title="No saved datasets"
          action={
            <button className="rh-btn sm primary" onClick={() => hub.go("datasets")}>
              Explore dataset repository
            </button>
          }
        />
      )}
      <h4
        className="rh-muted"
        style={{
          margin: "22px 0 10px",
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
        }}
      >
        Add from the repository
      </h4>
      <div className="rh-mini-list">
        {others.slice(0, 5).map((d) => (
          <div key={d.id} className="rh-card rh-mini">
            <Database style={{ color: "#7C5CFC" }} />
            <div style={{ flex: 1 }}>
              <strong>{d.name}</strong>
              <small>
                {d.source} · {d.resolution} · {d.temporal}
              </small>
            </div>
            <button
              className="rh-btn sm"
              onClick={() => hub.addToWorkspace("dataset", d.id, ws.id)}
            >
              <Plus /> Add
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Analysis — land-use trajectories from the shared scenario model
// ---------------------------------------------------------------------------

const YEARS = ["2018", "2019", "2020", "2021", "2022", "2023", "2024"];

function Analysis({ ws }: { ws: Workspace }) {
  const series = useMemo(() => YEARS.map((y) => yearShares(ws.state, y)), [ws.state]);
  const [hover, setHover] = useState<number | null>(null);
  const first = series[0]!,
    last = series[series.length - 1]!;
  const shown = ["agri", "forest", "built"] as const;
  const W = 560,
    H = 220,
    pl = 40,
    pr = 12,
    pt = 12,
    pb = 26;
  // Index each class to 2018 = 100 so different magnitudes share one axis
  const idx = (c: (typeof shown)[number], i: number) => (series[i]![c] / (first[c] || 1)) * 100;
  const vals = shown.flatMap((c) => YEARS.map((_, i) => idx(c, i)));
  const lo = Math.floor(Math.min(...vals) - 2),
    hi = Math.ceil(Math.max(...vals) + 2);
  const x = (i: number) => pl + (i / (YEARS.length - 1)) * (W - pl - pr);
  const y = (v: number) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const flows = scenarioFlows(first, {
    built: last.built - first.built,
    forest: last.forest - first.forest,
    water: last.water - first.water,
    agri: 0,
  });
  const color = (c: string) => LULC_CLASSES[LAND_CLASS_ORDER.indexOf(c as never)]!.color;
  const label = (c: string) => LULC_CLASSES[LAND_CLASS_ORDER.indexOf(c as never)]!.label;
  const focus = hover ?? YEARS.length - 1;
  return (
    <div className="rh-two">
      <div className="rh-card rh-panel">
        <h4>Land-use trajectory · {ws.state} · index 2018 = 100</h4>
        <div className="rh-chart-legend">
          {shown.map((c) => (
            <span key={c}>
              <i style={{ background: color(c) }} />
              {label(c)}
            </span>
          ))}
        </div>
        <svg
          className="rh-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Agriculture, forest and built-up area in ${ws.state} indexed to 2018`}
          onMouseLeave={() => setHover(null)}
        >
          {[lo, (lo + hi) / 2, hi].map((v) => (
            <g key={v}>
              <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="grid" />
              <text x={pl - 6} y={y(v) + 3} textAnchor="end" className="axis">
                {v.toFixed(0)}
              </text>
            </g>
          ))}
          {YEARS.map((yr, i) => (
            <text key={yr} x={x(i)} y={H - 8} textAnchor="middle" className="axis">
              {yr}
            </text>
          ))}
          <line
            x1={x(focus)}
            x2={x(focus)}
            y1={pt}
            y2={H - pb}
            stroke="#cfd9d1"
            strokeDasharray="3 3"
          />
          {shown.map((c) => (
            <g key={c}>
              <path
                className="line"
                stroke={color(c) === "#F6C515" ? "#C99A00" : color(c)}
                d={YEARS.map((_, i) => `${i ? "L" : "M"}${x(i)},${y(idx(c, i))}`).join(" ")}
              />
              <circle
                cx={x(focus)}
                cy={y(idx(c, focus))}
                r={4.5}
                fill="#fff"
                stroke={color(c) === "#F6C515" ? "#C99A00" : color(c)}
                strokeWidth={2}
              />
              <text
                x={W - pr}
                y={y(idx(c, YEARS.length - 1)) - 7}
                textAnchor="end"
                className="axis"
                style={{ fontWeight: 700, fill: "#17231D" }}
              >
                {label(c)}
              </text>
            </g>
          ))}
          {YEARS.map((yr, i) => (
            <rect
              key={yr}
              x={x(i) - 40}
              y={0}
              width={80}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        <p className="rh-muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          {YEARS[focus]}: agriculture {series[focus]!.agri.toFixed(1)}% · forest{" "}
          {series[focus]!.forest.toFixed(1)}% · built-up {series[focus]!.built.toFixed(1)}% of state
          area (simulated)
        </p>
      </div>
      <div>
        <div className="rh-card rh-panel">
          <h4>Transitions 2018 → 2024</h4>
          <div className="rh-scroll" style={{ "--rh-scroll-h": "300px" } as CSSProperties}>
            <table className="rh-matrix-tbl">
              <thead>
                <tr>
                  <th>From → To</th>
                  <th>% of area</th>
                  <th>≈ km²</th>
                </tr>
              </thead>
              <tbody>
                {flows
                  .sort((a, b) => b.pp - a.pp)
                  .map((f) => (
                    <tr key={`${f.from}-${f.to}`}>
                      <td>
                        {label(f.from)} → {label(f.to)}
                      </td>
                      <td>{f.pp.toFixed(2)}</td>
                      <td>
                        {Math.round((f.pp / 100) * (STATE_AREA_KM2[ws.state] ?? 0)).toLocaleString(
                          "en-IN",
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="rh-muted" style={{ margin: "8px 0 0", fontSize: 11 }}>
            From Bhumi-Niti's demonstration land-use model; km² from the state boundary area.
          </p>
        </div>
        <div className="rh-card rh-panel">
          <h4>Net change 2018 → 2024</h4>
          {(["agri", "forest", "built", "water"] as const).map((c) => {
            const d = last[c] - first[c];
            return (
              <div key={c} className="rh-ws-row" style={{ padding: "5px 0" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i style={{ width: 10, height: 10, borderRadius: 2, background: color(c) }} />
                  {label(c)}
                </span>
                <b className={d < 0 ? "rh-bad" : "rh-good"}>
                  {d > 0 ? "+" : ""}
                  {d.toFixed(2)} pp
                </b>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task board
// ---------------------------------------------------------------------------

function TaskBoard({ ws }: { ws: Workspace }) {
  const [tasks, setTasks] = usePersistent<Task[]>(`rh:${ws.id}:tasks`, () => seedTasks(ws));
  const [over, setOver] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const move = (id: string, column: Task["column"]) =>
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, column } : x)));
  return (
    <>
      <div className="rh-kanban">
        {TASK_COLUMNS.map((col, ci) => {
          const list = tasks.filter((t) => t.column === col);
          return (
            <div
              key={col}
              className={`rh-col${over === col ? " over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                move(e.dataTransfer.getData("text/plain"), col);
                setOver(null);
              }}
            >
              <div className="rh-col-head">
                {col}
                <b>{list.length}</b>
              </div>
              {list.map((t) => (
                <div
                  key={t.id}
                  className="rh-task"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                >
                  {t.title}
                  <div className="rh-task-foot">
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar id={t.assignee} online={false} />
                      {researcher(t.assignee)?.name.split(" ")[0]}
                    </span>
                    <span>{t.due}</span>
                  </div>
                  <div className="rh-task-foot">
                    <span className="rh-tag">{t.tag}</span>
                    {ci < TASK_COLUMNS.length - 1 && (
                      <button
                        className="rh-btn ghost sm"
                        style={{ minHeight: 22, padding: "0 6px" }}
                        onClick={() => move(t.id, TASK_COLUMNS[ci + 1]!)}
                        aria-label={`Move to ${TASK_COLUMNS[ci + 1]}`}
                      >
                        →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {ci === 0 && (
                <form
                  className="rh-add-task"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    setTasks((t) => [
                      ...t,
                      {
                        id: `t${Date.now()}`,
                        title: draft.trim(),
                        assignee: ws.members[0] ?? "aditi",
                        column: col,
                        due: "TBD",
                        tag: ws.topics[0] ?? "Land Use",
                      },
                    ]);
                    setDraft("");
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="+ Add a research task"
                    aria-label="New task"
                  />
                </form>
              )}
              {list.length === 0 && ci !== 0 && (
                <p
                  className="rh-muted"
                  style={{ fontSize: 12, textAlign: "center", margin: "12px 0" }}
                >
                  Drop tasks here
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="rh-muted" style={{ fontSize: 12, marginTop: 10 }}>
        <ListChecks style={{ width: 13, verticalAlign: -2 }} /> Drag cards between columns, or use →
        to advance a task.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Discussion
// ---------------------------------------------------------------------------

function MentionText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(@[A-Z][a-z]+)/g).map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="rh-mention">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Discussion({
  ws,
  comments,
  setComments,
}: {
  ws: Workspace;
  comments: Comment[];
  setComments: (v: Comment[] | ((p: Comment[]) => Comment[])) => void;
}) {
  const me = ws.members[0] ?? "aditi";
  const [text, setText] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const post = () => {
    if (!text.trim()) return;
    setComments((c) => [
      { id: `c${Date.now()}`, author: me, text: text.trim(), time: "just now", replies: [] },
      ...c,
    ]);
    setText("");
  };
  return (
    <div className="rh-two">
      <div>
        <div className="rh-card rh-panel">
          <h4>New comment</h4>
          <div className="rh-compose">
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share a note — use @name to mention a collaborator"
              aria-label="New comment"
            />
            <button className="rh-btn primary" onClick={post} aria-label="Post comment">
              <Send />
            </button>
          </div>
          <div className="rh-chips" style={{ marginTop: 8 }}>
            {ws.members
              .filter((m) => m !== me)
              .map((m) => (
                <button
                  key={m}
                  className="rh-chip"
                  onClick={() =>
                    setText(
                      (t) =>
                        `${t}${t && !t.endsWith(" ") ? " " : ""}@${researcher(m)?.name.split(" ")[0]} `,
                    )
                  }
                >
                  @{researcher(m)?.name.split(" ")[0]}
                </button>
              ))}
          </div>
        </div>
        <div
          className="rh-scroll"
          style={{ marginTop: 16, "--rh-scroll-h": "680px" } as CSSProperties}
        >
          {comments.map((c) => (
            <div key={c.id} className="rh-thread">
              {c.anchor && (
                <div style={{ marginBottom: 8 }}>
                  <span className="rh-anchor">Annotation · {c.anchor}</span>
                </div>
              )}
              <div className="rh-msg">
                <Avatar id={c.author} />
                <div>
                  <div className="rh-msg-head">
                    <b>{researcher(c.author)?.name}</b>
                    <small>
                      {researcher(c.author)?.institution} · {c.time}
                    </small>
                  </div>
                  <p>
                    <MentionText text={c.text} />
                  </p>
                </div>
              </div>
              <div className="rh-replies">
                {c.replies.map((r, i) => (
                  <div key={i} className="rh-msg">
                    <Avatar id={r.author} />
                    <div>
                      <div className="rh-msg-head">
                        <b>{researcher(r.author)?.name}</b>
                        <small>{r.time}</small>
                      </div>
                      <p>
                        <MentionText text={r.text} />
                      </p>
                    </div>
                  </div>
                ))}
                <form
                  className="rh-compose"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = replies[c.id]?.trim();
                    if (!v) return;
                    setComments((all) =>
                      all.map((x) =>
                        x.id === c.id
                          ? {
                              ...x,
                              replies: [...x.replies, { author: me, text: v, time: "just now" }],
                            }
                          : x,
                      ),
                    );
                    setReplies({ ...replies, [c.id]: "" });
                  }}
                >
                  <input
                    value={replies[c.id] ?? ""}
                    onChange={(e) => setReplies({ ...replies, [c.id]: e.target.value })}
                    placeholder="Reply…"
                    aria-label="Reply"
                  />
                  <button className="rh-btn sm" type="submit">
                    Reply
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rh-card rh-panel" style={{ alignSelf: "start" }}>
        <h4>Researchers online</h4>
        <div className="rh-people">
          {ws.members.map((m) => {
            const r = researcher(m);
            return r ? (
              <div key={m} className="rh-person">
                <Avatar id={m} />
                <div>
                  <strong>
                    {r.name.split(" ")[0]} —{" "}
                    {r.institution.replace("Ministry of Rural Development", "MoRD")}
                  </strong>
                  <small>{r.role}</small>
                </div>
                <span className={`rh-dot${r.online ? "" : " off"}`} />
              </div>
            ) : null;
          })}
        </div>
        <h4 style={{ marginTop: 18 }}>Collaboration tools</h4>
        <div className="rh-tags">
          {[
            "Comments",
            "Mentions",
            "Annotations",
            "Tasks",
            "Research notes",
            "Version history",
          ].map((t) => (
            <span key={t} className="rh-tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

function Versions({ ws }: { ws: Workspace }) {
  const hub = useHub();
  const [versions, setVersions] = usePersistent<Version[]>(`rh:${ws.id}:versions`, () =>
    seedVersions(ws),
  );
  const [note, setNote] = useState("");
  return (
    <div className="rh-two">
      <div className="rh-card rh-panel">
        <h4>Version history</h4>
        <ul className="rh-versions rh-scroll" style={{ "--rh-scroll-h": "520px" } as CSSProperties}>
          {versions.map((v, i) => (
            <li key={v.id} className={i === 0 ? "current" : ""}>
              <b>{v.label}</b>
              <div>
                <strong style={{ fontSize: 13 }}>{v.note}</strong>
                <div className="rh-muted" style={{ fontSize: 12 }}>
                  {researcher(v.author)?.name} · {v.time}
                </div>
              </div>
              {i === 0 ? (
                <span className="rh-tag">Current</span>
              ) : (
                <button
                  className="rh-btn sm"
                  onClick={() => hub.toast(`Restored ${v.label} as a new draft`)}
                >
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="rh-card rh-panel" style={{ alignSelf: "start" }}>
        <h4>Save a version</h4>
        <form
          className="rh-form"
          onSubmit={(e) => {
            e.preventDefault();
            const n = versions.length + 1;
            setVersions([
              {
                id: `v${Date.now()}`,
                label: `v0.${n}`,
                author: ws.members[0] ?? "aditi",
                time: "just now",
                note: note.trim() || "Checkpoint",
              },
              ...versions,
            ]);
            setNote("");
            hub.toast("Version saved");
          }}
        >
          <label>
            What changed?
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Added field validation results"
            />
          </label>
          <button className="rh-btn primary" type="submit">
            <Sparkles /> Save version
          </button>
        </form>
      </div>
    </div>
  );
}
