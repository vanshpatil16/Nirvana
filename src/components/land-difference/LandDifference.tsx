import { useState, useEffect, useRef, useMemo } from "react";
import {
  Bell,
  ChevronDown,
  Command,
  Layers,
  MapPin,
  Menu,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Maximize
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { navItems } from "@/data/dashboard";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import * as landService from "@/services/landDifferenceService";
import type { LandTransition } from "@/data/land-difference";
import { AVAILABLE_YEARS } from "@/data/land-difference";
import statesGeoJSON from "@/data/india-states.json";
import {
  ALL_INDIA,
  REGION_OPTIONS,
  STATE_NAMES,
  ZERO_DELTAS,
  isZeroScenario,
  regionOutcome,
  regionStates,
  scenarioFlows,
  yearShares,
  type ScenarioDeltas,
} from "@/data/land-scenario";
import { LULC_CLASSES, renderRegion, stateOuterRings, statesBounds, type RegionRaster } from "./lulcRaster";
import { ImpactCards, SIDE_COLORS, ScenarioControls, StateComparison, type ScenarioSide } from "./ScenarioPanel";

maplibregl.config.WORKER_URL = mapWorkerUrl;

type Mode = "time" | "states";
type Side = { region: string; year: string };

const satelliteTiles = (year: string) =>
  [`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`];

const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;

// Dims everything outside the selected state; nothing is dimmed for All India
const maskFor = (region: string): any => {
  if (region === ALL_INDIA) return EMPTY_FC;
  const outer = stateOuterRings(region).filter((ring) => ring.length > 3);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[[-180, -85], [-180, 85], [180, 85], [180, -85], [-180, -85]], ...outer] },
  };
};

const CITY_LABELS: [string, number, number][] = [
  ["Mumbai", 72.87, 19.07], ["Pune", 73.85, 18.52], ["Nagpur", 79.08, 21.14], ["Nashik", 73.78, 19.99], ["Aurangabad", 75.34, 19.87],
  ["Delhi", 77.21, 28.61], ["Bengaluru", 77.59, 12.97], ["Chennai", 80.27, 13.08], ["Kolkata", 88.36, 22.57], ["Hyderabad", 78.49, 17.39],
  ["Ahmedabad", 72.57, 23.02], ["Surat", 72.83, 21.17], ["Vadodara", 73.19, 22.31], ["Rajkot", 70.8, 22.3], ["Jaipur", 75.79, 26.91],
  ["Jodhpur", 73.02, 26.24], ["Udaipur", 73.71, 24.58], ["Lucknow", 80.95, 26.85], ["Kanpur", 80.33, 26.45], ["Varanasi", 82.99, 25.32],
  ["Agra", 78.01, 27.18], ["Patna", 85.14, 25.59], ["Bhopal", 77.41, 23.26], ["Indore", 75.86, 22.72], ["Jabalpur", 79.94, 23.18],
  ["Raipur", 81.63, 21.25], ["Ranchi", 85.33, 23.34], ["Bhubaneswar", 85.82, 20.3], ["Visakhapatnam", 83.3, 17.69], ["Vijayawada", 80.65, 16.51],
  ["Coimbatore", 76.96, 11.02], ["Madurai", 78.12, 9.93], ["Kochi", 76.27, 9.93], ["Thiruvananthapuram", 76.94, 8.52], ["Mysuru", 76.64, 12.3],
  ["Ludhiana", 75.86, 30.9], ["Amritsar", 74.87, 31.63], ["Chandigarh", 76.78, 30.73], ["Dehradun", 78.03, 30.32], ["Shimla", 77.17, 31.1],
  ["Srinagar", 74.8, 34.08], ["Guwahati", 91.74, 26.14], ["Shillong", 91.88, 25.58], ["Imphal", 93.94, 24.82], ["Panaji", 73.83, 15.49],
  ["Siliguri", 88.43, 26.73], ["Gangtok", 88.61, 27.33], ["Agartala", 91.28, 23.83], ["Aizawl", 92.72, 23.73], ["Kohima", 94.11, 25.67],
];

const cityData = {
  type: "FeatureCollection",
  features: CITY_LABELS.map(([name, lon, lat]) => ({ type: "Feature", properties: { name }, geometry: { type: "Point", coordinates: [lon, lat] } })),
};

// isStyleLoaded() is false while tiles are still loading, and 'load' only fires once,
// so track it ourselves to avoid waiting on an event that has already happened
const loadedMaps = new WeakSet<maplibregl.Map>();
const whenLoaded = (map: maplibregl.Map, fn: () => void) => {
  if (loadedMaps.has(map)) fn();
  else map.once("load", fn);
};

// Latest render requested per map, so a slow render can't overwrite a newer one
const renderTokens = new WeakMap<maplibregl.Map, object>();
// Change-layer object URL currently shown per map, released once replaced
const shownChangeUrl = new WeakMap<maplibregl.Map, string>();

// Adds or updates the land-use and change-detected overlays just below the state boundary
const applyRaster = (map: maplibregl.Map, r: RegionRaster, showChange: boolean) => {
  const upsert = (id: string, url: string) => {
    const source = map.getSource(id) as maplibregl.ImageSource | undefined;
    if (source) {
      source.updateImage({ url, coordinates: r.coordinates });
      return;
    }
    map.addSource(id, { type: "image", url, coordinates: r.coordinates });
    map.addLayer(
      { id: `${id}-layer`, type: "raster", source: id, paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 0 } },
      "state-border",
    );
  };
  upsert("lulc", r.baseUrl);
  if (r.changeUrl) {
    upsert("lulc-change", r.changeUrl);
    const previous = shownChangeUrl.get(map);
    shownChangeUrl.set(map, r.changeUrl);
    // Give MapLibre time to finish loading the new image before freeing the old one
    if (previous) setTimeout(() => URL.revokeObjectURL(previous), 5000);
  }
  const changeVisible = !!r.changeUrl && showChange;
  if (map.getLayer("lulc-change-layer")) map.setLayoutProperty("lulc-change-layer", "visibility", changeVisible ? "visible" : "none");
  // Recede the base classification a little so newly affected regions stand out
  map.setPaintProperty("lulc-layer", "raster-opacity", changeVisible ? 0.7 : 1);
};

function MapSelect({ value, subtitle, options, disabledOption, open, onToggle, onSelect }: {
  value: string;
  subtitle: string;
  options: readonly string[];
  disabledOption?: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
        className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white transition-colors"
      >
        <span className="font-extrabold text-gray-900 text-sm whitespace-nowrap">{value}</span>
        <span className="text-gray-500 font-medium text-sm whitespace-nowrap">{subtitle}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 top-full mt-2 w-full min-w-[180px] max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl py-1.5">
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                disabled={o === disabledOption}
                onClick={() => onSelect(o)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors disabled:text-gray-300 disabled:cursor-not-allowed ${o === value ? "font-extrabold text-gray-900 bg-gray-100" : "font-medium text-gray-700 hover:bg-gray-50"}`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LandDifference() {
  const [drawer, setDrawer] = useState(false);
  const [swipePosition, setSwipePosition] = useState<number>(50);
  const [mode, setMode] = useState<Mode>("time");
  // "Over time" mode: one region, two years
  const [timeRegion, setTimeRegion] = useState<string>("Maharashtra");
  const [leftYear, setLeftYear] = useState<string>("2018");
  const [rightYear, setRightYear] = useState<string>("2024");
  // "State vs state" mode: two states, one year
  const [stateA, setStateA] = useState<string>("Maharashtra");
  const [stateB, setStateB] = useState<string>("Gujarat");
  const [compareYear, setCompareYear] = useState<string>("2024");
  // Scenario
  const [deltas, setDeltas] = useState<ScenarioDeltas>(ZERO_DELTAS);
  const [mapDeltas, setMapDeltas] = useState<ScenarioDeltas>(ZERO_DELTAS);
  const [showChange, setShowChange] = useState(true);
  const [changedKm2, setChangedKm2] = useState<[number | null, number | null]>([null, null]);

  const [menu, setMenu] = useState<"left" | "right" | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const [transitions, setTransitions] = useState<LandTransition[]>([]);

  const mapContainer1 = useRef<HTMLDivElement>(null);
  const mapContainer2 = useRef<HTMLDivElement>(null);
  const map1Ref = useRef<maplibregl.Map | null>(null);
  const map2Ref = useRef<maplibregl.Map | null>(null);
  const maps = () => [map1Ref.current, map2Ref.current] as const;

  const sides: [Side, Side] = useMemo(
    () => (mode === "time"
      ? [{ region: timeRegion, year: leftYear }, { region: timeRegion, year: rightYear }]
      : [{ region: stateA, year: compareYear }, { region: stateB, year: compareYear }]),
    [mode, timeRegion, leftYear, rightYear, stateA, stateB, compareYear],
  );
  const sideLabel = (s: Side) => (mode === "time" ? `${s.region} ${s.year}` : s.region);

  // Metrics update on every slider move; the map follows a beat later (rasters are heavier)
  const outcomes = useMemo(() => sides.map((s) => regionOutcome(s.region, s.year, deltas)), [sides, deltas]);
  useEffect(() => {
    const t = setTimeout(() => setMapDeltas(deltas), 80);
    return () => clearTimeout(t);
  }, [deltas]);

  const scenarioSides: ScenarioSide[] = sides.map((s, k) => ({
    label: sideLabel(s),
    color: SIDE_COLORS[k]!,
    outcome: outcomes[k]!,
    changedKm2: isZeroScenario(deltas) ? null : changedKm2[k] ?? null,
  }));

  useEffect(() => {
    const loadData = async () => {
      const transRes = await landService.fetchLandTransitions(timeRegion, leftYear, rightYear);
      setTransitions(transRes.transitions);
    };
    loadData();
  }, [timeRegion, leftYear, rightYear]);

  // Create both maps once
  useEffect(() => {
    if (!mapContainer1.current || !mapContainer2.current) return;

    const initMap = (container: HTMLDivElement, side: Side) => {
      const b = statesBounds(regionStates(side.region));
      return new maplibregl.Map({
        container,
        bounds: [[b.west, b.south], [b.east, b.north]],
        fitBoundsOptions: { padding: 60 },
        attributionControl: false,
        style: {
          version: 8,
          glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
          sources: {
            satellite: { type: "raster", tiles: satelliteTiles(side.year), tileSize: 256 },
            mask: { type: "geojson", data: maskFor(side.region) },
            states: { type: "geojson", data: statesGeoJSON as any },
            cities: { type: "geojson", data: cityData as any },
          },
          // Order: satellite → land-use + change overlays (added by applyRaster) → boundary → labels → markers
          layers: [
            { id: "sat", type: "raster", source: "satellite", paint: { "raster-opacity": 1 } },
            { id: "mask-layer", type: "fill", source: "mask", paint: { "fill-color": "#000000", "fill-opacity": 0.65 } },
            { id: "state-border", type: "line", source: "states", paint: { "line-color": "#ffffff", "line-width": 2 } },
            {
              id: "city-labels", type: "symbol", source: "cities",
              layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Medium"], "text-size": 14, "text-offset": [0, 1.2] },
              paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.85)", "text-halo-width": 1.5, "text-halo-blur": 0.5 },
            },
            {
              id: "city-dots", type: "circle", source: "cities",
              paint: { "circle-radius": 4, "circle-color": "#E53935", "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
            },
          ],
        },
      });
    };

    const m1 = (map1Ref.current = initMap(mapContainer1.current, sides[0]));
    const m2 = (map2Ref.current = initMap(mapContainer2.current, sides[1]));
    for (const m of [m1, m2]) m.once("load", () => loadedMaps.add(m));

    // Cameras are linked only when comparing the same region over time
    const sync = (from: maplibregl.Map, to: maplibregl.Map) => (e: any) => {
      if (e.originalEvent && modeRef.current === "time") to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
    };
    const sync1 = sync(m1, m2), sync2 = sync(m2, m1);
    m1.on("move", sync1);
    m2.on("move", sync2);

    return () => {
      m1.remove();
      m2.remove();
      map1Ref.current = map2Ref.current = null;
    };
    // Maps are created once; later changes are applied by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitRegions = (animate = true) => {
    const [m1, m2] = maps();
    [m1, m2].forEach((m, k) => {
      if (!m) return;
      m.resize();
      const b = statesBounds(regionStates(sides[k]!.region));
      m.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: { top: 90, bottom: 60, left: 80, right: 40 }, animate });
    });
  };

  // Region / mode changes: mask, borders, camera
  const regionKey = `${mode}|${sides[0].region}|${sides[1].region}`;
  useEffect(() => {
    maps().forEach((m, k) => {
      if (!m) return;
      const region = sides[k]!.region;
      whenLoaded(m, () => {
        (m.getSource("mask") as maplibregl.GeoJSONSource).setData(maskFor(region));
        m.setFilter("state-border", region === ALL_INDIA ? null : ["==", ["get", "name"], region]);
        m.setPaintProperty("state-border", "line-width", region === ALL_INDIA ? 0.8 : 2);
      });
    });
    // Containers change size between modes; fit after layout has settled
    const raf = requestAnimationFrame(() => fitRegions(false));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKey]);

  // Satellite imagery follows each side's year
  const yearKey = `${sides[0].year}|${sides[1].year}`;
  useEffect(() => {
    maps().forEach((m, k) => {
      if (!m) return;
      const year = sides[k]!.year;
      whenLoaded(m, () => (m.getSource("satellite") as maplibregl.RasterTileSource).setTiles(satelliteTiles(year)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearKey]);

  // Land-use classification + change-detected overlays
  useEffect(() => {
    maps().forEach(async (m, k) => {
      if (!m) return;
      const token = {};
      renderTokens.set(m, token);
      const side = sides[k]!;
      const states = regionStates(side.region);
      const baseShares = states.map((s) => yearShares(s, side.year));
      const flows = isZeroScenario(mapDeltas) ? null : baseShares.map((b) => scenarioFlows(b, mapDeltas));
      const raster = await renderRegion(states, side.year, baseShares, flows);
      if (renderTokens.get(m) !== token) {
        if (raster.changeUrl) URL.revokeObjectURL(raster.changeUrl);
        return;
      }
      setChangedKm2((prev) => {
        const next: [number | null, number | null] = [...prev];
        next[k] = flows ? raster.changedKm2 : null;
        return next;
      });
      whenLoaded(m, () => applyRaster(m, raster, showChange));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sides, mapDeltas, showChange]);

  const bothMaps = (fn: (m: maplibregl.Map) => void) => {
    maps().forEach((m) => m && fn(m));
  };

  const updateSwipe = (clientX: number) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSwipePosition(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };

  const intensity = landService.computeChangeIntensity(transitions);
  const scenarioActive = !isZeroScenario(deltas);
  const split = mode === "time" ? swipePosition : 50;

  const switchMode = (next: Mode) => {
    setMenu(null);
    setMode(next);
  };

  return (
    <TooltipProvider>
      <div className="dashboard-shell h-screen flex overflow-hidden bg-background">

        {/* Sidebar */}
        <aside className={`sidebar ${drawer ? "open" : ""} shrink-0 z-50`}>
          <div className="sidebar-top">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true"><img src={logo} alt="BHUMI-NITI Logo" width={38} height={38} /></span>
              <div><strong>BHUMI-NITI</strong><b>भूमि-नीति</b></div>
            </div>
            <Button variant="ghost" size="icon" className="sidebar-close" onClick={() => setDrawer(false)}><X /></Button>
            <p>National Platform for Research & Policy Innovation</p>
          </div>
          <nav aria-label="Main navigation">
            {navItems.map(({ label, icon: Icon, href }) => {
              const isActive = label === "Land Difference";
              if (href) return <a key={label} href={href} className={isActive ? "active" : ""}><Icon /><span>{label}</span></a>;
              return <button key={label} title={`${label} — coming soon`}><Icon /><span>{label}</span><i>Soon</i></button>;
            })}
          </nav>
          <div className="sidebar-bottom"><img src={sidenavBottom} alt="Government of India" /></div>
        </aside>

        {drawer && <button className="drawer-backdrop" onClick={() => setDrawer(false)} />}

        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Header */}
          <header className="top-header shrink-0">
            <Button variant="ghost" size="icon" className="menu-button" onClick={() => setDrawer(true)}><Menu /></Button>
            <label className="global-search"><Search /><input placeholder="Search a location..." /><kbd><Command /> K</kbd></label>
            <div className="header-tools">
              <button className="lang">EN <ChevronDown /></button>
              <Button variant="ghost" size="icon" className="notification"><Bell /><i /></Button>
              <button className="profile"><span>OK</span><div><strong>Omkar Kudalkar</strong><small>Researcher</small></div><ChevronDown /></button>
            </div>
          </header>

          <div className="p-4 md:p-6 lg:p-8 flex-1 flex flex-col max-w-[1600px] mx-auto w-full gap-6">

            {/* Comparison mode + region/year */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label="Comparison mode" className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
                {([["time", "Over time"], ["states", "State vs State"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={mode === id}
                    onClick={() => switchMode(id)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {mode === "time" ? (
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    Region
                    <select value={timeRegion} onChange={(e) => setTimeRegion(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium">
                      {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    Year
                    <select value={compareYear} onChange={(e) => setCompareYear(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium">
                      {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                )}
                <span className="text-[11px] text-muted-foreground">Demo · simulated land use</span>
              </div>
            </div>

            {/* Impeccable Map Workspace */}
            <div ref={workspaceRef} className="relative w-full h-[650px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-border/80">

              {/* Inline positioning: maplibre's .maplibregl-map { position: relative } overrides Tailwind's layered utilities.
                  Over time: both maps fill the frame and the right one is clipped by the swipe.
                  State vs state: each map gets its own half with an independent camera. */}
              <div ref={mapContainer1} style={{ position: "absolute", inset: mode === "time" ? 0 : "0 50% 0 0" }} />
              <div
                ref={mapContainer2}
                style={mode === "time"
                  ? { position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${swipePosition}%)` }
                  : { position: "absolute", inset: "0 0 0 50%" }}
              />

              {/* Floating UI: left selector */}
              <div className="absolute top-5 left-5 z-40 flex items-center gap-3">
                <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl p-3 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-gray-800" />
                </div>
                {mode === "time" ? (
                  <MapSelect
                    value={leftYear} subtitle="Land Use" options={AVAILABLE_YEARS} disabledOption={rightYear}
                    open={menu === "left"} onToggle={() => setMenu(menu === "left" ? null : "left")}
                    onSelect={(y) => { setLeftYear(y); setMenu(null); }}
                  />
                ) : (
                  <MapSelect
                    value={stateA} subtitle="State A" options={STATE_NAMES} disabledOption={stateB}
                    open={menu === "left"} onToggle={() => setMenu(menu === "left" ? null : "left")}
                    onSelect={(s) => { setStateA(s); setMenu(null); }}
                  />
                )}
              </div>

              {/* Floating UI: right selector (follows the swipe in time mode, bounded) */}
              <div className="absolute top-5 z-40 flex items-center gap-3 transition-opacity duration-75"
                   style={{ left: `calc(${Math.min(split, 80)}% + 20px)`, opacity: split > 85 ? 0 : 1, pointerEvents: split > 85 ? "none" : "auto" }}>
                {mode === "time" ? (
                  <MapSelect
                    value={rightYear} subtitle="Land Use" options={AVAILABLE_YEARS} disabledOption={leftYear}
                    open={menu === "right"} onToggle={() => setMenu(menu === "right" ? null : "right")}
                    onSelect={(y) => { setRightYear(y); setMenu(null); }}
                  />
                ) : (
                  <MapSelect
                    value={stateB} subtitle="State B" options={STATE_NAMES} disabledOption={stateA}
                    open={menu === "right"} onToggle={() => setMenu(menu === "right" ? null : "right")}
                    onSelect={(s) => { setStateB(s); setMenu(null); }}
                  />
                )}
              </div>

              {/* Floating UI: Left Toolbar */}
              <div className="absolute top-24 left-5 z-20 flex flex-col gap-2">
                <button title="Zoom in" onClick={() => bothMaps((m) => m.zoomIn())} className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl w-11 h-11 flex items-center justify-center hover:bg-gray-50 text-gray-700 transition-colors"><Plus className="w-5 h-5"/></button>
                <button title="Zoom out" onClick={() => bothMaps((m) => m.zoomOut())} className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl w-11 h-11 flex items-center justify-center hover:bg-gray-50 text-gray-700 transition-colors"><Minus className="w-5 h-5"/></button>
                <button title="Reset view" onClick={() => fitRegions()} className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl w-11 h-11 flex items-center justify-center hover:bg-gray-50 text-gray-700 transition-colors mt-2"><MapPin className="w-5 h-5"/></button>
                <button title="Fullscreen" onClick={() => document.fullscreenElement ? document.exitFullscreen() : workspaceRef.current?.requestFullscreen()} className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl w-11 h-11 flex items-center justify-center hover:bg-gray-50 text-gray-700 transition-colors mt-2"><Maximize className="w-5 h-5"/></button>
              </div>

              {/* Legends */}
              {sides.map((s, k) => (
                <div key={k} className={`absolute bottom-6 ${k === 0 ? "left-5" : "right-5"} z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-xl p-4 w-[220px]`}>
                  <h4 className="font-extrabold text-sm mb-3 text-gray-900 leading-tight">Land Use ({sideLabel(s)})</h4>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-gray-700 font-semibold">
                    {LULC_CLASSES.map((c) => (
                      <div key={c.id} className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-[3px] shrink-0" style={{ backgroundColor: c.color }}></div> {c.label}</div>
                    ))}
                  </div>
                  {scenarioActive && showChange && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 text-xs text-gray-700 font-semibold">
                      {/* new-class colour with a white rim, as drawn on the map */}
                      <div className="w-3.5 h-3.5 rounded-[3px] shrink-0" style={{ backgroundColor: LULC_CLASSES[0].color, boxShadow: "0 0 0 2px #fff, 0 0 0 3px #9ca3af" }} />
                      <span>Change detected{changedKm2[k] != null && <span className="font-mono font-normal text-gray-500"> · {Math.round(changedKm2[k]!).toLocaleString("en-IN")} km²</span>}</span>
                    </div>
                  )}
                </div>
              ))}

              {mode === "time" ? (
                /* Swipe Handle — only the handle is draggable, so the map and floating controls stay interactive */
                <div
                  role="slider"
                  aria-label="Compare years"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(swipePosition)}
                  tabIndex={0}
                  className="absolute top-0 bottom-0 z-30 w-6 -translate-x-1/2 cursor-ew-resize touch-none flex justify-center"
                  style={{ left: `${swipePosition}%` }}
                  onPointerDown={(e) => { draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); updateSwipe(e.clientX); }}
                  onPointerMove={(e) => { if (draggingRef.current) updateSwipe(e.clientX); }}
                  onPointerUp={() => { draggingRef.current = false; }}
                  onPointerCancel={() => { draggingRef.current = false; }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") setSwipePosition((p) => Math.max(0, p - 2));
                    if (e.key === "ArrowRight") setSwipePosition((p) => Math.min(100, p + 2));
                  }}
                >
                  <div className="h-full w-[3px] bg-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.3)] flex items-center justify-center text-gray-800">
                    <ChevronLeft className="w-6 h-6 -mr-1" />
                    <ChevronRight className="w-6 h-6 -ml-1" />
                  </div>
                </div>
              ) : (
                /* Fixed divider between the two states */
                <div className="absolute top-0 bottom-0 left-1/2 z-30 w-[3px] -translate-x-1/2 bg-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none" />
              )}

              {/* Bottom Hint */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 bg-gray-900/85 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-xs font-bold tracking-wide shadow-lg border border-white/10 pointer-events-none whitespace-nowrap">
                {mode === "time" ? `Drag to compare ${leftYear} ↔ ${rightYear}` : `${stateA} vs ${stateB} · ${compareYear}`}
              </div>

              {/* Source attribution */}
              <div className="absolute bottom-2 right-5 z-20 text-[9px] text-white/70 font-medium bg-black/40 px-2 py-1 rounded">
                Source: Sentinel-2 (Copernicus) • 10m · land use simulated (demo)
              </div>
            </div>

            <ScenarioControls deltas={deltas} onChange={setDeltas} sides={scenarioSides} showChange={showChange} onShowChange={setShowChange} />
            <ImpactCards sides={scenarioSides} />
            <StateComparison sides={scenarioSides} />

            {/* Sub-panel for analytics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Transition Breakdown */}
              <div className="bg-card border border-border/80 rounded-xl p-5 shadow-sm md:col-span-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Statewide Transition Breakdown</h3>
                <div className="space-y-4">
                  {transitions.map(t => (
                    <div key={t.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{t.label}</span>
                        <span className="font-bold font-mono">{t.area.toLocaleString()} ha ({t.percentage}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.percentage}%`, backgroundColor: t.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Change Intensity Score */}
              <div className="bg-card border border-border/80 rounded-xl p-5 shadow-sm flex flex-col justify-center">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Change Intensity Score</h3>
                <div className="flex items-end justify-between mb-2">
                  <span className="font-display text-5xl font-bold" style={{ color: intensity.color }}>{intensity.score}</span>
                  <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${intensity.color}20`, color: intensity.color }}>
                    {intensity.label} Intensity
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${intensity.score}%`, backgroundColor: intensity.color }} />
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
