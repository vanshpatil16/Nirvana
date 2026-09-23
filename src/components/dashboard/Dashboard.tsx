import { lazy, Suspense, useState } from "react";
import {
  ArrowRight, Bell, ChevronDown, Command, Menu, Moon, Search, X,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { disputeData, impactItems, kpis, landUseData, navItems } from "@/data/dashboard";
import landscape from "@/assets/bhumi-landscape.jpg";

const IndiaMap = lazy(() => import("./IndiaMap").then((m) => ({ default: m.IndiaMap })));

function Brand() {
  return <div className="brand"><div className="brand-mark" aria-hidden="true"><span>◆</span><i>◆</i></div><div><strong>BHUMI-NITI</strong><b>भूमि-नीति</b></div></div>;
}

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  return <aside className={`sidebar ${open ? "open" : ""}`}><div className="sidebar-top"><Brand /><Button variant="ghost" size="icon" className="sidebar-close" onClick={close} aria-label="Close navigation"><X /></Button><p>National Platform for Research & Policy Innovation in Land Governance</p></div><nav aria-label="Main navigation">{navItems.map(({ label, icon: Icon, active }) => <button key={label} className={active ? "active" : ""} aria-current={active ? "page" : undefined} title={`${label}${active ? "" : " — coming soon"}`}><Icon /><span>{label}</span>{!active && <i>Soon</i>}</button>)}</nav><div className="sidebar-motto"><div className="motto-land" /><em>People. Land. Policy.<br /><strong>A Better Bharat.</strong></em><small>Government research initiative</small></div></aside>;
}

function TopHeader({ openMenu }: { openMenu: () => void }) {
  return <header className="top-header"><Button variant="ghost" size="icon" className="menu-button" onClick={openMenu} aria-label="Open navigation"><Menu /></Button><label className="global-search"><Search /><input placeholder="Search villages, districts, policies, research papers, datasets..." /><kbd><Command /> K</kbd></label><div className="header-tools"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Theme settings"><Moon /></Button></TooltipTrigger><TooltipContent>Light appearance</TooltipContent></Tooltip><button className="lang">EN <ChevronDown /></button><Button variant="ghost" size="icon" className="notification" aria-label="Notifications"><Bell /><i /></Button><button className="profile"><span>OK</span><div><strong>Omkar Kudalkar</strong><small>Researcher</small></div><ChevronDown /></button></div></header>;
}

function HeroBanner() {
  return <section className="hero"><img src={landscape} width={1536} height={768} alt="Agricultural landscape, river and village in India" /><div className="hero-shade" /><div className="hero-copy"><span>NATIONAL LAND INTELLIGENCE</span><h1>Data. People. Policy.<br />A Stronger Tomorrow.</h1><p>Integrated knowledge, real-world evidence and collaborative innovation for sustainable land governance.</p><div><Button>Explore the Map <ArrowRight /></Button><Button variant="outline">View Research</Button></div></div><blockquote>“Land is not just a resource, it is a foundation for people, prosperity and the planet.”<small>Viksit Bharat · Sustainable Futures</small></blockquote></section>;
}

function KPIGrid() {
  return <section className="kpi-grid" aria-label="National land intelligence indicators">{kpis.map(({ value, label, trend, tone, icon: Icon }) => <article className={`kpi-card tone-${tone}`} key={label}><span><Icon /></span><div><strong>{value}</strong><small>{label}</small><b>{trend}</b></div></article>)}</section>;
}

function DonutCard() {
  return <article className="intel-card"><header><div><span>LAND USE CHANGE</span><h3>2015–2024</h3></div><button>View details <ArrowRight /></button></header><div className="donut-wrap"><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={landUseData} dataKey="value" innerRadius={42} outerRadius={63} paddingAngle={2} stroke="none">{landUseData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Pie><ChartTooltip /></PieChart></ResponsiveContainer><div><strong>+421,309</strong><small>changes</small></div></div><ul>{landUseData.map((item) => <li key={item.name}><i style={{ background: item.fill }} /><span>{item.name}</span><b>{item.value}%</b></li>)}</ul></div></article>;
}

function DisputeCard() {
  return <article className="intel-card dispute-card"><header><div><span>ACTIVE LAND DISPUTES</span><h2>14,203 <em>↓ 8.1%</em></h2></div></header><div className="bar-wrap"><ResponsiveContainer width="100%" height="118"><BarChart data={disputeData} layout="vertical" margin={{ left: 0, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={70} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} /><ChartTooltip cursor={false} /><Bar dataKey="value" fill="var(--chart-saffron)" radius={[0, 4, 4, 0]} barSize={8} /></BarChart></ResponsiveContainer></div></article>;
}

function ClimateCard() {
  return <article className="intel-card climate-card"><header><div><span>CLIMATE RISK & RESILIENCE</span><h2>231 <small>High-Risk Districts</small></h2></div></header><div className="risk-body"><div className="india-mini" aria-label="Abstract India climate risk map"><span /><i /><b /><em /><strong /></div><ul><li><i className="risk-high" />High Risk</li><li><i className="risk-mid" />Moderate Risk</li><li><i className="risk-low" />Low Risk</li></ul></div></article>;
}

function ImpactSection() {
  return <section className="impact"><header><div><h2>From Knowledge to Impact</h2><p>Explore how research, innovation and evidence-based policy create measurable outcomes.</p></div><button>View all modules <ArrowRight /></button></header><div className="impact-grid">{impactItems.map(({ title, description, icon: Icon }) => <button key={title}><span><Icon /></span><div><strong>{title}</strong><small>{description}</small></div><ArrowRight /></button>)}</div></section>;
}

export function Dashboard() {
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState("Land Use Change");
  return <TooltipProvider><div className="dashboard-shell"><Sidebar open={drawer} close={() => setDrawer(false)} />{drawer && <button className="drawer-backdrop" onClick={() => setDrawer(false)} aria-label="Close navigation" />}<main><TopHeader openMenu={() => setDrawer(true)} /><div className="dashboard-content"><HeroBanner /><KPIGrid /><section className="perspective"><header><h2>India’s Land in Perspective</h2><div role="tablist">{["Land Use Change", "Disputes", "Climate Risk", "Socio-Economic"].map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><button className="fullscreen">View Full Screen <ArrowRight /></button></header><div className="intelligence-grid"><Suspense fallback={<div className="map-loading">Loading geospatial workspace…</div>}><IndiaMap /></Suspense><div className="intel-column"><DonutCard /><DisputeCard /><ClimateCard /></div></div></section><ImpactSection /><footer className="dashboard-footer"><span>🇮🇳</span> Built for a Viksit Bharat <small>Prototype data shown for demonstration</small></footer></div></main></div></TooltipProvider>;
}
