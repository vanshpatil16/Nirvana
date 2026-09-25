import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Command,
  Compass,
  Database,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe2,
  Home,
  Landmark,
  Lightbulb,
  Map as MapIcon,
  Menu,
  Moon,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { navItems } from "@/data/dashboard";
import {
  FILTER_TOPICS,
  PAPERS,
  WORKSPACES,
  datasetById,
  paperById,
  type Paper,
  type Topic,
  type Workspace,
} from "@/data/research-hub";
import { STATE_NAMES } from "@/data/land-scenario";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import { HubContext, useHub, type EvidenceKind, type HubApi, type HubView } from "./hub-context";
import {
  DatasetExplorer,
  DatasetPreview,
  DiscoverSearch,
  Empty,
  HeroVideo,
  GapExplorer,
  CaseStudies,
  LifecycleStrip,
  NationalPipeline,
  SnapshotMetrics,
  LiteratureReviewPanel,
  Modal,
  PaperCard,
  PaperDetail,
  PolicyEvidenceList,
  PolicyExperiment,
  ProposalForm,
  ResearchNetwork,
  TranslateFlow,
  BriefBuilder,
  WorkspaceCard,
} from "./ResearchSections";
import { WorkspaceView } from "./Workspace";
import { STAGE_OF_VIEW } from "./research-model";
import { ResearchMap } from "./ResearchMap";
import "./research-hub.css";

const ACTIVE_ITEM = "Research Hub";

const SUBNAV: { view: HubView; label: string }[] = [
  { view: "discover", label: "Discover" },
  { view: "my-research", label: "My Research" },
  { view: "workspaces", label: "Workspaces" },
  { view: "datasets", label: "Datasets" },
  { view: "publications", label: "Publications" },
  { view: "policy-evidence", label: "Policy Evidence" },
  { view: "network", label: "Research Network" },
];

const RAIL: { view: HubView; label: string; icon: typeof Home }[] = [
  { view: "overview", label: "Overview", icon: Home },
  { view: "discover", label: "Discover", icon: Search },
  { view: "my-research", label: "My Research", icon: FolderOpen },
  { view: "workspaces", label: "Workspaces", icon: Users },
  { view: "gis", label: "GIS Explorer", icon: MapIcon },
  { view: "datasets", label: "Datasets", icon: BarChart3 },
  { view: "publications", label: "Publications", icon: BookOpen },
  { view: "policy-evidence", label: "Policy Evidence", icon: Landmark },
  { view: "experiments", label: "Policy Experiments", icon: FlaskConical },
  { view: "network", label: "Research Network", icon: Globe2 },
  { view: "gaps", label: "Research Gaps", icon: Lightbulb },
];

const ME = "aditi";

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — state stays in memory
  }
}

// ---------------------------------------------------------------------------
// Shell (same global sidebar + header as the rest of Bhumi-Niti)
// ---------------------------------------------------------------------------

function Shell({
  drawer,
  close,
  children,
}: {
  drawer: boolean;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <aside className={`sidebar ${drawer ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <img src={logo} alt="BHUMI-NITI Logo" width={38} height={38} />
            </span>
            <div>
              <strong>BHUMI-NITI</strong>
              <b>भूमि-नीति</b>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-close"
            onClick={close}
            aria-label="Close navigation"
          >
            <X />
          </Button>
          <p>National Platform for Research & Policy Innovation in Land Governance</p>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive = label === ACTIVE_ITEM;
            if (href) {
              return (
                <a
                  key={label}
                  href={href}
                  className={isActive ? "active" : ""}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon />
                  <span>{label}</span>
                </a>
              );
            }
            return (
              <button
                key={label}
                className={isActive ? "active" : ""}
                title={`${label} — coming soon`}
              >
                <Icon />
                <span>{label}</span>
                <i>Soon</i>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <img
            src={sidenavBottom}
            alt="Same Land, More Clarity, Better Decisions — Government of India, Ministry of Rural Development, Department of Land Resources"
          />
        </div>
      </aside>
      {drawer && (
        <button className="drawer-backdrop" onClick={close} aria-label="Close navigation" />
      )}
      {children}
    </>
  );
}

function PageHeader({ openMenu, onSearch }: { openMenu: () => void; onSearch: () => void }) {
  return (
    <header className="top-header">
      <Button
        variant="ghost"
        size="icon"
        className="menu-button"
        onClick={openMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <label className="global-search">
        <Search />
        <input
          placeholder="Search research, datasets, policies, researchers…"
          aria-label="Search the Research Hub"
          onFocus={onSearch}
          readOnly
        />
        <kbd>
          <Command /> K
        </kbd>
      </label>
      <div className="header-tools">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme settings">
              <Moon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Light appearance</TooltipContent>
        </Tooltip>
        <button className="lang">
          EN <ChevronDown />
        </button>
        <Button variant="ghost" size="icon" className="notification" aria-label="Notifications">
          <Bell />
          <i />
        </Button>
        <button className="profile">
          <span>OK</span>
          <div>
            <strong>Omkar Kudalkar</strong>
            <small>Researcher</small>
          </div>
          <ChevronDown />
        </button>
      </div>
    </header>
  );
}

function SectionHead({
  eyebrow,
  icon: Icon,
  title,
  children,
  action,
}: {
  eyebrow: string;
  icon?: typeof Home;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rh-section-head">
      <div>
        <span className="rh-eyebrow">
          {Icon && <Icon />}
          {eyebrow}
        </span>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ResearchHub({
  view: initialView,
  workspaceId,
  onNavigate,
}: {
  view?: HubView | undefined;
  workspaceId?: string | undefined;
  onNavigate?: ((view: HubView, ws?: string) => void) | undefined;
}) {
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState<HubView>(initialView ?? "overview");
  const [openWs, setOpenWs] = useState<string | null>(workspaceId ?? null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(WORKSPACES);
  const [saved, setSaved] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [paper, setPaper] = useState<string | null>(null);
  const [dataset, setDataset] = useState<string | null>(null);
  const [chooser, setChooser] = useState<{ kind: EvidenceKind; id: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [proposal, setProposal] = useState<{ theme: string; state: string } | null>(null);

  // Restore demo state saved in this browser (after hydration, so SSR markup matches)
  useEffect(() => {
    setWorkspaces(readStore("rh:workspaces", WORKSPACES));
    setSaved(readStore("rh:saved", ["p1", "p9"]));
  }, []);
  useEffect(() => writeStore("rh:workspaces", workspaces), [workspaces]);
  useEffect(() => writeStore("rh:saved", saved), [saved]);

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);
  useEffect(() => {
    setOpenWs(workspaceId ?? null);
  }, [workspaceId]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2600);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const go = useCallback(
    (v: HubView) => {
      setView(v);
      setOpenWs(null);
      onNavigate?.(v);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onNavigate],
  );

  const api: HubApi = useMemo(
    () => ({
      go,
      workspaces,
      openWorkspace: (id) => {
        setView("workspaces");
        setOpenWs(id);
        onNavigate?.("workspaces", id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      createWorkspace: (draft) => {
        const ws: Workspace = {
          id: `ws-${Date.now()}`,
          status: "Planning",
          institutions: ["IIT Bombay"],
          members: [ME, "rahul"],
          progress: 5,
          updated: "just now",
          stage: 0,
          objectives: [
            "Frame the research question with partners",
            "Assemble evidence and datasets",
            "Design analysis and policy scenarios",
          ],
          methods: ["Remote sensing", "GIS", "Policy analysis"],
          paperIds: [],
          datasetIds: [],
          layerIds: ["l1"],
          ...draft,
        };
        setWorkspaces((prev) => [ws, ...prev]);
        return ws;
      },
      addToWorkspace: (kind, id, workspaceId) => {
        if (!workspaceId) {
          setChooser({ kind, id });
          return;
        }
        const field =
          kind === "paper"
            ? "paperIds"
            : kind === "dataset"
              ? "datasetIds"
              : kind === "layer"
                ? "layerIds"
                : null;
        const target = workspaces.find((w) => w.id === workspaceId);
        if (field && target) {
          if (!target[field].includes(id))
            setWorkspaces((prev) =>
              prev.map((w) =>
                w.id === workspaceId
                  ? { ...w, [field]: [...w[field], id], updated: "just now" }
                  : w,
              ),
            );
        }
        setToastMsg(`Added to ${target?.title ?? "workspace"}`);
      },
      saved,
      toggleSaved: (pid) => {
        const on = saved.includes(pid);
        setSaved((prev) => (on ? prev.filter((x) => x !== pid) : [...prev, pid]));
        setToastMsg(on ? "Removed from My Research" : "Saved to My Research");
      },
      openPaper: setPaper,
      openDataset: setDataset,
      toast: setToastMsg,
    }),
    [go, workspaces, saved, onNavigate],
  );

  const activeWs = openWs ? workspaces.find((w) => w.id === openWs) : undefined;
  const stage = activeWs ? 2 : STAGE_OF_VIEW[view];
  const paperObj = paper ? paperById(paper) : undefined;
  const datasetObj = dataset ? datasetById(dataset) : undefined;

  return (
    <HubContext.Provider value={api}>
      <TooltipProvider>
        <div className="dashboard-shell">
          <Shell drawer={drawer} close={() => setDrawer(false)}>
            <main>
              <PageHeader openMenu={() => setDrawer(true)} onSearch={() => go("discover")} />
              <div className="dashboard-content rh">
                <div className="rh-subnav">
                  <button
                    className="rh-subnav-title"
                    onClick={() => go("overview")}
                    style={{
                      border: 0,
                      borderRight: "1px solid var(--rh-line)",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <BookOpen /> Research Hub
                  </button>
                  <nav aria-label="Research Hub sections">
                    {SUBNAV.map((s) => (
                      <button
                        key={s.view}
                        className={view === s.view ? "active" : ""}
                        aria-current={view === s.view ? "page" : undefined}
                        onClick={() => go(s.view)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </nav>
                </div>
                <div className="rh-layout">
                  <aside className="rh-rail" aria-label="Research Hub navigation">
                    <h4>Research Hub</h4>
                    {RAIL.map((r) => (
                      <button
                        key={r.view}
                        className={view === r.view ? "active" : ""}
                        onClick={() => go(r.view)}
                      >
                        <r.icon /> {r.label}
                      </button>
                    ))}
                    <p className="rh-rail-note">
                      <ShieldCheck style={{ width: 13, verticalAlign: -2 }} /> Platform
                      demonstration data. Studies, researchers and metrics shown here are
                      illustrative.
                    </p>
                  </aside>
                  <div className="rh-main">
                    {stage >= 0 && <LifecycleStrip stage={stage} />}
                    {activeWs ? (
                      <WorkspaceView ws={activeWs} onBack={() => go("workspaces")} />
                    ) : (
                      <View
                        view={view}
                        onCreate={() => setCreating(true)}
                        onPropose={(theme, state) => setProposal({ theme, state })}
                      />
                    )}
                  </div>
                </div>
              </div>
            </main>
          </Shell>
        </div>

        {paperObj && (
          <Modal title={paperObj.title} eyebrow={paperObj.type} onClose={() => setPaper(null)} wide>
            <PaperDetail paper={paperObj} />
          </Modal>
        )}
        {datasetObj && (
          <Modal
            title={datasetObj.name}
            eyebrow={`Dataset · ${datasetObj.kind}`}
            onClose={() => setDataset(null)}
          >
            <DatasetPreview d={datasetObj} />
          </Modal>
        )}
        {chooser && (
          <Modal title="Add to a workspace" eyebrow="Collaborate" onClose={() => setChooser(null)}>
            <div className="rh-mini-list">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  className="rh-card rh-mini rh-lift"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => {
                    api.addToWorkspace(chooser.kind, chooser.id, w.id);
                    setChooser(null);
                  }}
                >
                  <Users style={{ color: "#075B3A" }} />
                  <div style={{ flex: 1 }}>
                    <strong>{w.title}</strong>
                    <small>
                      {w.state} · {w.members.length} researchers · {w.status}
                    </small>
                  </div>
                  <Plus style={{ width: 16 }} />
                </button>
              ))}
              <button
                className="rh-btn"
                onClick={() => {
                  setChooser(null);
                  setCreating(true);
                }}
              >
                <Plus /> New workspace
              </button>
            </div>
          </Modal>
        )}
        {creating && (
          <Modal
            title="Start a research workspace"
            eyebrow="New workspace"
            onClose={() => setCreating(false)}
          >
            <CreateWorkspaceForm onDone={() => setCreating(false)} />
          </Modal>
        )}
        {proposal && (
          <Modal
            title="Create research proposal"
            eyebrow="From the research gap explorer"
            onClose={() => setProposal(null)}
          >
            <ProposalForm
              theme={proposal.theme}
              state={proposal.state}
              onDone={() => setProposal(null)}
            />
          </Modal>
        )}
        {toastMsg && (
          <div className="rh-toast rh" role="status">
            <CheckCircle2 /> {toastMsg}
          </div>
        )}
      </TooltipProvider>
    </HubContext.Provider>
  );
}

function CreateWorkspaceForm({ onDone }: { onDone: () => void }) {
  const hub = useHub();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [topics, setTopics] = useState<Topic[]>(["Land Use"]);
  return (
    <form
      className="rh-form"
      onSubmit={(e) => {
        e.preventDefault();
        const ws = hub.createWorkspace({ title, question, state, topics });
        hub.toast(`Workspace created: ${ws.title}`);
        onDone();
        hub.openWorkspace(ws.id);
      }}
    >
      <label>
        Workspace title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Karnataka Cadastral Resurvey Evaluation"
        />
      </label>
      <label>
        Research question
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          placeholder="What do you want to find out?"
        />
      </label>
      <label>
        Primary state
        <select value={state} onChange={(e) => setState(e.target.value)}>
          {STATE_NAMES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Themes
        <div className="rh-chips" style={{ marginTop: 0 }}>
          {FILTER_TOPICS.map((t) => (
            <button
              type="button"
              key={t}
              className={`rh-chip${topics.includes(t) ? " on" : ""}`}
              onClick={() =>
                setTopics((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
              }
            >
              {t}
            </button>
          ))}
        </div>
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="rh-btn" onClick={onDone}>
          Cancel
        </button>
        <button className="rh-btn primary" type="submit">
          <Plus /> Create workspace
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function View({
  view,
  onCreate,
  onPropose,
}: {
  view: HubView;
  onCreate: () => void;
  onPropose: (theme: string, state: string) => void;
}) {
  const hub = useHub();
  const featured = PAPERS.slice()
    .sort((a, b) => b.year - a.year || b.citations - a.citations)
    .slice(0, 6);
  const [pubType, setPubType] = useState<string>("All");
  const [briefWs, setBriefWs] = useState<string>(hub.workspaces[0]?.id ?? "");
  const [expState, setExpState] = useState("Maharashtra");
  const wsForBrief = hub.workspaces.find((w) => w.id === briefWs) ?? hub.workspaces[0];

  switch (view) {
    case "overview":
      return (
        <>
          <section className="rh-hero rh-hero-home" aria-label="Research Hub introduction">
            <div>
              <span className="rh-eyebrow">
                <Sparkles /> Bhumi-Niti Research Hub
              </span>
              <h1>
                Research that shapes <em>better land policy.</em>
              </h1>
              <p>
                Discover evidence, collaborate across institutions, analyze geospatial data, and
                transform land governance research into actionable policy.
              </p>
              <div className="rh-hero-ctas">
                <button className="rh-btn primary" onClick={onCreate}>
                  <Plus /> Start a Research Workspace
                </button>
                <button className="rh-btn" onClick={() => hub.go("discover")}>
                  Explore Research <ArrowRight />
                </button>
              </div>
              <div className="rh-hero-meta">
                <span>
                  <CheckCircle2 /> Every AI claim cites its source
                </span>
                <span>
                  <MapIcon /> Built on the Bhumi-Niti GIS
                </span>
                <span>
                  <Landmark /> Linked to policy experiments
                </span>
              </div>
            </div>
            <HeroVideo />
          </section>
        </>
      );

    case "discover":
      return (
        <>
          <SectionHead
            eyebrow="Discover"
            icon={Compass}
            title="Explore the Land Governance Knowledge Graph"
          >
            Natural-language search across studies, datasets, policies and GIS layers.
          </SectionHead>
          <SnapshotMetrics />
          <div className="rh-section" style={{ marginTop: 24 }}>
            <DiscoverSearch initialQuery="How has urban expansion affected agricultural land in Maharashtra?" />
          </div>
          <div className="rh-section">
            <LiteratureReviewPanel />
          </div>
          <section className="rh-section">
            <SectionHead eyebrow="Case studies" icon={MapIcon} title="Land Governance Case Studies">
              Places where land-use transitions, policy, climate risk and disputes meet.
            </SectionHead>
            <CaseStudies />
          </section>
        </>
      );

    case "my-research": {
      const mine = hub.workspaces.filter((w) => w.members.includes(ME));
      const savedPapers = hub.saved.map(paperById).filter((p): p is Paper => !!p);
      return (
        <>
          <SectionHead
            eyebrow="My research"
            icon={FolderOpen}
            title="Your research at a glance"
            action={
              <button className="rh-btn primary" onClick={onCreate}>
                <Plus /> New workspace
              </button>
            }
          />
          <h3
            className="rh-muted"
            style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase" }}
          >
            My workspaces · {mine.length}
          </h3>
          {mine.length ? (
            <div className="rh-ws-grid">
              {mine.map((w) => (
                <WorkspaceCard key={w.id} ws={w} />
              ))}
            </div>
          ) : (
            <Empty
              icon={Users}
              title="No active research workspaces yet."
              action={
                <button className="rh-btn primary sm" onClick={onCreate}>
                  Create your first workspace
                </button>
              }
            />
          )}
          <h3
            className="rh-muted"
            style={{
              fontSize: 12,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              marginTop: 30,
            }}
          >
            Saved research · {savedPapers.length}
          </h3>
          {savedPapers.length ? (
            <div className="rh-grid">
              {savedPapers.map((p) => (
                <PaperCard key={p.id} paper={p} />
              ))}
            </div>
          ) : (
            <Empty
              icon={BookOpen}
              title="No saved research yet."
              action={
                <button className="rh-btn primary sm" onClick={() => hub.go("discover")}>
                  Discover research
                </button>
              }
            >
              Use the bookmark on any study to keep it here.
            </Empty>
          )}
        </>
      );
    }

    case "workspaces":
      return (
        <>
          <SectionHead
            eyebrow="Collaborate"
            icon={Users}
            title="Collaborative Research Workspaces"
            action={
              <button className="rh-btn primary" onClick={onCreate}>
                <Plus /> Start a Research Workspace
              </button>
            }
          >
            Move from reading evidence to building research together — question, evidence, analysis,
            simulation, findings and policy brief in one place.
          </SectionHead>
          {hub.workspaces.length ? (
            <div className="rh-ws-grid">
              {hub.workspaces.map((w) => (
                <WorkspaceCard key={w.id} ws={w} />
              ))}
            </div>
          ) : (
            <Empty
              icon={Users}
              title="No active research workspaces yet."
              action={
                <button className="rh-btn primary sm" onClick={onCreate}>
                  Create your first workspace
                </button>
              }
            />
          )}
        </>
      );

    case "gis":
      return (
        <>
          <SectionHead
            eyebrow="Analyze"
            icon={MapIcon}
            title="GIS Research View"
            action={
              <a className="rh-btn" href="/landdifference">
                Open Land Difference <ArrowRight />
              </a>
            }
          >
            Layer land use, change, climate risk, disputes, infrastructure and protected areas on
            Sentinel-2 imagery. Compare any two years.
          </SectionHead>
          <ResearchMap />
        </>
      );

    case "datasets":
      return (
        <>
          <SectionHead eyebrow="Analyze" icon={Database} title="Dataset Explorer">
            Satellite imagery, land records, census, climate and infrastructure datasets — with
            coverage, resolution and licence at a glance.
          </SectionHead>
          <DatasetExplorer />
        </>
      );

    case "publications": {
      const types = ["All", ...Array.from(new Set(PAPERS.map((p) => p.type)))];
      const list = PAPERS.filter((p) => pubType === "All" || p.type === pubType);
      return (
        <>
          <SectionHead eyebrow="Publish" icon={FileText} title="Publications">
            {PAPERS.length} studies in the demonstration catalogue.
          </SectionHead>
          <div className="rh-chips" style={{ marginTop: 0, marginBottom: 16 }}>
            {types.map((t) => (
              <button
                key={t}
                className={`rh-chip${pubType === t ? " on" : ""}`}
                onClick={() => setPubType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="rh-grid">
            {list.map((p) => (
              <PaperCard key={p.id} paper={p} />
            ))}
          </div>
          <section className="rh-section">
            <SectionHead
              eyebrow="Publication builder"
              icon={Sparkles}
              title="Turn research into a policy brief"
              action={
                <select
                  value={briefWs}
                  onChange={(e) => setBriefWs(e.target.value)}
                  className="rh-btn"
                  aria-label="Workspace"
                >
                  {hub.workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              }
            >
              Research notes → evidence → findings → charts → maps → recommendations → brief.
            </SectionHead>
            {wsForBrief ? (
              <BriefBuilder key={wsForBrief.id} ws={wsForBrief} />
            ) : (
              <Empty title="Create a workspace to build a brief" />
            )}
          </section>
        </>
      );
    }

    case "policy-evidence":
      return (
        <>
          <SectionHead eyebrow="Inform policy" icon={Landmark} title="Policy Evidence">
            Connect research findings to policy questions, simulate the options, and draft a brief —
            the bridge to the Policy Lab.
          </SectionHead>
          <div className="rh-two">
            <div className="rh-card rh-panel">
              <h4>Translate research into policy · {wsForBrief?.title}</h4>
              {wsForBrief ? (
                <TranslateFlow
                  key={wsForBrief.id}
                  ws={wsForBrief}
                  onBrief={() => hub.go("publications")}
                />
              ) : (
                <Empty title="No workspace yet" />
              )}
            </div>
            <div>
              <h4
                className="rh-muted"
                style={{
                  margin: "0 0 10px",
                  fontSize: 11,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                Policy documents and linked evidence
              </h4>
              <PolicyEvidenceList />
            </div>
          </div>
          <section className="rh-section">
            <SectionHead
              eyebrow="The platform’s purpose"
              icon={Landmark}
              title="From research question to national policy"
            />
            <NationalPipeline />
          </section>
        </>
      );

    case "experiments":
      return (
        <>
          <SectionHead
            eyebrow="Simulate"
            icon={FlaskConical}
            title="Policy Experiments"
            action={
              <select
                value={expState}
                onChange={(e) => setExpState(e.target.value)}
                className="rh-btn"
                aria-label="State"
              >
                {STATE_NAMES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            }
          >
            Build a scenario and see estimated effects on climate risk, water stress, land use and
            disputes.
          </SectionHead>
          <PolicyExperiment key={expState} state={expState} />
        </>
      );

    case "network":
      return (
        <>
          <SectionHead eyebrow="Collaborate" icon={Globe2} title="National Research Network">
            Find institutions and researchers by state, research area and expertise — and invite
            them into your workspace.
          </SectionHead>
          <ResearchNetwork />
        </>
      );

    case "gaps":
      return (
        <>
          <SectionHead eyebrow="Analyze" icon={Lightbulb} title="Research Gap Explorer">
            Well studied, moderately studied, under-researched and data-deficient themes across
            states.
          </SectionHead>
          <GapExplorer onPropose={onPropose} />
        </>
      );
  }
}
