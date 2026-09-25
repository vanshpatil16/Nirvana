import { useEffect, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapInstance } from "maplibre-gl";
import {
  ArrowRight,
  Database,
  Droplets,
  MapPin,
  Play,
  RotateCcw,
  Satellite,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  X,
  Map as MapIcon,
} from "lucide-react";
import states from "@/data/india-states.json";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  DATA_UPDATED_LABEL,
  INTEL_SOURCES,
  STATE_STATS,
  THEMES,
  levelFor,
  primaryIndicator,
  type ThemeId,
} from "@/data/state-intelligence";
import { getDefaultProvider, getImageryConfig } from "@/services/sentinelService";
import { THEME_TIMELINES, cacheKey, previousMosaicYear } from "@/services/temporal";
import {
  clearParcelFailures,
  fetchLiveParcels,
  filterParcelsByBBox,
  getDemoParcels,
  isDemoMode,
  parcelAcres,
  ParcelApiProvider,
  type BBox,
  type ParcelCollection,
  type ParcelFeature,
} from "@/services/parcelService";
import { DEMO_PRESETS, reverseGeocode, searchPlaces, type PlaceResult, type ReversePlace } from "@/services/geocodeService";
import { fetchWeatherSummary, todayForecast, type WeatherStation, type WeatherSummary } from "@/services/weatherService";

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [66.5, 5.0],
  [98.5, 37.5],
];
const NO_DATA_FILL = "#e9e4d6";
const BOUNDARY_LINE = "#9aa48f";
const SELECT_LINE = "#1e4632";
const PARCEL_LINE = "#ffffff";
const HIGHLIGHT_LINE = "#ffd21f";
const HIGHLIGHT_FILL = "#ff8c00";

const FILL_LAYER = "states-fill";
const LINE_LAYER = "states-line";
const SELECT_LAYER = "states-select";
const PARCEL_FILL_LAYER = "parcels-fill";
const PARCEL_LINE_LAYER = "parcels-line";
const PARCEL_LABEL_LAYER = "parcel-labels";
const SELECTED_FILL_LAYER = "selected-parcel-fill";
const SELECTED_LINE_LAYER = "selected-parcel-line";

// Point MapLibre at a bundler-resolved worker URL. Without this, the library
// guesses the worker path from import.meta.url, which breaks under Vite's
// pre-bundling (dev) and hashed chunks (build): "Worker failed to load".
maplibregl.config.WORKER_URL = mapWorkerUrl;

interface HoverInfo {
  name: string;
  x: number;
  y: number;
}

interface PlaceContext {
  name: string;
  lat: number;
  lon: number;
}

const EMPTY_PARCELS: ParcelCollection = { type: "FeatureCollection", features: [] };

/** Deterministic 0..1 hash — keeps the demo year series stable across reloads. */
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Year-adjusted indicator level (demo series, 2018-2024): every state rides a
 * smooth deterministic curve anchored on its observed snapshot, so scrubbing
 * the timeline repaints the choropleth for every theme — matching the real
 * year-over-year change visible in the satellite mosaic.
 */
function yearAdjustedLevel(theme: ThemeId, name: string, base: number, year: string): number {
  const y = Number(year) || 2024;
  const phase = hashUnit(`${name}|${theme}`) * Math.PI * 2;
  const strength = 0.6 + 0.4 * hashUnit(`${theme}|${name}|amp`);
  const drift = Math.sin(phase + (y - 2018) * 0.95) * strength;
  return Math.max(0, Math.min(2, Math.round(base + drift)));
}

function fillExpression(theme: ThemeId, neutral = false, year = "2024"): maplibregl.ExpressionSpecification {
  // Satellite mode: plain neutral wash so imagery stays readable and no
  // thematic (red) fill ever paints over it. The ramp only applies to Map mode.
  if (neutral) return "#ffffff" as unknown as maplibregl.ExpressionSpecification;
  const ramp = THEMES[theme].ramp;
  const match: unknown[] = ["match", ["get", "name"]];
  for (const [name, stat] of Object.entries(STATE_STATS)) {
    const level = levelFor(theme, stat);
    if (level !== null) match.push(name, ramp[yearAdjustedLevel(theme, name, level, year)]);
  }
  match.push(NO_DATA_FILL);
  return match as maplibregl.ExpressionSpecification;
}

function statesOpacity(satellite: boolean): maplibregl.ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    satellite ? 0.4 : 1,
    satellite ? 0.12 : 0.88,
  ] as unknown as maplibregl.ExpressionSpecification;
}

interface StatesGeometry {
  features: { properties: { name: string }; geometry: { type: string; coordinates: number[][][][] } }[];
}

function ringContains(ring: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Which demo-vintage state contains this point (dossier sync on search). */
function stateAt(lon: number, lat: number): string | null {  const fc = states as unknown as StatesGeometry;
  for (const f of fc.features) {
    for (const poly of f.geometry.coordinates) {
      const outer = poly[0];
      if (outer && ringContains(outer, lon, lat)) return f.properties.name;
    }
  }
  return null;
}

const CLIMATE_HEAT_SOURCE = "climate-heat";
const CLIMATE_HEAT_LAYER = "climate-heat-layer";

export type WeatherMetric = "temperature" | "rainfall";

const EMPTY_HEAT: maplibregl.GeoJSONSourceSpecification["data"] = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Heat weight for one live IMD station.
 * - Temperature: today's observed max on a 12-44 °C scale (coastal winter floor
 *   to extreme plains heat), with a small floor so every station glows faintly.
 * - Rainfall: observed mm normalised to 40 mm, lifted by today's forecast text
 *   (IMD wording: light / moderate / heavy / very heavy) so monsoon days with a
 *   dry morning still read as rain. Dry days stay nearly invisible — that is
 *   the point of the metric.
 */
function heatWeight(station: WeatherStation, metric: WeatherMetric): number {
  if (metric === "temperature") {
    const temp = station.tempMax ?? station.tempMin;
    if (temp === null) return 0.04;
    return Math.max(0.06, Math.min(1, (temp - 12) / 32));
  }
  const mm = station.rainfall ?? 0;
  let weight = mm > 0 ? Math.min(1, mm / 40) : 0.03;
  const condition = todayForecast(station).toLowerCase();
  let forecastWeight = 0;
  if (/very heavy|torrential|extreme/.test(condition)) forecastWeight = 0.85;
  else if (/heavy/.test(condition)) forecastWeight = 0.7;
  else if (/moderate/.test(condition)) forecastWeight = 0.55;
  else if (/rain|shower|thunder|drizzle/.test(condition)) forecastWeight = 0.38;
  return Math.max(weight, forecastWeight, 0.03);
}

/** Point field from live IMD station observations (lat/lon come from IMD). */
function weatherHeatData(stations: WeatherStation[], metric: WeatherMetric): maplibregl.GeoJSONSourceSpecification["data"] {
  const features: unknown[] = [];
  for (const station of stations) {
    if (station.lat === null || station.lon === null) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [station.lon, station.lat] },
      properties: {
        w: heatWeight(station, metric),
        name: station.name,
        value: metric === "temperature" ? station.tempMax : station.rainfall,
      },
    });
  }
  return { type: "FeatureCollection", features } as unknown as maplibregl.GeoJSONSourceSpecification["data"];
}

/** Metric-specific density ramps: blue→red heat for temperature, blue depth for rain. */
function heatRamp(metric: WeatherMetric): maplibregl.ExpressionSpecification {
  const stops =
    metric === "temperature"
      ? [
          ["rgba(80, 140, 225, 0)", 0],
          ["#6bb6e8", 0.18],
          ["#8fd06a", 0.36],
          ["#f3d457", 0.56],
          ["#f0913a", 0.76],
          ["#d94a34", 1],
        ]
      : [
          ["rgba(90, 160, 255, 0)", 0],
          ["#a8d8ff", 0.16],
          ["#4aa8ff", 0.4],
          ["#2f66ee", 0.64],
          ["#5a35d0", 0.84],
          ["#8f2bb0", 1],
        ];
  const expression: unknown[] = ["interpolate", ["linear"], ["heatmap-density"]];
  for (const [color, density] of stops) {
    expression.push(density, color);
  }
  return expression as maplibregl.ExpressionSpecification;
}

/** "2026-09-25" → "25 Sep" (falls back to the raw string when unparseable). */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export interface SelectionSnapshot {
  kind: "parcel" | "location";
  parcel: ParcelFeature | null;
  lat: number;
  lon: number;
  /** Reverse-geocoded admin names (null fields = unavailable, never invented). */
  village: string | null;
  taluka: string | null;
  district: string | null;
  stateName: string | null;
  placeLabel: string | null;
}

export interface SimParams {
  use: string;
  intensity: number;
  bufferM: number;
}

export interface SimSnapshot {
  params: SimParams;
  /** Real geometric computation on real parcel geometry (local estimate). */
  bufferAreaHa: number;
  affectedParcels: number;
  status: "local-estimate";
}

export interface IndiaMapProps {
  theme: ThemeId;
  year: string;
  onThemeChange?: (theme: ThemeId) => void;
  onYearChange?: (year: string) => void;
  onSelection?: (selection: SelectionSnapshot | null) => void;
  onSimSnapshot?: (sim: SimSnapshot | null) => void;
  /** Action requests from outside the map (side-panel chips). */
  actionRequest?: MapAction | null;
  onActionHandled?: () => void;
  /** Overlay rendered inside the map frame (e.g. the details slide-over or an empty-state hint). */
  panel?: ReactNode;
  /** True while `panel` covers the right side — controls shift left and the camera recentres. */
  panelOpen?: boolean;
}

export interface MapAction {
  id: number;
  action: "analyze" | "regulations" | "simulate" | "historical" | "close";
}

export const SIM_USES = ["Industrial / Logistics", "Residential", "Commercial", "Agricultural", "Solar Park"] as const;

/** Approximate scenario circle (equirectangular, demo-grade but real math). */
function circlePolygon(lon: number, lat: number, radiusM: number, steps = 64): number[][][] {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lon + (Math.cos(a) * radiusM) / kx, lat + (Math.sin(a) * radiusM) / 110540]);
  }
  return [ring];
}

function distM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const kx = 111320 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 110540);
}

function ringHitsCircle(ring: number[][], clon: number, clat: number, radiusM: number): boolean {
  return ring.some((pt) => {
    const x = pt[0];
    const y = pt[1];
    return typeof x === "number" && typeof y === "number" && distM(x, y, clon, clat) <= radiusM;
  });
}

export function IndiaMap({ theme, year, onThemeChange, onYearChange, onSelection, onSimSnapshot, actionRequest, onActionHandled, panel, panelOpen = false }: IndiaMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);

  // Keep the camera's focus in the visible area beside the details panel
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const narrow = (container.current?.clientWidth ?? 0) < 760;
    map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: panelOpen && !narrow ? 400 : 0 }, duration: 450 });
  }, [panelOpen]);
  const hoverId = useRef<number | null>(null);
  const selectedId = useRef<number | null>(null);
  const baseModeRef = useRef<"map" | "satellite">("satellite");
  const parcelReq = useRef(0);
  const lastParcelView = useRef<{ lon: number; lat: number; span: number } | null>(null);
  const lastParcelLoadAt = useRef(0);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [themeState, setThemeState] = useState(theme);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const yearRef = useRef(year);
  yearRef.current = year;

  // --- Live IMD weather (Climate Risk heat replaces the old demo field) ---
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [weatherMetric, setWeatherMetric] = useState<WeatherMetric>("temperature");
  const [weatherStatus, setWeatherStatus] = useState<"idle" | "loading" | "live" | "unavailable">("idle");
  const weatherRef = useRef<WeatherSummary | null>(null);
  const weatherMetricRef = useRef<WeatherMetric>("temperature");
  weatherMetricRef.current = weatherMetric;

  // --- Satellite / parcel state (upgrade layer, existing behaviour kept) ---
  const [baseMode, setBaseMode] = useState<"map" | "satellite">("satellite");
  const [satDown, setSatDown] = useState(false);
  const [place, setPlace] = useState<PlaceContext | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [parcels, setParcels] = useState<ParcelCollection | null>(null);
  const [parcelSource, setParcelSource] = useState<string | null>(null);
  const [parcelsLoading, setParcelsLoading] = useState(false);
  const [parcelsNote, setParcelsNote] = useState<string | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<ParcelFeature | null>(null);
  const [parcelState, setParcelState] = useState<string | null>(null);

  // --- Connected-experience state (map ↔ panel ↔ AI ↔ simulation) ---
  const [locationSel, setLocationSel] = useState<{ lat: number; lon: number; rev: ReversePlace | null } | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simParams, setSimParams] = useState<SimParams>({ use: SIM_USES[0], intensity: 65, bufferM: 500 });
  const [simRan, setSimRan] = useState(false);
  const [simResult, setSimResult] = useState<SimSnapshot | null>(null);
  const reverseReq = useRef(0);
  const placeRef = useRef<PlaceContext | null>(null);
  placeRef.current = place;
  const onSelectionRef = useRef(onSelection);
  onSelectionRef.current = onSelection;
  const onSimSnapshotRef = useRef(onSimSnapshot);
  onSimSnapshotRef.current = onSimSnapshot;

  baseModeRef.current = baseMode;
  // Year-driven provider: the shared timeline year selects the annual mosaic.
  const satProvider = getImageryConfig(`s2cloudless-${year}`);

  // --- Temporal playback + period cache (§19 pattern) ---
  const yearCache = useRef(new Map<string, true>());

  const setParcelData = (collection: ParcelCollection | null) => {
    setParcels(collection);
    const map = mapRef.current;
    const source = map?.getSource("parcels") as maplibregl.GeoJSONSource | undefined;
    if (map && source) {
      const withLabels: ParcelCollection = {
        type: "FeatureCollection",
        features: (collection?.features ?? []).map((f) => ({
          ...f,
          properties: { ...f.properties, shortId: f.properties.parcelId.replace(/^OSM-/, "") },
        })),
      };
      source.setData(withLabels as unknown as maplibregl.GeoJSONSourceSpecification["data"]);
    }
  };

  const setSelectedParcelData = (feature: ParcelFeature | null) => {
    const map = mapRef.current;
    const source = map?.getSource("selected-parcel") as maplibregl.GeoJSONSource | undefined;
    if (map && source) {
      source.setData(
        (feature
          ? { type: "FeatureCollection", features: [feature] }
          : EMPTY_PARCELS) as unknown as maplibregl.GeoJSONSourceSpecification["data"],
      );
    }
  };

  /**
   * Ordered provider chain (first non-empty wins):
   *   1. Cadastral API  — GET /api/parcels?bbox=… (imported Adai scope + future state providers)
   *   2. Bundled extract — offline-proof demo corridor
   *   3. Live OSM        — viewport Overpass fetch
   * Empty everywhere → honest "unavailable", never invented geometry.
   */
  const loadParcelsAround = async (lon: number, lat: number, span = 0.045) => {
    const map = mapRef.current;
    if (!map?.getSource("parcels")) return;
    lastParcelView.current = { lon, lat, span };
    lastParcelLoadAt.current = Date.now();
    const bbox: BBox = [lon - span, lat - span, lon + span, lat + span];
    const request = ++parcelReq.current;
    const useResult = (collection: ParcelCollection) => {
      if (parcelReq.current !== request) return false;
      setParcelData(collection);
      setParcelSource(collection.features[0]?.properties.source ?? null);
      setParcelsNote(null);
      return true;
    };

    try {
      const api = new ParcelApiProvider();
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const fromApi = await api.query(bbox, controller.signal);
        if (fromApi.features.length > 0 && useResult(fromApi)) return;
      } catch {
        /* endpoint absent (dev) or Adai scope not intersecting — fall through */
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      /* provider construction never throws; defensive */
    }

    const demo = filterParcelsByBBox(getDemoParcels(), bbox);
    if (demo.features.length > 0 && useResult(demo)) return;

    setParcelsLoading(true);
    setParcelsNote(null);
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 70000);
      const live = await fetchLiveParcels(bbox, controller.signal);
      window.clearTimeout(timer);
      if (parcelReq.current !== request) return;
      if (live.features.length > 0) {
        setParcelData(live);
        setParcelSource(live.features[0]?.properties.source ?? null);
        setParcelsNote(null);
      } else {
        setParcelData(EMPTY_PARCELS);
        setParcelSource(null);
        setParcelsNote("Parcel boundary unavailable for this location");
      }
    } catch {
      if (parcelReq.current !== request) return;
      setParcelData(EMPTY_PARCELS);
      setParcelSource(null);
      setParcelsNote("Parcel boundary unavailable for this location");
    } finally {
      if (parcelReq.current === request) setParcelsLoading(false);
    }
  };

  const retryParcels = () => {
    const view = lastParcelView.current;
    if (!view || parcelsLoading) return;
    clearParcelFailures();
    void loadParcelsAround(view.lon, view.lat, view.span);
  };

  const selectStateByName = (name: string) => {
    const map = mapRef.current;
    if (map?.getSource("states")) {
      try {
        if (selectedId.current !== null) {
          map.setFeatureState({ source: "states", id: selectedId.current }, { selected: false });
          selectedId.current = null;
        }
        const match = map
          .querySourceFeatures("states")
          .find((f) => (f.properties as Record<string, unknown> | null)?.["name"] === name);
        if (typeof match?.id === "number") {
          selectedId.current = match.id;
          map.setFeatureState({ source: "states", id: match.id }, { selected: true });
        }
      } catch {
        /* source not queryable yet — card still syncs */
      }
    }
    setSelected(name);
    setSelectedParcel(null);
    setSelectedParcelData(null);
  };

  const clearStateHighlight = () => {
    const map = mapRef.current;
    if (map?.getSource("states") && selectedId.current !== null) {
      try {
        map.setFeatureState({ source: "states", id: selectedId.current }, { selected: false });
      } catch {
        /* ignore */
      }
      selectedId.current = null;
    }
  };

  const emitSel = (snap: SelectionSnapshot | null) => onSelectionRef.current?.(snap);

  const drawSimOverlay = (buffer: number[][][] | null, affectedIds: string[]) => {
    const map = mapRef.current;
    const bufferSource = map?.getSource("sim-buffer") as maplibregl.GeoJSONSource | undefined;
    if (map && bufferSource) {
      bufferSource.setData(
        (buffer
          ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: buffer } }] }
          : EMPTY_PARCELS) as unknown as maplibregl.GeoJSONSourceSpecification["data"],
      );
    }
    if (map?.getLayer("sim-affected")) {
      map.setPaintProperty(
        "sim-affected",
        "line-color",
        ["match", ["get", "parcelId"], affectedIds, "#f59e0b", "rgba(0,0,0,0)"] as unknown as maplibregl.ExpressionSpecification,
      );
      map.setPaintProperty("sim-affected", "line-width", affectedIds.length > 0 ? 2 : 0);
    }
  };

  const closeSim = (silent = false) => {
    setSimOpen(false);
    setSimRan(false);
    setSimResult(null);
    drawSimOverlay(null, []);
    if (!silent) onSimSnapshotRef.current?.(null);
  };

  const clearAllSelection = () => {
    closeSim(true);
    onSimSnapshotRef.current?.(null);
    clearStateHighlight();
    setSelected(null);
    setSelectedParcel(null);
    setParcelState(null);
    setSelectedParcelData(null);
    setLocationSel(null);
    setBrief(null);
    emitSel(null);
  };

  /** Click-anywhere naming: reverse-geocode, then re-emit the snapshot. */
  const resolveLocation = async (lat: number, lon: number, stateName: string | null) => {
    const req = ++reverseReq.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const rev = await reverseGeocode(lat, lon, controller.signal);
      if (reverseReq.current !== req) return;
      setLocationSel((prev) =>
        prev && Math.abs(prev.lat - lat) < 1e-9 && Math.abs(prev.lon - lon) < 1e-9 ? { lat, lon, rev } : prev,
      );
      emitSel({
        kind: "location",
        parcel: null,
        lat,
        lon,
        village: rev?.village ?? null,
        taluka: rev?.taluka ?? null,
        district: rev?.district ?? null,
        stateName: rev?.state ?? stateName,
        placeLabel: rev?.label ?? null,
      });
    } finally {
      window.clearTimeout(timer);
    }
  };

  const simAnchor = (): { lon: number; lat: number; parcel: ParcelFeature | null } | null => {
    if (selectedParcel) {
      const [lon, lat] = parcelCenter(selectedParcel);
      return { lon, lat, parcel: selectedParcel };
    }
    if (locationSel) return { lon: locationSel.lon, lat: locationSel.lat, parcel: null };
    return null;
  };

  /** Real geometric scenario computation on real parcel geometry (local estimate — no backend). */
  const runSimulation = () => {
    const anchor = simAnchor();
    const map = mapRef.current;
    if (!anchor || !map?.getSource("sim-buffer")) return;
    const buffer = circlePolygon(anchor.lon, anchor.lat, simParams.bufferM);
    const loaded = parcels?.features ?? [];
    const affected = loaded.filter(
      (f) => (!anchor.parcel || f.properties.parcelId !== anchor.parcel.properties.parcelId) && ringHitsCircle(f.geometry.coordinates[0] ?? [], anchor.lon, anchor.lat, simParams.bufferM),
    );
    drawSimOverlay(buffer, affected.map((f) => f.properties.parcelId));
    setSimRan(true);
    const snap: SimSnapshot = {
      params: { ...simParams },
      bufferAreaHa: (Math.PI * simParams.bufferM * simParams.bufferM) / 10000,
      affectedParcels: affected.length,
      status: "local-estimate",
    };
    setSimResult(snap);
    onSimSnapshotRef.current?.(snap);
  };

  /** Deterministic brief from REAL selection data only. No invented values. */
  const buildBrief = (mode: "analyze" | "regulations", question?: string): string => {
    const lines: string[] = [];
    const anchorName = selectedParcel
      ? `Parcel ${selectedParcel.properties.parcelId.replace(/^OSM-/, "")}`
      : locationSel
        ? `${locationSel.lat.toFixed(5)}, ${locationSel.lon.toFixed(5)}`
        : place
          ? place.name
          : "No selection";
    if (question) lines.push(`Q: ${question}`);
    if (selectedParcel) {
      const p = selectedParcel.properties;
      const acres = parcelAcres(selectedParcel);
      lines.push(
        `${anchorName}: ${p.landuse} use, ${acres.toFixed(1)} acres (${(acres * 0.404686).toFixed(2)} ha). Source: ${p.source}.` +
          (p.surveyNumber ? ` Survey No. ${p.surveyNumber}.` : " Survey number not present in open data — verify the 7/12 extract at the Tehsil office."),
      );
    } else {
      lines.push(`${anchorName}: location context (no parcel geometry selected).`);
    }
    const stateName = parcelState ?? (locationSel ? stateAt(locationSel.lon, locationSel.lat) : null);
    const stat = stateName ? STATE_STATS[stateName] : undefined;
    if (stateName && stat) {
      lines.push(
        `${stateName} (state demo aggregates): land-use change +${stat.change.toFixed(1)}%, ${stat.disputes.toLocaleString("en-IN")} active disputes, climate risk ${stat.risk}.`,
      );
    }
    if (mode === "regulations") {
      lines.push(
        "General procedure (verify locally): NA conversion under Section 44 of the Maharashtra Land Revenue Code 1966 needs Collector permission; check zoning with the planning authority and mutation status in the 7/12 record.",
      );
    }
    const prevYear = previousMosaicYear(year);
    lines.push(
      `Temporal context: ${THEMES[themeState].label}, year ${year}${prevYear ? ` (previous mosaic ${prevYear} for year-over-year satellite comparison)` : ""}, region ${stateName ?? place?.name ?? "India"}. Thematic indicators follow the demo year series for ${year} (base period ${THEME_TIMELINES[themeState].dataPeriod}); annual landscape change is visible in the satellite mosaic.`,
    );
    if (simRan) {
      lines.push(
        `Active scenario: ${simParams.use} at ${simParams.intensity}% intensity with a ${simParams.bufferM} m buffer. Scenario geometry only — feasibility and timelines need the simulation backend.`,
      );
    }
    lines.push("Demo brief assembled from visible map data. Connect an AI endpoint for live analysis.");
    return lines.join("\n\n");
  };

  const askAi = (preset?: string) => {
    const text = preset?.trim() ?? "";
    if (!text && !selectedParcel && !locationSel && !place) return;
    setBrief(buildBrief("analyze", text || undefined));
  };

  const goToPlace = (name: string, lat: number, lon: number, zoom = 12) => {
    closeSim(true);
    onSimSnapshotRef.current?.(null);
    setPlace({ name, lat, lon });
    setQuery("");
    setResults([]);
    mapRef.current?.flyTo({ center: [lon, lat], zoom, duration: 1400 });
    const stateName = stateAt(lon, lat);
    if (stateName) selectStateByName(stateName);
    else {
      clearStateHighlight();
      setSelected(null);
      setSelectedParcel(null);
      setSelectedParcelData(null);
    }
    setLocationSel({ lat, lon, rev: null });
    emitSel({
      kind: "location",
      parcel: null,
      lat,
      lon,
      village: null,
      taluka: null,
      district: null,
      stateName,
      placeLabel: name,
    });
    void resolveLocation(lat, lon, stateName);
    void loadParcelsAround(lon, lat);
  };

  // Debounced location search (Nominatim, India-scoped).
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const hits = await searchPlaces(text, controller.signal);
        setResults(hits);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Recreate the map on retry; theme syncs through paint updates.
  useEffect(() => {
    if (!container.current) return;
    let map: MapInstance | null = null;
    let cancelled = false;
    let moveTimer: number | undefined;
    setStatus("loading");
    setSelected(null);
    setHover(null);
    setSelectedParcel(null);
    setParcelState(null);
    setLocationSel(null);
    setBrief(null);
    setSimOpen(false);
    setSimRan(false);
    setSimResult(null);
    setParcels(null);
    setParcelSource(null);
    setParcelsNote(null);
    hoverId.current = null;
    selectedId.current = null;

    try {
      map = new maplibregl.Map({
        container: container.current,
        bounds: INDIA_BOUNDS,
        fitBoundsOptions: { padding: 28 },
        minZoom: 3,
        maxZoom: 16,
        attributionControl: false,
        style: {
          version: 8,
          glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
          sources: {
            base: {
              type: "raster",
              tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=cb1_3vsa_1_e1c600cfb2864f18a2fdb94f"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors © CARTO",
            },
            satellite: {
              type: "raster",
              tiles: [getDefaultProvider().tileUrl],
              tileSize: 256,
              maxzoom: 14,
              attribution: "Sentinel-2 cloudless · EOX · Copernicus",
            },
          },
          layers: [
            { id: "warm", type: "background", paint: { "background-color": "#f2eee1" } },
            {
              id: "base",
              type: "raster",
              source: "base",
              paint: { "raster-saturation": -0.35, "raster-opacity": 0.72, "raster-contrast": -0.08 },
            },
            {
              id: "satellite",
              type: "raster",
              source: "satellite",
              layout: { visibility: "none" },
              paint: { "raster-opacity": 1, "raster-fade-duration": 300 },
            },
          ],
        },
      });
    } catch {
      if (!cancelled) setStatus("error");
      return () => {};
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: "metric" }), "bottom-left");
    mapRef.current = map;

    map.on("error", (event) => {
      const err = event as unknown as { sourceId?: string; error?: { status?: number; message?: string } };
      if (err.sourceId !== "satellite" || cancelled) return;
      // EOX answers 404 for tiles with no imagery (open ocean) — expected,
      // not an outage. Never force-quit satellite mode over tile hiccups.
      const status = err.error?.status;
      const message = err.error?.message ?? "";
      if (status === 404 || message.includes("404")) return;
      setSatDown(true);
    });

    map.on("load", () => {
      if (cancelled || !map) return;
      map.addSource("states", {
        type: "geojson",
        data: states as unknown as maplibregl.GeoJSONSourceSpecification["data"],
        generateId: true,
      });
      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: "states",
        paint: {
          "fill-color": fillExpression(themeRef.current, false, yearRef.current),
          "fill-opacity": statesOpacity(baseModeRef.current === "satellite"),
          "fill-color-transition": { duration: 500 },
          "fill-opacity-transition": { duration: 400 },
        },
      });
      // Boundary lines first — the heatmap below inserts itself before this
      // layer id, and MapLibre silently drops insertions before a missing id.
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: "states",
        paint: { "line-color": BOUNDARY_LINE, "line-width": 0.7, "line-opacity": 0.9 },
      });
      // Live IMD weather heatmap — sits above the choropleth, below
      // boundaries/labels; visible only on the Climate Risk tab. The source
      // starts empty and is filled by the weather fetch effect below.
      map.addSource(CLIMATE_HEAT_SOURCE, {
        type: "geojson",
        data: EMPTY_HEAT,
      });
      map.addLayer(
        {
          id: CLIMATE_HEAT_LAYER,
          type: "heatmap",
          source: CLIMATE_HEAT_SOURCE,
          layout: { visibility: themeRef.current === "climate-risk" ? "visible" : "none" },
          paint: {
            "heatmap-weight": ["get", "w"],
            "heatmap-intensity": 1.05,
            "heatmap-radius": 46,
            "heatmap-opacity": 0.78,
            "heatmap-color": heatRamp(weatherMetricRef.current),
          },
        },
        LINE_LAYER,
      );
      map.addLayer({
        id: SELECT_LAYER,
        type: "line",
        source: "states",
        paint: {
          "line-color": SELECT_LINE,
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.4, 0],
        },
      });
      map.addLayer({
        id: "states-label",
        type: "symbol",
        source: "states",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 9,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#3d4a3a",
          "text-halo-color": "rgba(242, 238, 225, 0.9)",
          "text-halo-width": 1.2,
        },
      });

      // --- Parcel layers (rendered above states, below labels) ---
      map.addSource("parcels", { type: "geojson", data: EMPTY_PARCELS as unknown as maplibregl.GeoJSONSourceSpecification["data"] });
      map.addSource("selected-parcel", { type: "geojson", data: EMPTY_PARCELS as unknown as maplibregl.GeoJSONSourceSpecification["data"] });
      map.addSource("sim-buffer", { type: "geojson", data: EMPTY_PARCELS as unknown as maplibregl.GeoJSONSourceSpecification["data"] });
      map.addLayer({
        id: PARCEL_FILL_LAYER,
        type: "fill",
        source: "parcels",
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: PARCEL_LINE_LAYER,
        type: "line",
        source: "parcels",
        paint: { "line-color": PARCEL_LINE, "line-width": 1.2, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: SELECTED_FILL_LAYER,
        type: "fill",
        source: "selected-parcel",
        paint: { "fill-color": HIGHLIGHT_FILL, "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: SELECTED_LINE_LAYER,
        type: "line",
        source: "selected-parcel",
        paint: { "line-color": HIGHLIGHT_LINE, "line-width": 2 },
      });
      map.addLayer({
        id: PARCEL_LABEL_LAYER,
        type: "symbol",
        source: "parcels",
        minzoom: 11,
        layout: {
          "text-field": ["concat", ["get", "landuse"], " · ", ["get", "shortId"]],
          "text-size": 9,
          "text-allow-overlap": false,
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "rgba(20,30,20,0.85)", "text-halo-width": 1.2 },
      });
      map.addLayer({
        id: "sim-buffer-fill",
        type: "fill",
        source: "sim-buffer",
        paint: { "fill-color": "#1e4632", "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: "sim-buffer-line",
        type: "line",
        source: "sim-buffer",
        paint: { "line-color": "#1e4632", "line-width": 1.6, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: "sim-affected",
        type: "line",
        source: "parcels",
        paint: { "line-color": "#f59e0b", "line-width": 0 },
      });

      const clearHover = () => {
        if (hoverId.current !== null && map) {
          map.setFeatureState({ source: "states", id: hoverId.current }, { hover: false });
          hoverId.current = null;
        }
        setHover(null);
      };

      map.on("mousemove", FILL_LAYER, (event) => {
        const feature = event.features?.[0];
        if (!feature) {
          clearHover();
          return;
        }
        const name = feature.properties?.["name"];
        if (typeof name !== "string") {
          clearHover();
          return;
        }
        if (hoverId.current !== null && hoverId.current !== feature.id && map) {
          map.setFeatureState({ source: "states", id: hoverId.current }, { hover: false });
        }
        if (typeof feature.id === "number" && map) {
          hoverId.current = feature.id;
          map.setFeatureState({ source: "states", id: feature.id }, { hover: true });
          map.getCanvas().style.cursor = "pointer";
        }
        setHover({ name, x: event.point.x, y: event.point.y });
      });
      map.on("mouseleave", FILL_LAYER, () => {
        clearHover();
        if (map) map.getCanvas().style.cursor = "";
      });

      const parcelHitAt = (point: [number, number]) => {
        if (!map) return false;
        const hits = map.queryRenderedFeatures(point, {
          layers: [PARCEL_FILL_LAYER, PARCEL_LINE_LAYER, SELECTED_LINE_LAYER, SELECTED_FILL_LAYER],
        });
        return hits.length > 0;
      };

      const onParcelClick = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature || !map) return;
        const props = feature.properties as Record<string, unknown> | null;
        const parcelId = props?.["parcelId"];
        if (typeof parcelId !== "string") return;
        const current = map.querySourceFeatures("parcels").find(
          (f) => (f.properties as Record<string, unknown> | null)?.["parcelId"] === parcelId,
        );
        const geometry = (current?.geometry ?? feature.geometry) as ParcelFeature["geometry"];
        if (geometry?.type !== "Polygon") return;
        const parcel: ParcelFeature = {
          type: "Feature",
          properties: {
            parcelId,
            surveyNumber: typeof props?.["surveyNumber"] === "string" ? (props["surveyNumber"] as string) : null,
            landuse: typeof props?.["landuse"] === "string" ? (props["landuse"] as string) : "unknown",
            name: typeof props?.["name"] === "string" ? (props["name"] as string) : null,
            source: typeof props?.["source"] === "string" ? (props["source"] as string) : "OpenStreetMap",
            ...(typeof props?.["village"] === "string" ? { village: props["village"] as string } : {}),
            ...(typeof props?.["taluka"] === "string" ? { taluka: props["taluka"] as string } : {}),
            ...(typeof props?.["district"] === "string" ? { district: props["district"] as string } : {}),
            ...(typeof props?.["state"] === "string" ? { state: props["state"] as string } : {}),
          },
          geometry,
        };
        const center = map.getCenter();
        const [pcLon, pcLat] = parcelCenter(parcel);
        const st = stateAt(center.lng, center.lat) ?? stateAt(pcLon, pcLat);
        setParcelState(st);
        setSelectedParcel(parcel);
        setSelectedParcelData(parcel);
        setLocationSel(null);
        map.getCanvas().style.cursor = "pointer";
        closeSim(true);
        onSimSnapshotRef.current?.(null);
        emitSel({
          kind: "parcel",
          parcel,
          lat: pcLat,
          lon: pcLon,
          village: parcel.properties.village ?? null,
          taluka: parcel.properties.taluka ?? null,
          district: parcel.properties.district ?? null,
          stateName: st,
          placeLabel: placeRef.current?.name ?? null,
        });
      };

      map.on("click", PARCEL_FILL_LAYER, onParcelClick);
      map.on("click", PARCEL_LINE_LAYER, onParcelClick);
      map.on("mousemove", PARCEL_FILL_LAYER, () => {
        if (map) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", PARCEL_FILL_LAYER, () => {
        if (map) map.getCanvas().style.cursor = "";
      });

      map.on("click", FILL_LAYER, (event) => {
        if (!map || parcelHitAt([event.point.x, event.point.y])) return;
        const feature = event.features?.[0];
        if (!feature) return;
        const name = feature.properties?.["name"];
        if (typeof name !== "string" || !map) return;
        if (selectedId.current !== null) {
          map.setFeatureState({ source: "states", id: selectedId.current }, { selected: false });
        }
        if (typeof feature.id === "number") {
          selectedId.current = feature.id;
          map.setFeatureState({ source: "states", id: feature.id }, { selected: true });
        }
        setSelected(name);
        setSelectedParcel(null);
        setSelectedParcelData(null);
        const { lng, lat } = event.lngLat;
        setLocationSel({ lat, lon: lng, rev: null });
        closeSim(true);
        onSimSnapshotRef.current?.(null);
        emitSel({
          kind: "location",
          parcel: null,
          lat,
          lon: lng,
          village: null,
          taluka: null,
          district: null,
          stateName: name,
          placeLabel: null,
        });
        void resolveLocation(lat, lng, name);
      });
      // Debounced viewport refetch: significant moves at parcel zoom reload
      // boundaries for the new bbox without touching satellite imagery.
      map.on("moveend", () => {
        if (cancelled || !map) return;
        window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(() => {
          if (cancelled || !map) return;
          const center = map.getCenter();
          if (map.getZoom() < 11) return;
          const last = lastParcelView.current;
          if (last && Math.abs(last.lon - center.lng) < 0.02 && Math.abs(last.lat - center.lat) < 0.02) return;
          if (Date.now() - lastParcelLoadAt.current < 4000) return;
          void loadParcelsAround(center.lng, center.lat, 0.045);
        }, 700);
      });
      map.on("click", (event) => {
        const hits = map?.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] });
        const parcelHits = map?.queryRenderedFeatures(event.point, {
          layers: [PARCEL_FILL_LAYER, PARCEL_LINE_LAYER, SELECTED_LINE_LAYER, SELECTED_FILL_LAYER],
        });
        if ((!hits || hits.length === 0) && (!parcelHits || parcelHits.length === 0) && map) {
          // Click-anywhere: select the geographic location itself.
          clearStateHighlight();
          setSelected(null);
          setSelectedParcel(null);
          setParcelState(null);
          setSelectedParcelData(null);
          const { lng, lat } = event.lngLat;
          const stateName = stateAt(lng, lat);
          if (stateName) {
            try {
              const match = map
                .querySourceFeatures("states")
                .find((f) => (f.properties as Record<string, unknown> | null)?.["name"] === stateName);
              if (typeof match?.id === "number") {
                selectedId.current = match.id;
                map.setFeatureState({ source: "states", id: match.id }, { selected: true });
              }
            } catch {
              /* ignore */
            }
            setSelected(stateName);
          }
          setLocationSel({ lat, lon: lng, rev: null });
          closeSim(true);
          onSimSnapshotRef.current?.(null);
          emitSel({
            kind: "location",
            parcel: null,
            lat,
            lon: lng,
            village: null,
            taluka: null,
            district: null,
            stateName,
            placeLabel: null,
          });
          void resolveLocation(lat, lng, stateName);
        }
      });

      // Keep the theme in sync for any tab switches that happened pre-load,
      // and restore satellite styling if the map was recreated mid-session.
      if (map.getLayer(FILL_LAYER)) {
        const sat = baseModeRef.current === "satellite";
        map.setPaintProperty(FILL_LAYER, "fill-color", fillExpression(themeRef.current, sat, yearRef.current));
        map.setPaintProperty(FILL_LAYER, "fill-opacity", statesOpacity(sat));
        map.setLayoutProperty("satellite", "visibility", sat ? "visible" : "none");
        map.setLayoutProperty("base", "visibility", sat ? "none" : "visible");
      }
      if (map.getLayer(CLIMATE_HEAT_LAYER)) {
        map.setLayoutProperty(CLIMATE_HEAT_LAYER, "visibility", themeRef.current === "climate-risk" ? "visible" : "none");
        (map.getSource(CLIMATE_HEAT_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(
          weatherHeatData(weatherRef.current?.stations ?? [], weatherMetricRef.current),
        );
      }
      if (!cancelled) {
        setStatus("ready");
        setThemeState(themeRef.current);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(moveTimer);
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  // Thematic tab switching flips the live-weather heat on (Climate Risk) or
  // off (any other theme); its data already lives in the source.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map?.getLayer(FILL_LAYER)) return;
    map.setPaintProperty(FILL_LAYER, "fill-color", fillExpression(theme, baseModeRef.current === "satellite", yearRef.current));
    if (map.getLayer(CLIMATE_HEAT_LAYER)) {
      map.setLayoutProperty(CLIMATE_HEAT_LAYER, "visibility", theme === "climate-risk" ? "visible" : "none");
    }
    setThemeState(theme);
  }, [theme, status]);

  // Satellite year switching rebuilds the raster source in place (viewport
  // tiles only — the mosaic year is the one real multi-period dataset).
  const rebuildSatellite = () => {
    const map = mapRef.current;
    if (!map?.getLayer("satellite")) return false;
    const provider = getImageryConfig(`s2cloudless-${year}`);
    yearCache.current.set(cacheKey(themeRef.current, year), true);
    const visible = map.getLayoutProperty("satellite", "visibility") !== "none";
    map.removeLayer("satellite");
    map.removeSource("satellite");
    map.addSource("satellite", {
      type: "raster",
      tiles: [provider.tileUrl],
      tileSize: provider.tileSize,
      maxzoom: provider.maxZoom,
      attribution: provider.credit,
    });
    map.addLayer(
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        layout: { visibility: visible ? "visible" : "none" },
        paint: { "raster-opacity": 1, "raster-fade-duration": 400 },
      },
      FILL_LAYER,
    );
    setSatDown(false);
    return true;
  };
  useEffect(() => {
    if (status !== "ready") return;
    rebuildSatellite();
    // Scrubbing the timeline repaints the choropleth (demo year series). The
    // weather heat is live IMD observation data, so it stays put — only the
    // satellite mosaic and state fills respond to the year.
    const map = mapRef.current;
    if (map?.getLayer(FILL_LAYER)) {
      map.setPaintProperty(FILL_LAYER, "fill-color", fillExpression(themeRef.current, baseModeRef.current === "satellite", year));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, status]);

  // Live IMD weather: fetched once when the Climate Risk tab is first ready,
  // cached client-side, and pushed into the heat source (or cleared on error).
  useEffect(() => {
    if (status !== "ready" || theme !== "climate-risk") return;
    let active = true;
    if (!weatherRef.current) setWeatherStatus("loading");
    fetchWeatherSummary()
      .then((summary) => {
        if (!active) return;
        weatherRef.current = summary;
        setWeather(summary);
        setWeatherStatus("live");
        const map = mapRef.current;
        if (map?.getSource(CLIMATE_HEAT_SOURCE)) {
          (map.getSource(CLIMATE_HEAT_SOURCE) as maplibregl.GeoJSONSource).setData(
            weatherHeatData(summary.stations, weatherMetricRef.current),
          );
        }
      })
      .catch(() => {
        if (!active) return;
        if (weatherRef.current) setWeatherStatus("live");
        else {
          setWeatherStatus("unavailable");
          const map = mapRef.current;
          if (map?.getSource(CLIMATE_HEAT_SOURCE)) {
            (map.getSource(CLIMATE_HEAT_SOURCE) as maplibregl.GeoJSONSource).setData(EMPTY_HEAT);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [status, theme]);

  // Metric toggle: repaint the same live points with the other ramp/weights.
  useEffect(() => {
    const map = mapRef.current;
    if (!weatherRef.current || !map?.getLayer(CLIMATE_HEAT_LAYER)) return;
    (map.getSource(CLIMATE_HEAT_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(
      weatherHeatData(weatherRef.current.stations, weatherMetric),
    );
    map.setPaintProperty(CLIMATE_HEAT_LAYER, "heatmap-color", heatRamp(weatherMetric));
    map.setPaintProperty(CLIMATE_HEAT_LAYER, "heatmap-radius", weatherMetric === "rainfall" ? 54 : 46);
    map.setPaintProperty(CLIMATE_HEAT_LAYER, "heatmap-intensity", weatherMetric === "rainfall" ? 1.3 : 1.05);
  }, [weatherMetric]);

  // Side-panel action requests (chips live outside the map; execution stays inside).
  useEffect(() => {
    if (!actionRequest) return;
    if (actionRequest.action === "analyze") askAi();
    else if (actionRequest.action === "regulations") setBrief(buildBrief("regulations"));
    else if (actionRequest.action === "simulate") setSimOpen(true);
    else if (actionRequest.action === "historical") {
      switchBaseMode("satellite");
      const prev = previousMosaicYear(year);
      if (prev) onYearChange?.(prev);
    } else if (actionRequest.action === "close") clearAllSelection();
    onActionHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionRequest]);

  const resetView = () => {
    clearAllSelection();
    setPlace(null);
    setParcels(null);
    setParcelSource(null);
    setParcelsNote(null);
    mapRef.current?.fitBounds(INDIA_BOUNDS, { padding: 28, duration: 700 });
  };

  const switchBaseMode = (mode: "map" | "satellite") => {
    setBaseMode(mode);
    if (mode === "satellite") setSatDown(false);
    if (status !== "ready") return;
    const map = mapRef.current;
    if (!map?.getLayer("satellite")) return;
    map.setLayoutProperty("satellite", "visibility", mode === "satellite" ? "visible" : "none");
    map.setLayoutProperty("base", "visibility", mode === "satellite" ? "none" : "visible");
    map.setPaintProperty(FILL_LAYER, "fill-color", fillExpression(themeRef.current, mode === "satellite", yearRef.current));
    map.setPaintProperty(FILL_LAYER, "fill-opacity", statesOpacity(mode === "satellite"));
    if (mode === "satellite" && !parcels && !parcelsLoading) {
      const center = map.getCenter();
      void loadParcelsAround(center.lng, center.lat, 0.06);
    }
  };

  const def = THEMES[themeState];
  const hasThemeData = Object.keys(STATE_STATS).length > 0;
  const parcelCount = parcels?.features.length ?? 0;

  // Footer legend: on Climate Risk the heat shows live IMD readings, so the
  // legend switches to the active weather metric instead of the risk bands.
  const weatherLegend =
    themeState === "climate-risk"
      ? weatherMetric === "temperature"
        ? {
            title: "Temperature today · IMD",
            stops: ["Cool < 25°C", "Warm 25–35°C", "Hot > 35°C"],
            colors: ["#6bb6e8", "#f3d457", "#d94a34"],
          }
        : {
            title: "Rainfall today · IMD",
            stops: ["Dry", "Light", "Heavy"],
            colors: ["#a8d8ff", "#4aa8ff", "#5a35d0"],
          }
      : { title: def.legendTitle, stops: [...def.legendStops], colors: [...def.ramp] };

  return (
    <div className="intel-mapwrap">
      <div className="intel-search" role="search" aria-label="Locate a place">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search village, taluka, PIN… e.g. Dholera"
          aria-label="Search locations in India"
        />
        {searching && <span className="intel-searching">…</span>}
        {results.length > 0 && (
          <ul>
            {results.map((hit) => (
              <li key={`${hit.lat}-${hit.lon}`}>
                <button onClick={() => goToPlace(hit.name, hit.lat, hit.lon)}>
                  <MapPin />
                  <span>
                    <strong>{hit.name}</strong>
                    <small>{hit.displayName}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length === 0 && (
          <div className="intel-presets">
            {DEMO_PRESETS.map((preset) => (
              <button key={preset.name} onClick={() => goToPlace(preset.name, preset.lat, preset.lon, preset.zoom)}>
                {preset.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <section className={`intel-map${panelOpen ? " has-panel" : ""}`} aria-label="India land intelligence overview map">
      <div ref={container} className="map-canvas" />

      <div className="intel-chip" aria-live="polite">
        <strong>{place ? `${place.name} · ${def.headline}` : def.headline}</strong>
        <span className="demo-chip">Demo data · Not official</span>
        {theme === "climate-risk" && (
          <div className="weather-modes" role="group" aria-label="Live weather heatmap metric">
            <button type="button" className={weatherMetric === "temperature" ? "active" : ""} onClick={() => setWeatherMetric("temperature")}>
              <Thermometer /> Temperature
            </button>
            <button type="button" className={weatherMetric === "rainfall" ? "active" : ""} onClick={() => setWeatherMetric("rainfall")}>
              <Droplets /> Rainfall
            </button>
            <span className={`weather-status ${weatherStatus}`}>
              {weatherStatus === "loading" && "Fetching live IMD weather…"}
              {weatherStatus === "live" &&
                (weather ? `IMD live · ${weather.count} stations · ${shortDate(weather.stations[0]?.observedAt ?? null) ?? "today"}` : "")}
              {weatherStatus === "unavailable" && "IMD weather unavailable — reload to retry"}
              {weatherStatus === "idle" && ""}
            </span>
          </div>
        )}
      </div>

      <div className="intel-basemap" role="group" aria-label="Base map style">
        <button className={baseMode === "satellite" ? "active" : ""} onClick={() => switchBaseMode("satellite")}>
          <Satellite /> Satellite
        </button>
        <button className={baseMode === "map" ? "active" : ""} onClick={() => switchBaseMode("map")}>
          <MapIcon /> Map
        </button>
      </div>

      {baseMode === "satellite" && (
        <div className="intel-satmeta">
          <span>
            {satProvider.label} · {satProvider.credit}
          </span>
        </div>
      )}

      {hover && !selected && !selectedParcel && <HoverTip hover={hover} theme={themeState} />}

      {(parcelsLoading || parcelsNote || (parcels && parcelCount > 0)) && (
        parcelsNote ? (
          <button className="parcel-note parcel-retry" role="status" onClick={retryParcels} title="Retry parcel fetch">
            {parcelsNote} · Tap to retry
          </button>
        ) : (
          <div className="parcel-note" role="status">
            {parcelsLoading ? "Loading parcel boundaries…" : `${parcelCount} boundaries · ${parcelSource ?? "OpenStreetMap"}`}
          </div>
        )
      )}

      <button className="intel-reset" aria-label="Reset India view" title="Reset India view" onClick={resetView}>
        <RotateCcw />
      </button>

      {simOpen && (
        <div className="sim-drawer" role="dialog" aria-label="Policy simulation">
          <header>
            <strong>
              <SlidersHorizontal /> Policy Simulation
            </strong>
            <button aria-label="Close simulation" onClick={() => closeSim()}>
              <X />
            </button>
          </header>
          <label className="sim-field">
            Proposed Use
            <select value={simParams.use} onChange={(e) => setSimParams((p) => ({ ...p, use: e.target.value }))}>
              {SIM_USES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="sim-field">
            <span className="sim-label">
              Development Intensity <b>{simParams.intensity}%</b>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={simParams.intensity}
              onChange={(e) => setSimParams((p) => ({ ...p, intensity: Number(e.target.value) }))}
              aria-label="Development intensity percent"
            />
            <span className="sim-scale">
              <span>Low</span>
              <span>High</span>
            </span>
          </label>
          <label className="sim-field">
            <span className="sim-label">
              Environmental Buffer <b>{simParams.bufferM.toLocaleString("en-IN")} m</b>
            </span>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={simParams.bufferM}
              onChange={(e) => setSimParams((p) => ({ ...p, bufferM: Number(e.target.value) }))}
              aria-label="Environmental buffer metres"
            />
            <span className="sim-scale">
              <span>100m</span>
              <span>5000m</span>
            </span>
          </label>
          <button className="sim-run" onClick={runSimulation}>
            <Play /> Run Simulation
          </button>
          {simRan && simResult && (
            <div className="sim-result" aria-live="polite">
              <span className="sim-result-tag">Simulation result · local scenario geometry</span>
              <dl>
                <div>
                  <dt>Affected Area</dt>
                  <dd>{simResult.bufferAreaHa.toFixed(1)} ha</dd>
                </div>
                <div>
                  <dt>Affected Parcels</dt>
                  <dd>{simResult.affectedParcels}</dd>
                </div>
                <div>
                  <dt>Feasibility</dt>
                  <dd>Unavailable — connect POST /api/simulate</dd>
                </div>
                <div>
                  <dt>Timeline</dt>
                  <dd>Unavailable — connect POST /api/simulate</dd>
                </div>
                <div>
                  <dt>Constraints</dt>
                  <dd>Unavailable — backend legal engine not connected</dd>
                </div>
              </dl>
              <details className="sim-payload">
                <summary>Backend payload preview</summary>
                <pre>
                  {JSON.stringify(
                    {
                      endpoint: "POST /api/simulate (not connected)",
                      parcelId: selectedParcel?.properties.parcelId ?? null,
                      lat: simAnchor()?.lat ?? null,
                      lon: simAnchor()?.lon ?? null,
                      ...simResult.params,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {sourcesOpen && (
        <div className="source-drawer" role="dialog" aria-label="Map data sources">
          <header>
            <strong>Data sources</strong>
            <button aria-label="Close data sources" onClick={() => setSourcesOpen(false)}>
              <X />
            </button>
          </header>
          <table>
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Source</th>
                <th>Year</th>
                <th>Coverage</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Satellite imagery (true colour B04/B03/B02)</td>
                <td>Sentinel-2 cloudless · EOX · Copernicus</td>
                <td>{satProvider.label.replace("Sentinel-2 ", "")}</td>
                <td>Viewport</td>
                <td>Annual mosaic</td>
              </tr>
              <tr>
                <td>Parcel / field boundaries</td>
                <td>{parcelSource ?? "Source unavailable"}</td>
                <td>—</td>
                <td>{place?.name ?? "Demo corridor"}</td>
                <td>{isDemoMode() ? "Bundled extract" : "Live"}</td>
              </tr>
              <tr>
                <td>Cadastral API (Adai scope)</td>
                <td>GET /api/parcels · imported OSM extract</td>
                <td>—</td>
                <td>Adai, Panvel</td>
                <td>Bundled</td>
              </tr>
              <tr>
                <td>Bhu-Naksha direct geometry</td>
                <td>No public API — import a legitimate export via scripts/import_parcels.py</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
              </tr>
              {INTEL_SOURCES.map((row) => (
                <tr key={row.dataset}>
                  <td>{row.dataset}</td>
                  <td>{row.source}</td>
                  <td>{row.year}</td>
                  <td>{row.coverage}</td>
                  <td>{row.updated}</td>
                </tr>
              ))}
              <tr>
                <td>Base map</td>
                <td>CARTO · OpenStreetMap</td>
                <td>—</td>
                <td>Global</td>
                <td>Live tiles</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <footer className="intel-foot">
        <div className="intel-legend" aria-label={`${weatherLegend.title} legend`}>
          <span>{weatherLegend.title}</span>
          <ul>
            {weatherLegend.stops.map((stop, i) => (
              <li key={stop}>
                <i style={{ background: weatherLegend.colors[i] ?? weatherLegend.colors[0] }} />
                {stop}
              </li>
            ))}
          </ul>
        </div>
        <span className="intel-updated">
          {baseMode === "satellite" ? `${satProvider.label} · Latest available low-cloud imagery` : DATA_UPDATED_LABEL}
        </span>
        <div className="intel-actions">
          <button className="intel-sources" onClick={() => setSourcesOpen((v) => !v)} aria-expanded={sourcesOpen}>
            <Database /> Sources
          </button>
          <a className="intel-open" href={`/gis-explorer?layer=${themeState}`}>
            Open in GIS <ArrowRight />
          </a>
        </div>
      </footer>

      {satDown && (
        <div className="parcel-note sat-fallback" role="alert">
          Satellite tiles slow — loaded imagery stays visible.
          <button className="sat-link" onClick={() => rebuildSatellite()}>
            Retry
          </button>
          <button className="sat-link" onClick={() => switchBaseMode("map")}>
            Map view
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="map-status" role="status">
          <span className="map-spinner" aria-hidden="true" />
          Loading national land intelligence…
        </div>
      )}
      {status === "error" && (
        <div className="map-status" role="alert">
          National layer temporarily unavailable.
          <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </div>
      )}
      {status === "ready" && !hasThemeData && (
        <div className="map-status" role="status">
          No verified data available for this indicator.
        </div>
      )}

      {panel}
    </section>

      {brief && (
        <div className="ai-brief" aria-live="polite">
          <header>
            <span>
              <Sparkles /> Bhumi AI brief · demo data only
            </span>
            <button aria-label="Dismiss brief" onClick={() => setBrief(null)}>
              <X />
            </button>
          </header>
          <p>{brief}</p>
        </div>
      )}
    </div>
  );
}

function parcelCenter(feature: ParcelFeature): [number, number] {
  const ring = feature.geometry.coordinates[0] ?? [];
  if (ring.length === 0) return [0, 0];
  let x = 0;
  let y = 0;
  for (const pt of ring) {
    x += pt[0] ?? 0;
    y += pt[1] ?? 0;
  }
  return [x / ring.length, y / ring.length];
}

function HoverTip({ hover, theme }: { hover: HoverInfo; theme: ThemeId }) {
  const stat = STATE_STATS[hover.name];
  return (
    <div className="map-tip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
      <strong>{hover.name}</strong>
      <span>{stat ? primaryIndicator(theme, stat) : "No verified data"}</span>
    </div>
  );
}
