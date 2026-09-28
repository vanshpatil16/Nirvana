/**
 * Parcel boundary service.
 *
 * Real GeoJSON in, real GeoJSON out. The UI must never assume parcel data
 * exists: when nothing is available callers show
 * "Parcel boundary unavailable for this location" instead of inventing
 * geometry.
 *
 * Sources (all real, all credited in the UI):
 * - Bundled demo extract: genuine OpenStreetMap field/industrial polygons
 *   around the Gujarat demo corridor (Sanand GIDC, Dholera, Anand belt).
 *   These are illustrative boundaries, NOT legal survey records.
 * - Live provider: OpenStreetMap via Overpass, fetched per viewport bbox.
 */

import demoParcels from "@/data/demo-parcels.json";

export interface ParcelProperties {
  parcelId: string;
  /** Legal survey number. Null when the source does not carry one — never invented. */
  surveyNumber: string | null;
  landuse: string;
  name: string | null;
  source: string;
  village?: string;
  taluka?: string;
  district?: string;
  state?: string;
  /** Registry id in src/data/data-sources.ts — drives the provenance panel. */
  sourceId?: string | undefined;
  /** Cadastre provider id in src/services/cadastre.ts when the geometry is a real cadastral release. */
  providerId?: string | undefined;
}

export interface ParcelFeature {
  type: "Feature";
  properties: ParcelProperties;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface ParcelCollection {
  type: "FeatureCollection";
  features: ParcelFeature[];
}

export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

const DEMO_SOURCE = "OpenStreetMap extract (demo)";
const LIVE_SOURCE = "OpenStreetMap live";

function isParcelFeature(value: unknown): value is ParcelFeature {
  if (typeof value !== "object" || value === null) return false;
  const f = value as { type?: unknown; geometry?: { type?: unknown; coordinates?: unknown } };
  return f.type === "Feature" && f.geometry?.type === "Polygon" && Array.isArray(f.geometry.coordinates);
}

/** Bundled demo extract (real OSM geometry, see script notes in repo temp). */
export function getDemoParcels(): ParcelCollection {
  const raw = demoParcels as unknown as { features?: unknown[] };
  const features = (raw.features ?? []).filter(isParcelFeature).map((f) => ({
    ...f,
    properties: { ...f.properties, source: DEMO_SOURCE, sourceId: "parcel-demo-bundle" },
  }));
  return { type: "FeatureCollection", features };
}

function ringIntersectsBBox(ring: number[][], bbox: BBox): boolean {
  const [x0, y0, x1, y1] = bbox;
  return ring.some((pt) => {
    const x = pt[0];
    const y = pt[1];
    return typeof x === "number" && typeof y === "number" && x >= x0 && x <= x1 && y >= y0 && y <= y1;
  });
}

export function filterParcelsByBBox(collection: ParcelCollection, bbox: BBox): ParcelCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.filter((f) => ringIntersectsBBox(f.geometry.coordinates[0] ?? [], bbox)),
  };
}

// ---------------------------------------------------------------------------
// Live provider: Overpass field/industrial boundaries for the current bbox.
// Responses are cached per (rounded) bbox so panning back never refetches.
// ---------------------------------------------------------------------------

const OVERPASS_URLS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"];
const liveCache = new Map<string, ParcelCollection>();

function cacheKey(bbox: BBox): string {
  return bbox.map((v) => v.toFixed(3)).join(",");
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lon: number; lat: number }[];
}

function toParcel(el: OverpassElement): ParcelFeature | null {
  const geom = el.geometry;
  if (!geom || geom.length < 4) return null;
  const ring = geom.map((p) => [Math.round(p.lon * 1e5) / 1e5, Math.round(p.lat * 1e5) / 1e5]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return null;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...(first as [number, number])]);
  return {
    type: "Feature",
    properties: {
      parcelId: `OSM-W${el.id}`,
      surveyNumber: null,
      landuse: el.tags?.["landuse"] ?? "unknown",
      name: el.tags?.["name"] ?? el.tags?.["description"] ?? null,
      source: LIVE_SOURCE,
      sourceId: "parcel-osm-overpass",
    },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

const OVERPASS_ATTEMPT_MS = 12_000;

/**
 * Bound the caller's signal with a per-attempt timeout. Public Overpass
 * mirrors (notably kumi.systems) sometimes accept a connection and then hang
 * well past the query's own [timeout:50] — without a client-side cap a single
 * click can stall the parcel pipeline for minutes across the 2x2 retry grid.
 */
function attemptSignal(caller: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new DOMException("Overpass attempt timed out", "TimeoutError")),
    OVERPASS_ATTEMPT_MS,
  );
  if (caller.aborted) {
    clearTimeout(timer);
    ctrl.abort(caller.reason);
  } else {
    caller.addEventListener("abort", () => { clearTimeout(timer); ctrl.abort(caller.reason); }, { once: true });
  }
  return ctrl.signal;
}

async function queryOverpass(query: string, signal: AbortSignal): Promise<ParcelCollection> {
  let lastError: unknown = null;
  // Two rounds over the mirrors with a breather between them: public
  // Overpass instances frequently 504 under load, and a retry often lands
  // on a freed slot.
  for (let round = 0; round < 2; round++) {
    for (const endpoint of OVERPASS_URLS) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        const body = new URLSearchParams({ data: query });
        const res = await fetch(endpoint, { method: "POST", body, signal: attemptSignal(signal) });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const json = (await res.json()) as { elements?: OverpassElement[] };
        const features = (json.elements ?? [])
          .filter((el) => el.type === "way")
          .map(toParcel)
          .filter((f): f is ParcelFeature => f !== null);
        return { type: "FeatureCollection", features };
      } catch (err) {
        lastError = err;
      }
    }
    if (round === 0) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass unavailable");
}

const failedAt = new Map<string, number>();
const FAILURE_TTL_MS = 90_000;

/** Forget recent failures so the UI retry button refetches immediately. */
export function clearParcelFailures(bbox?: BBox): void {
  if (!bbox) {
    failedAt.clear();
    return;
  }
  failedAt.delete(cacheKey(bbox));
}

export async function fetchLiveParcels(bbox: BBox, signal: AbortSignal): Promise<ParcelCollection> {
  const key = cacheKey(bbox);
  const cached = liveCache.get(key);
  if (cached) return cached;
  const failed = failedAt.get(key);
  if (failed !== undefined && Date.now() - failed < FAILURE_TTL_MS) {
    throw new Error("Parcel service recently failed for this area");
  }
  const [x0, y0, x1, y1] = bbox;
  // One compact statement + capped output: small bboxes answer fast and
  // rarely trip the server-side timeout that causes 504s. The landuse filter
  // covers the rural demo corridor plus urban blocks (residential/commercial)
  // so city queries like "plots in Mira Road" get polygons too.
  const query = `[out:json][timeout:50];way["landuse"~"^(farmland|farm|orchard|meadow|industrial|residential|commercial)$"](${y0},${x0},${y1},${x1});out geom 200;`;
  try {
    const result = await queryOverpass(query, signal);
    liveCache.set(key, result);
    return result;
  } catch (err) {
    failedAt.set(key, Date.now());
    throw err;
  }
}

/** Rough polygon area in acres (equirectangular approximation, demo-grade). */
export function parcelAcres(feature: ParcelFeature): number {
  const ring = feature.geometry.coordinates[0] ?? [];
  if (ring.length < 4) return 0;
  const meanLat = ring.reduce((s, p) => s + (p[1] ?? 0), 0) / ring.length;
  const kx = 111320 * Math.cos((meanLat * Math.PI) / 180);
  const ky = 110540;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i] as [number, number];
    const [x1, y1] = ring[i + 1] as [number, number];
    area += x0 * kx * y1 * ky - x1 * kx * y0 * ky;
  }
  return Math.abs(area / 2) / 4046.86;
}

export function isDemoMode(): boolean {
  return import.meta.env["VITE_DEMO_MODE"] !== "false";
}

/**
 * Official state land-record portals (outbound links only — the user
 * continues on the government site itself; nothing is scraped or proxied).
 */
export const OFFICIAL_RECORD_PORTALS: Record<string, { label: string; url: string }> = {
  Maharashtra: { label: "MahaBhumi / Bhu-Naksha", url: "https://mahabhumi.gov.in" },
  Telangana: { label: "Dharani", url: "https://dharani.telangana.gov.in" },
  "Madhya Pradesh": { label: "MP Bhulekh", url: "https://mpbhulekh.gov.in" },
};

export function officialPortalFor(state?: string | null): { label: string; url: string } | null {
  if (!state) return null;
  return OFFICIAL_RECORD_PORTALS[state] ?? null;
}

// ---------------------------------------------------------------------------
// ParcelProvider abstraction. State-specific providers (Maharashtra, Gujarat,
// Karnataka, …) plug in here; the map only ever sees normalized GeoJSON.
// ---------------------------------------------------------------------------

export interface ParcelProvider {
  id: string;
  label: string;
  query(bbox: BBox, signal: AbortSignal): Promise<ParcelCollection>;
}

/** Bundled open-geometry extract (offline-proof demo corridor). */
export class BundleParcelProvider implements ParcelProvider {
  readonly id = "bundle";
  readonly label = "Bundled OSM extract";
  async query(bbox: BBox): Promise<ParcelCollection> {
    return filterParcelsByBBox(getDemoParcels(), bbox);
  }
}

/** Live OpenStreetMap field/industrial boundaries for the viewport bbox. */
export class OverpassParcelProvider implements ParcelProvider {
  readonly id = "overpass";
  readonly label = "OpenStreetMap live";
  async query(bbox: BBox, signal: AbortSignal): Promise<ParcelCollection> {
    return fetchLiveParcels(bbox, signal);
  }
}

function normalizeApiFeature(value: unknown): ParcelFeature | null {
  if (!isParcelFeature(value)) return null;
  const p = value.properties as Partial<ParcelProperties>;
  return {
    type: "Feature",
    properties: {
      parcelId: typeof p.parcelId === "string" ? p.parcelId : "unknown",
      surveyNumber: typeof p.surveyNumber === "string" ? p.surveyNumber : null,
      landuse: typeof p.landuse === "string" ? p.landuse : "unknown",
      name: typeof p.name === "string" ? p.name : null,
      source: typeof p.source === "string" ? p.source : "Cadastral API",
      ...(typeof p.village === "string" ? { village: p.village } : {}),
      ...(typeof p.taluka === "string" ? { taluka: p.taluka } : {}),
      ...(typeof p.district === "string" ? { district: p.district } : {}),
      ...(typeof p.state === "string" ? { state: p.state } : {}),
      ...(typeof p.sourceId === "string" ? { sourceId: p.sourceId } : { sourceId: apiSourceId(typeof p.source === "string" ? p.source : "") }),
    },
    geometry: value.geometry,
  };
}

/** Map the API's source label onto a registry id — only where the match is explicit. */
function apiSourceId(sourceLabel: string): string | undefined {
  if (sourceLabel.includes("BhuNaksha")) return "cadastral-vadnerbhairav";
  return undefined;
}

/**
 * Generic OGC WFS parcel provider.
 *
 * Use ONLY with endpoints you are authorized to query (a documented public
 * WFS, or state access credentials obtained through proper channels and
 * fronted by your own backend proxy — never CAPTCHA-bypass tooling, which
 * circumvents access controls and violates portal terms).
 *
 * Example wiring once legitimate access exists:
 *   new WfsParcelProvider({
 *     endpoint: "https://your-proxy/api/wfs",
 *     typeName: "cadastral:parcels",
 *     sourceLabel: "Maharashtra Bhu-Naksha (authorized)",
 *   })
 */
export interface WfsProviderOptions {
  endpoint: string;
  typeName: string;
  version?: string;
  sourceLabel: string;
  extraParams?: Record<string, string>;
}

export class WfsParcelProvider implements ParcelProvider {
  readonly id = "wfs";
  readonly label: string;
  private readonly options: Required<Omit<WfsProviderOptions, "extraParams">> & { extraParams: Record<string, string> };
  constructor(options: WfsProviderOptions) {
    this.label = options.sourceLabel;
    this.options = {
      version: "1.1.0",
      ...options,
      extraParams: options.extraParams ?? {},
    };
  }
  async query(bbox: BBox, signal: AbortSignal): Promise<ParcelCollection> {
    const [x0, y0, x1, y1] = bbox;
    const params = new URLSearchParams({
      service: "WFS",
      request: "GetFeature",
      version: this.options.version,
      typeName: this.options.typeName,
      outputFormat: "application/json",
      srsName: "EPSG:4326",
      bbox: `${x0},${y0},${x1},${y1},EPSG:4326`,
      ...this.options.extraParams,
    });
    const res = await fetch(`${this.options.endpoint}?${params.toString()}`, { signal });
    if (!res.ok) throw new Error(`WFS ${res.status}`);
    const json = (await res.json()) as { type?: unknown; features?: unknown[] };
    if (json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("WFS bad payload");
    return {
      type: "FeatureCollection",
      features: json.features
        .map((f) => {
          const feature = normalizeApiFeature(f);
          return feature ? { ...feature, properties: { ...feature.properties, source: this.options.sourceLabel } } : null;
        })
        .filter((f): f is ParcelFeature => f !== null),
    };
  }
}
/**
 * Cadastral API provider: GET /api/parcels?bbox=… (plus optional
 * village / surveyNumber / parcelId filters). Served by the app's own
 * server route with bbox filtering; falls back gracefully when the
 * endpoint is absent (e.g. framework dev servers without it mounted).
 */
export class ParcelApiProvider implements ParcelProvider {
  readonly id = "api";
  readonly label = "Cadastral API";
  private readonly baseUrl: string;
  constructor(baseUrl?: string) {
    const configured = typeof baseUrl === "string" && baseUrl.length > 0 ? baseUrl : import.meta.env["VITE_PARCEL_API_URL"];
    this.baseUrl = typeof configured === "string" && configured.length > 0 ? configured : "/api/parcels";
  }
  async query(bbox: BBox, signal: AbortSignal, params?: { village?: string; surveyNumber?: string; parcelId?: string }): Promise<ParcelCollection> {
    const [x0, y0, x1, y1] = bbox;
    const search = new URLSearchParams({ bbox: `${x0},${y0},${x1},${y1}` });
    if (params?.village) search.set("village", params.village);
    if (params?.surveyNumber) search.set("surveyNumber", params.surveyNumber);
    if (params?.parcelId) search.set("parcelId", params.parcelId);
    const res = await fetch(`${this.baseUrl}?${search.toString()}`, { signal });
    if (!res.ok) throw new Error(`Parcel API ${res.status}`);
    const json = (await res.json()) as { type?: unknown; features?: unknown[] };
    if (json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Parcel API bad payload");
    return {
      type: "FeatureCollection",
      features: json.features.map(normalizeApiFeature).filter((f): f is ParcelFeature => f !== null),
    };
  }
}
