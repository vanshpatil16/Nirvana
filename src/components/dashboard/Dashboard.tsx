import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight, Bell, ChevronDown, Command, Menu, Moon, MousePointerClick, Pause, Play, Search, X,
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

const IndiaMap = lazy(() => import("./IndiaMap").then((m) => ({ default: m.IndiaMap })));

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><img src={logo} alt="" width={38} height={38} /></span><div><strong>BHUMI-NITI</strong><b>भूमि-नीति</b></div></div>;
}

function Sidebar({ open, close, activeItem = "Dashboard" }: { open: boolean; close: () => void; activeItem?: string }) {
  return <aside className={`sidebar ${open ? "open" : ""}`}><div className="sidebar-top"><Brand /><Button variant="ghost" size="icon" className="sidebar-close" onClick={close} aria-label="Close navigation"><X /></Button><p>National Platform for Research & Policy Innovation in Land Governance</p></div><nav aria-label="Main navigation">{navItems.map(({ label, icon: Icon, href }) => {
    const isActive = label === activeItem;
    if (href) {
      return (
        <a key={label} href={href} className={isActive ? "active" : ""} aria-current={isActive ? "page" : undefined}>
          <Icon /><span>{label}</span>
        </a>
      );
    }
    return (
      <button key={label} className={isActive ? "active" : ""} aria-current={isActive ? "page" : undefined} title={`${label} — coming soon`}>
        <Icon /><span>{label}</span><i>Soon</i>
      </button>
    );
  })}</nav><div className="sidebar-bottom"><img src={sidenavBottom} alt="Same Land, More Clarity, Better Decisions — Government of India, Ministry of Rural Development, Department of Land Resources" /></div></aside>;
}

function TopHeader({ openMenu }: { openMenu: () => void }) {
  return <header className="top-header"><Button variant="ghost" size="icon" className="menu-button" onClick={openMenu} aria-label="Open navigation"><Menu /></Button><label className="global-search"><Search /><input placeholder="Search villages, districts, policies, research papers, datasets..." /><kbd><Command /> K</kbd></label><div className="header-tools"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Theme settings"><Moon /></Button></TooltipTrigger><TooltipContent>Light appearance</TooltipContent></Tooltip><button className="lang">EN <ChevronDown /></button><Button variant="ghost" size="icon" className="notification" aria-label="Notifications"><Bell /><i /></Button><button className="profile"><span>OK</span><div><strong>Omkar Kudalkar</strong><small>Researcher</small></div><ChevronDown /></button></div></header>;
}

function HeroBanner() {
  return <section className="hero"><img src={landscape} width={1536} height={768} alt="Agricultural landscape, river and village in India" /><div className="hero-shade" /><div className="hero-copy"><span>NATIONAL LAND INTELLIGENCE</span><h1>Data. People. Policy.<br />A Stronger Tomorrow.</h1><p>Integrated knowledge, real-world evidence and collaborative innovation for sustainable land governance.</p><div><Button>Explore the Map <ArrowRight /></Button><Button variant="outline">View Research</Button></div></div></section>;
}

function KPIGrid() {
  return <section className="kpi-grid" aria-label="National land intelligence indicators">{kpis.map(({ value, label, trend, tone, icon: Icon }) => <article className={`kpi-card tone-${tone}`} key={label}><span><Icon /></span><div><strong>{value}</strong><small>{label}</small><b>{trend}</b></div></article>)}</section>;
}

function TemporalSide({ tab, year, playing, speed, onTogglePlay, onSpeed, onYear }: {
  tab: ThemeId;
  year: string;
  playing: boolean;
  speed: 0.5 | 1 | 2;
  onTogglePlay: () => void;
  onSpeed: (speed: 0.5 | 1 | 2) => void;
  onYear: (year: string) => void;
}) {
  const timeline = THEME_TIMELINES[tab];
  return <section className="temporal-bar" role="group" aria-label="Move through time">
    <div className="temporal-bar-title">
      <span>{timeline.title}</span>
      <strong>{year}</strong>
    </div>
    <div className="temporal-play">
      <button onClick={onTogglePlay} aria-label={playing ? "Pause timeline" : "Play timeline"}>{playing ? <Pause /> : <Play />}</button>
      <select value={speed} onChange={(e) => onSpeed(Number(e.target.value) as 0.5 | 1 | 2)} aria-label="Playback speed">
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
          <button key={y} className={y === year ? "active" : ""} onClick={() => onYear(y)} aria-label={`Show ${y}`}>{y}</button>
        ))}
      </div>
    </div>
    <div className="temporal-bar-meta">
      <span>{timeline.descriptor} · data period {timeline.dataPeriod}</span>
      <span className="temporal-status">{timeline.status} · {timeline.statusNote}</span>
    </div>
  </section>;
}

function ImpactSection() {
  return <section className="impact"><header><div><h2>From Knowledge to Impact</h2><p>Explore how research, innovation and evidence-based policy create measurable outcomes.</p></div><button>View all modules <ArrowRight /></button></header><div className="impact-grid">{impactItems.map(({ title, description, icon: Icon }) => <button key={title}><span><Icon /></span><div><strong>{title}</strong><small>{description}</small></div><ArrowRight /></button>)}</div></section>;
}

export function Dashboard() {
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState<ThemeId>("land-use-change");
  const [year, setYear] = useState<string>("2024");
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
  const [sim, setSim] = useState<SimSnapshot | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [actionRequest, setActionRequest] = useState<MapAction | null>(null);
  const requestAction = (action: MapAction["action"]) => setActionRequest({ id: Date.now(), action });
  useEffect(() => {
    if (!playing) return;
    const i = MOSAIC_YEARS.indexOf(year);
    if (i < 0 || i >= MOSAIC_YEARS.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setYear(MOSAIC_YEARS[i + 1] as string), speed === 0.5 ? 2400 : speed === 2 ? 600 : 1200);
    return () => window.clearTimeout(timer);
  }, [playing, speed, year]);
  return <TooltipProvider><div className="dashboard-shell"><Sidebar open={drawer} close={() => setDrawer(false)} />{drawer && <button className="drawer-backdrop" onClick={() => setDrawer(false)} aria-label="Close navigation" />}<main><TopHeader openMenu={() => setDrawer(true)} /><div className="dashboard-content"><HeroBanner /><KPIGrid /><section className="perspective"><header className="perspective-head"><div><h2>India’s Land in Perspective</h2><p>Explore land, policy, risk and evidence across India.</p></div><a className="fullscreen" href={`/gis-explorer?layer=${tab}`}>View Full GIS <ArrowRight /></a></header><div role="tablist" aria-label="Intelligence theme" className="theme-tabs">{THEME_ORDER.map((id) => <button role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{THEMES[id].label}</button>)}</div><div className="map-stack"><Suspense fallback={<div className="map-loading">Loading national land intelligence…</div>}><IndiaMap theme={tab} year={year} onThemeChange={setTab} onYearChange={(y) => { setPlaying(false); setYear(y); }} onSelection={setSelection} onSimSnapshot={setSim} actionRequest={actionRequest} onActionHandled={() => setActionRequest(null)} panelOpen={!!selection} panel={selection ? <LandInsightPanel selection={selection} sim={sim} theme={tab} year={year} onAction={requestAction} onTheme={setTab} /> : <div className="insight-hint" aria-hidden="true"><MousePointerClick /> Click any state or parcel for details</div>} /></Suspense><TemporalSide tab={tab} year={year} playing={playing} speed={speed} onTogglePlay={() => setPlaying((p) => !p)} onSpeed={setSpeed} onYear={(y) => { setPlaying(false); setYear(y); }} /></div></section><ImpactSection /><footer className="dashboard-footer"><span>🇮🇳</span> Built for a Viksit Bharat <small>Prototype data shown for demonstration</small></footer></div></main></div></TooltipProvider>;
}
