import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Command,
  Menu,
  Moon,
  MousePointerClick,
  Pause,
  Play,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { impactItems, kpis, navItems } from "@/data/dashboard";
import { THEMES, THEME_ORDER, type ThemeId } from "@/data/state-intelligence";
import { MOSAIC_YEARS, THEME_TIMELINES } from "@/services/temporal";
import type { MapAction, SelectionSnapshot, SimSnapshot } from "./IndiaMap";
import { LandInsightPanel } from "./LandInsightPanel";
import landscape from "@/assets/bhumi-landscape.png";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import { ProfileMenu } from "@/components/ProfileMenu";
import { LoadingScreen } from "@/components/ui/loading";

const IndiaMap = lazy(() => import("./IndiaMap").then((m) => ({ default: m.IndiaMap })));

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <img src={logo} alt="" width={38} height={38} />
      </span>
      <div>
        <strong>NIRVANA</strong>
        <b>निर्वाण</b>
      </div>
    </div>
  );
}

import { AppSidebar } from "@/components/layout/AppSidebar";

function Sidebar({
  open,
  close,
  activeItem = "Dashboard",
}: {
  open: boolean;
  close: () => void;
  activeItem?: string;
}) {
  return <AppSidebar open={open} close={close} activeItem={activeItem} />;
}

function TopHeader({ openMenu }: { openMenu: () => void }) {
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
        <input placeholder="Search villages, districts, policies, research papers, datasets..." />
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
        <ProfileMenu />
      </div>
    </header>
  );
}

function HeroBanner() {
  return (
    <section className="hero">
      <img
        src={landscape}
        width={1536}
        height={768}
        alt="Agricultural landscape, river and village in India"
      />
      <div className="hero-shade" />
      <div className="hero-copy">
        <span>NATIONAL LAND INTELLIGENCE</span>
        <h1>
          Data. People. Policy.
          <br />A Stronger Tomorrow.
        </h1>
        <p>
          Integrated knowledge, real-world evidence and collaborative innovation for sustainable
          land governance.
        </p>
        <div>
          <Button>
            Explore the Map <ArrowRight />
          </Button>
          <Button variant="outline">View Research</Button>
        </div>
      </div>
    </section>
  );
}

// Small trend line for a KPI card (demo annual series, 2017–2024)
function Sparkline({
  values,
  tone,
}: {
  values: readonly number[];
  tone: "good" | "bad" | "neutral";
}) {
  const w = 96,
    h = 34,
    lo = Math.min(...values),
    hi = Math.max(...values);
  const pts = values.map(
    (v, i) =>
      [(i / (values.length - 1)) * w, h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 8)] as const,
  );
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg className={`kpi-spark ${tone}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h} Z`} className="area" />
      <path d={line} className="line" />
      <circle cx={last[0]} cy={last[1]} r={3} />
    </svg>
  );
}

function KPIGrid() {
  return (
    <section className="kpi-grid" aria-label="National land intelligence indicators">
      {kpis.map(({ value, label, change, upIsGood, icon: Icon, series, evidence }) => {
        const tone = upIsGood === null ? "neutral" : change > 0 === upIsGood ? "good" : "bad";
        return (
          <article className="kpi-card" key={label}>
            <div className="kpi-top">
              <span className="kpi-label">
                <Icon aria-hidden="true" />
                {label}
              </span>
            </div>
            <div className="kpi-main">
              <strong>{value}</strong>
              <Sparkline values={series} tone={tone} />
            </div>
            <div className="kpi-foot">
              <b className={`kpi-delta ${tone}`}>
                {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
              </b>
              <small>vs 2023</small>
              <span className="pv-kpi-tag pv-tag-synthetic">{evidence}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function TemporalSide({
  tab,
  year,
  playing,
  speed,
  onTogglePlay,
  onSpeed,
  onYear,
}: {
  tab: ThemeId;
  year: string;
  playing: boolean;
  speed: 0.5 | 1 | 2;
  onTogglePlay: () => void;
  onSpeed: (speed: 0.5 | 1 | 2) => void;
  onYear: (year: string) => void;
}) {
  const timeline = THEME_TIMELINES[tab];
  return (
    <section className="temporal-bar" role="group" aria-label="Move through time">
      <div className="temporal-bar-title">
        <span>{timeline.title}</span>
        <strong>{year}</strong>
      </div>
      <div className="temporal-play">
        <button onClick={onTogglePlay} aria-label={playing ? "Pause timeline" : "Play timeline"}>
          {playing ? <Pause /> : <Play />}
        </button>
        <select
          value={speed}
          onChange={(e) => onSpeed(Number(e.target.value) as 0.5 | 1 | 2)}
          aria-label="Playback speed"
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </select>
      </div>
      <div className="temporal-bar-track">
        <input
          type="range"
          className="temporal-range"
          min={0}
          max={MOSAIC_YEARS.length - 1}
          value={Math.max(0, MOSAIC_YEARS.indexOf(year))}
          onChange={(e) => {
            const next = MOSAIC_YEARS[Number(e.target.value)];
            if (next) onYear(next);
          }}
          aria-label="Select mosaic year"
          aria-valuetext={year}
        />
        <div className="temporal-ticks">
          {MOSAIC_YEARS.map((y) => (
            <button
              key={y}
              className={y === year ? "active" : ""}
              onClick={() => onYear(y)}
              aria-label={`Show ${y}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="temporal-bar-meta">
        <span>
          {timeline.descriptor} · data period {timeline.dataPeriod}
        </span>
        <span className="temporal-status">
          {timeline.status} · {timeline.statusNote}
        </span>
      </div>
    </section>
  );
}

function ImpactSection() {
  return (
    <section className="impact">
      <header>
        <div>
          <h2>From Knowledge to Impact</h2>
          <p>
            Explore how research, innovation and evidence-based policy create measurable outcomes.
          </p>
        </div>
        <button>
          View all modules <ArrowRight />
        </button>
      </header>
      <div className="impact-grid">
        {impactItems.map(({ title, description, icon: Icon }) => (
          <button key={title}>
            <span>
              <Icon />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{description}</small>
            </div>
            <ArrowRight />
          </button>
        ))}
      </div>
    </section>
  );
}

import { useRole } from "@/context/RoleContext";
import { OfficerDashboard } from "./portals/OfficerDashboard";
import { PolicymakerDashboard } from "./portals/PolicymakerDashboard";
import { ResearcherDashboard } from "./portals/ResearcherDashboard";
import { StateOwnerDashboard } from "./portals/StateOwnerDashboard";
import { CitizenDashboard } from "./portals/CitizenDashboard";
import { InnovatorDashboard } from "./portals/InnovatorDashboard";

function NationalDefaultDashboard() {
  const [tab, setTab] = useState<ThemeId>("land-use-change");
  const [year, setYear] = useState<string>("2024");
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
  const [sim, setSim] = useState<SimSnapshot | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [actionRequest, setActionRequest] = useState<MapAction | null>(null);
  const requestAction = (action: MapAction["action"]) =>
    setActionRequest({ id: Date.now(), action });
  useEffect(() => {
    if (!playing) return;
    const i = MOSAIC_YEARS.indexOf(year);
    if (i < 0 || i >= MOSAIC_YEARS.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setYear(MOSAIC_YEARS[i + 1] as string),
      speed === 0.5 ? 2400 : speed === 2 ? 600 : 1200,
    );
    return () => window.clearTimeout(timer);
  }, [playing, speed, year]);

  return (
    <>
      <HeroBanner />
      <KPIGrid />
      <section className="perspective">
        <header className="perspective-head">
          <div>
            <h2>India’s Land in Perspective</h2>
            <p>Explore land, policy, risk and evidence across India.</p>
          </div>
          <a className="fullscreen" href={`/gis-explorer?layer=${tab}`}>
            View Full GIS <ArrowRight />
          </a>
        </header>
        <div role="tablist" aria-label="Intelligence theme" className="theme-tabs">
          {THEME_ORDER.map((id) => (
            <button
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              {THEMES[id].label}
            </button>
          ))}
        </div>
        <div className="map-stack">
          <Suspense
            fallback={
              <div className="map-loading">
                <LoadingScreen
                  className="min-h-0"
                  label="Loading national land intelligence"
                  hint="Fetching the map and theme layers…"
                />
              </div>
            }
          >
            <IndiaMap
              theme={tab}
              year={year}
              onThemeChange={setTab}
              onYearChange={(y) => {
                setPlaying(false);
                setYear(y);
              }}
              onSelection={setSelection}
              onSimSnapshot={setSim}
              actionRequest={actionRequest}
              onActionHandled={() => setActionRequest(null)}
              panelOpen={!!selection}
              panel={
                selection ? (
                  <LandInsightPanel
                    selection={selection}
                    sim={sim}
                    theme={tab}
                    year={year}
                    onAction={requestAction}
                    onTheme={setTab}
                  />
                ) : (
                  <div className="insight-hint" aria-hidden="true">
                    <MousePointerClick /> Click any state or parcel for details
                  </div>
                )
              }
            />
          </Suspense>
          <TemporalSide
            tab={tab}
            year={year}
            playing={playing}
            speed={speed}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSpeed={setSpeed}
            onYear={(y) => {
              setPlaying(false);
              setYear(y);
            }}
          />
        </div>
      </section>
      <ImpactSection />
    </>
  );
}

export function Dashboard() {
  const [drawer, setDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<"role" | "national">("role");
  const { roleId, role } = useRole();

  return (
    <TooltipProvider>
      <div className="dashboard-shell">
        <Sidebar open={drawer} close={() => setDrawer(false)} />
        {drawer && (
          <button
            className="drawer-backdrop"
            onClick={() => setDrawer(false)}
            aria-label="Close navigation"
          />
        )}
        <main>
          <TopHeader openMenu={() => setDrawer(true)} />
          <div className="dashboard-content">
            {/* View Switcher Strip */}
            <div className="flex items-center justify-between py-2 px-1 text-xs border-b border-border/40 mb-4">
              <span className="text-muted-foreground">
                Active Portal View: <strong>{role.label}</strong> ({role.persona})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(viewMode === "role" ? "national" : "role")}
                  className="text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  {viewMode === "role" ? "Switch to National 2D Map" : `Back to ${role.label} View`}
                </button>
              </div>
            </div>

            {viewMode === "national" ? (
              <NationalDefaultDashboard />
            ) : (
              <>
                {roleId === "officer" && <OfficerDashboard />}
                {roleId === "policymaker" && <PolicymakerDashboard />}
                {roleId === "researcher" && <ResearcherDashboard />}
                {roleId === "state_owner" && <StateOwnerDashboard />}
                {roleId === "citizen" && <CitizenDashboard />}
                {roleId === "innovator" && <InnovatorDashboard />}
              </>
            )}

            <footer className="dashboard-footer">
              <span>🇮🇳</span> Built for a Viksit Bharat{" "}
              <small>Prototype data shown for demonstration</small>
            </footer>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
