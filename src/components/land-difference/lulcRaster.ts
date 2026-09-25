/**
 * Simulated land-use classification rasters (DEMO) for any state or all of India.
 *
 * Each pixel gets a score per class (proximity to cities, rivers, forest belts,
 * deserts + deterministic noise). Classes are then assigned by ranking those
 * scores until each state's share (from the scenario model) is met. Because the
 * scores never change, a scenario only flips the pixels nearest each class
 * threshold — those become the "Change detected" layer.
 *
 * Browser-only (uses canvas). Never call during SSR.
 */

import statesGeoJSON from "@/data/india-states.json";
import { LAND_CLASS_ORDER, type Flow, type LandClass, type Shares } from "@/data/land-scenario";

export const LULC_CLASSES = [
  { id: "agri", label: "Agriculture", color: "#F6C515", opacity: 0.46 },
  { id: "forest", label: "Forest", color: "#249B45", opacity: 0.48 },
  { id: "built", label: "Built-up", color: "#E53935", opacity: 0.55 },
  { id: "water", label: "Water", color: "#2878D0", opacity: 0.58 },
  { id: "barren", label: "Barren", color: "#C8B58A", opacity: 0.38 },
  { id: "other", label: "Other", color: "#92979B", opacity: 0.32 },
] as const;

// Indices match LAND_CLASS_ORDER
const [AGRI, FOREST, BUILT, WATER, BARREN, OTHER] = [0, 1, 2, 3, 4, 5] as const;
const NONE = 255;

const CLASS_RGBA = LULC_CLASSES.map(({ color, opacity }): [number, number, number, number] => [
  parseInt(color.slice(1, 3), 16),
  parseInt(color.slice(3, 5), 16),
  parseInt(color.slice(5, 7), 16),
  Math.round(opacity * 255),
]);

// Longest raster side in pixels, and the finest resolution (deg) for small states
const MAX_SIDE = 1100;
const MIN_RES = 0.004;
const BINS = 2048;

// --- Geometry helpers ------------------------------------------------------------

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latFromMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

const STATE_RINGS: Record<string, number[][][]> = Object.fromEntries(
  (statesGeoJSON as any).features.map((f: any) => [
    f.properties.name,
    f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat(1),
  ]),
);

export type Bounds = { west: number; east: number; south: number; north: number };

export function statesBounds(states: string[]): Bounds {
  const b = { west: 180, east: -180, south: 90, north: -90 };
  for (const s of states) {
    for (const ring of STATE_RINGS[s] ?? []) {
      for (const [lon = 0, lat = 0] of ring) {
        b.west = Math.min(b.west, lon);
        b.east = Math.max(b.east, lon);
        b.south = Math.min(b.south, lat);
        b.north = Math.max(b.north, lat);
      }
    }
  }
  return b;
}

export const stateRings = (state: string) => STATE_RINGS[state] ?? [];

// Outer ring of each polygon only (used for the outside-the-state mask)
const OUTER_RINGS: Record<string, number[][][]> = Object.fromEntries(
  (statesGeoJSON as any).features.map((f: any) => [
    f.properties.name,
    f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((poly: number[][][]) => poly[0]),
  ]),
);
export const stateOuterRings = (state: string) => OUTER_RINGS[state] ?? [];

// --- Deterministic noise ---------------------------------------------------------

const hash = (x: number, y: number, seed: number) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};
const fade = (t: number) => t * t * (3 - 2 * t);
const valueNoise = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = fade(x - xi), yf = fade(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
};
const fbm = (x: number, y: number, seed: number, octaves = 4) => {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += amp * valueNoise(x * freq, y * freq, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / norm;
};

// --- Geographic priors (approximate) -----------------------------------------------

// lon, lat, core radius (deg)
const CITIES: [number, number, number][] = [
  [72.88, 19.08, 0.25], [77.21, 28.61, 0.3], [77.59, 12.97, 0.22], [80.27, 13.08, 0.2], [88.36, 22.57, 0.22],
  [78.49, 17.39, 0.22], [72.57, 23.02, 0.17], [73.86, 18.52, 0.16], [72.83, 21.17, 0.13], [75.79, 26.91, 0.14],
  [80.95, 26.85, 0.13], [80.33, 26.45, 0.12], [79.09, 21.15, 0.12], [75.86, 22.72, 0.12], [77.41, 23.26, 0.11],
  [85.14, 25.59, 0.11], [73.19, 22.31, 0.1], [70.8, 22.3, 0.09], [76.96, 11.02, 0.1], [78.12, 9.93, 0.08],
  [83.3, 17.69, 0.1], [80.65, 16.51, 0.08], [76.27, 9.93, 0.1], [76.94, 8.52, 0.08], [75.78, 11.26, 0.07],
  [75.86, 30.9, 0.1], [74.87, 31.63, 0.08], [76.78, 30.73, 0.07], [77.32, 28.41, 0.1], [77.03, 28.46, 0.1],
  [77.45, 28.67, 0.1], [78.01, 27.18, 0.09], [82.99, 25.32, 0.09], [81.85, 25.44, 0.08], [77.71, 28.98, 0.07],
  [73.79, 20.0, 0.09], [75.34, 19.88, 0.08], [75.91, 17.66, 0.06], [74.24, 16.7, 0.05], [77.75, 20.93, 0.05],
  [73.02, 26.24, 0.08], [73.71, 24.58, 0.06], [75.83, 25.18, 0.06], [73.31, 28.02, 0.05],
  [79.94, 23.18, 0.07], [78.18, 26.22, 0.07], [75.12, 15.36, 0.06], [74.86, 12.91, 0.06], [76.64, 12.3, 0.07],
  [78.69, 10.8, 0.06], [79.59, 17.97, 0.05], [79.42, 13.63, 0.05], [85.82, 20.3, 0.08], [85.88, 20.46, 0.05],
  [85.33, 23.34, 0.07], [86.2, 22.8, 0.07], [86.43, 23.8, 0.06], [81.63, 21.25, 0.08], [82.14, 22.08, 0.05],
  [78.03, 30.32, 0.06], [78.16, 29.95, 0.04], [77.17, 31.1, 0.04], [91.74, 26.14, 0.08], [88.43, 26.73, 0.05],
  [87.31, 23.52, 0.05], [73.83, 15.49, 0.04], [74.8, 34.08, 0.07], [74.86, 32.73, 0.05], [93.94, 24.82, 0.04],
  [91.88, 25.58, 0.04], [92.72, 23.73, 0.04], [94.11, 25.67, 0.03], [91.28, 23.83, 0.04], [88.61, 27.33, 0.03],
  [79.81, 11.94, 0.05], [92.73, 11.62, 0.03], [73.01, 20.27, 0.04], [72.84, 20.42, 0.04], [72.64, 10.57, 0.02],
];

// Major rivers as simplified polylines
const RIVERS: [number, number][][] = [
  [[78.17, 29.95], [78.6, 29.2], [79.4, 27.9], [80.35, 26.5], [81.88, 25.43], [83.0, 25.3], [84.5, 25.6], [85.2, 25.6], [86.4, 25.3], [87.3, 25.2], [88.0, 24.5], [88.3, 23.5], [88.2, 22.2]],
  [[77.6, 30.5], [77.3, 29.6], [77.25, 28.6], [78.0, 27.2], [79.3, 26.4], [81.88, 25.43]],
  [[95.2, 27.8], [94.2, 27.3], [93.0, 26.7], [91.75, 26.2], [90.6, 26.1], [89.8, 25.9]],
  [[73.65, 19.95], [74.9, 19.7], [75.3, 19.5], [77.3, 19.05], [79.9, 18.8], [80.9, 17.6], [81.8, 16.7]],
  [[73.7, 17.95], [74.6, 16.8], [76.2, 16.4], [78.0, 16.1], [80.6, 16.5], [81.1, 15.9]],
  [[81.7, 22.7], [79.9, 23.1], [77.7, 22.6], [76.0, 22.2], [74.5, 22.0], [72.7, 21.65]],
  [[78.3, 21.8], [76.2, 21.3], [74.1, 21.5], [72.8, 21.1]],
  [[82.0, 20.3], [82.6, 21.5], [83.9, 21.2], [85.1, 20.5], [86.6, 20.3]],
  [[75.6, 12.4], [76.6, 12.3], [77.7, 12.1], [78.7, 11.0], [79.8, 11.1]],
  [[75.8, 22.5], [75.8, 24.5], [76.6, 25.8], [78.4, 26.6], [79.1, 26.5]],
  [[76.5, 31.4], [75.7, 31.2], [75.0, 31.0], [74.5, 30.9]],
  [[81.9, 22.7], [82.5, 24.5], [84.0, 24.7], [84.9, 25.6]],
  [[79.9, 21.6], [79.75, 21.0], [79.9, 20.3], [80.0, 19.6], [79.95, 18.9]],
];

// Forest belts: polyline + half-width (deg)
const FOREST_BELTS: { line: [number, number][]; width: number }[] = [
  { line: [[73.3, 21.0], [73.6, 19.0], [73.9, 16.5], [74.8, 14.0], [75.6, 12.0], [76.8, 10.0], [77.3, 8.3]], width: 0.35 }, // Western Ghats
  { line: [[78.0, 22.5], [80.5, 22.3], [82.5, 21.5], [84.0, 21.8], [85.8, 22.8]], width: 1.0 }, // Central India
  { line: [[78.7, 13.5], [80.0, 15.5], [82.0, 17.8], [83.5, 19.0]], width: 0.4 }, // Eastern Ghats
  { line: [[74.5, 33.5], [76.5, 32.3], [78.0, 30.9], [80.0, 29.7], [81.5, 28.9]], width: 0.5 }, // Himalayan forests
  { line: [[77.5, 30.3], [79.5, 29.2], [81.5, 28.2]], width: 0.3 }, // Terai / Shivalik
  { line: [[89.5, 26.6], [92.0, 27.0], [94.5, 27.6], [96.0, 28.0]], width: 0.5 }, // Eastern Himalaya
  { line: [[92.5, 25.5], [93.5, 24.0], [93.0, 22.5]], width: 0.9 }, // North-east hills
  { line: [[88.6, 22.1], [89.1, 21.7]], width: 0.35 }, // Sundarbans
  { line: [[92.7, 13.5], [92.7, 11.0], [93.0, 7.0]], width: 0.4 }, // Andaman & Nicobar
];

// Barren / desert / high-altitude: polyline + half-width (deg)
const BARREN_BELTS: { line: [number, number][]; width: number }[] = [
  { line: [[70.0, 28.5], [71.5, 27.0], [72.5, 25.5]], width: 1.6 }, // Thar
  { line: [[69.0, 23.9], [70.5, 23.8], [71.5, 23.5]], width: 0.5 }, // Rann of Kutch
  { line: [[75.5, 34.8], [77.5, 34.2], [78.5, 33.0], [79.2, 31.5], [80.5, 30.6]], width: 0.8 }, // Trans-Himalaya
  { line: [[88.0, 27.9], [88.8, 27.8]], width: 0.2 }, // High Sikkim
  { line: [[75.0, 19.0], [76.5, 18.0], [77.5, 17.0]], width: 0.9 }, // Deccan scrub
];

const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const ex = px - ax - t * dx, ey = py - ay - t * dy;
  return Math.sqrt(ex * ex + ey * ey);
};

type Segment = [number, number, number, number, number]; // ax, ay, bx, by, width

const toSegments = (lines: { line: [number, number][]; width: number }[], b: Bounds): Segment[] => {
  const out: Segment[] = [];
  for (const { line, width } of lines) {
    for (let k = 1; k < line.length; k++) {
      const [ax, ay] = line[k - 1]!, [bx, by] = line[k]!;
      const m = width * 2.5;
      if (Math.max(ax, bx) + m < b.west || Math.min(ax, bx) - m > b.east || Math.max(ay, by) + m < b.south || Math.min(ay, by) - m > b.north) continue;
      out.push([ax, ay, bx, by, width]);
    }
  }
  return out;
};

// Gaussian influence of the nearest segment
const beltInfluence = (lon: number, lat: number, segs: Segment[]) => {
  let best = 0;
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k]!;
    const w = s[4];
    if (lon < Math.min(s[0], s[2]) - 2.5 * w || lon > Math.max(s[0], s[2]) + 2.5 * w || lat < Math.min(s[1], s[3]) - 2.5 * w || lat > Math.max(s[1], s[3]) + 2.5 * w) continue;
    const d = segDist(lon, lat, s[0], s[1], s[2], s[3]) / w;
    best = Math.max(best, Math.exp(-d * d));
  }
  return best;
};

// --- Fields (year- and scenario-independent) -------------------------------------

interface Fields {
  states: string[];
  bounds: Bounds;
  w: number;
  h: number;
  /** 0 = outside, otherwise index into `states` + 1 */
  ids: Uint8Array;
  /** inside-pixel count per state */
  counts: Uint32Array;
  /** binned scores 0..BINS-1 per class pass */
  water: Uint16Array;
  urban: Uint16Array;
  forest: Uint16Array;
  barren: Uint16Array;
  other: Uint16Array;
  /** smooth fields deciding where scenario conversions into agriculture / other / barren land cluster */
  agriPressure: Uint16Array;
  otherPressure: Uint16Array;
  barrenPressure: Uint16Array;
  /** per-pixel opacity multiplier for texture */
  alpha: Float32Array;
  /** km² per pixel, per row */
  rowKm2: Float32Array;
}

const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

// Time-sliced yielding: keep each main-thread task under ~24 ms
let sliceStart = 0;
const maybeYield = async () => {
  if (performance.now() - sliceStart < 24) return;
  await yieldToBrowser();
  sliceStart = performance.now();
};

// Segments whose influence band overlaps a latitude (cheap per-row pre-filter)
const segmentsNearLat = (segs: Segment[], lat: number) =>
  segs.filter((sg) => lat >= Math.min(sg[1], sg[3]) - 2.5 * sg[4] && lat <= Math.max(sg[1], sg[3]) + 2.5 * sg[4]);

async function buildFields(states: string[]): Promise<Fields> {
  const bounds = statesBounds(states);
  const pad = 0.05;
  const b = { west: bounds.west - pad, east: bounds.east + pad, south: bounds.south - pad, north: bounds.north + pad };
  const y0 = mercY(b.north), y1 = mercY(b.south);
  const spanX = ((b.east - b.west) * Math.PI) / 180;
  const spanY = y0 - y1;
  // Pixel size chosen so the longest side is ≤ MAX_SIDE, but never finer than MIN_RES
  const pxPerRad = Math.min(MAX_SIDE / Math.max(spanX, spanY), 180 / Math.PI / MIN_RES);
  const w = Math.max(8, Math.round(spanX * pxPerRad));
  const h = Math.max(8, Math.round(spanY * pxPerRad));
  const n = w * h;
  const res = (b.east - b.west) / w;

  // Rasterise each state into the id map (bbox-limited reads keep this cheap)
  const ids = new Uint8Array(n);
  const counts = new Uint32Array(states.length);
  const toX = (lon: number) => ((lon - b.west) / (b.east - b.west)) * w;
  const toY = (lat: number) => ((y0 - mercY(lat)) / spanY) * h;
  for (let s = 0; s < states.length; s++) {
    await maybeYield();
    const sb = statesBounds([states[s]!]);
    const x0 = Math.max(0, Math.floor(toX(sb.west)) - 1), x1 = Math.min(w, Math.ceil(toX(sb.east)) + 1);
    const yA = Math.max(0, Math.floor(toY(sb.north)) - 1), yB = Math.min(h, Math.ceil(toY(sb.south)) + 1);
    const cw = x1 - x0, ch = yB - yA;
    if (cw <= 0 || ch <= 0) continue;
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.beginPath();
    for (const ring of stateRings(states[s]!)) {
      ring.forEach(([lon = 0, lat = 0], k) => {
        const px = toX(lon) - x0, py = toY(lat) - yA;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
    ctx.fillStyle = "#fff";
    ctx.fill("evenodd");
    const data = ctx.getImageData(0, 0, cw, ch).data;
    for (let yy = 0; yy < ch; yy++) {
      for (let xx = 0; xx < cw; xx++) {
        if (data[(yy * cw + xx) * 4 + 3]! < 128) continue;
        const i = (yA + yy) * w + (x0 + xx);
        if (ids[i] === 0) {
          ids[i] = s + 1;
          counts[s]!++;
        }
      }
    }
  }

  const cities = CITIES.filter(([lon, lat, r]) => lon > b.west - 4 * r && lon < b.east + 4 * r && lat > b.south - 4 * r && lat < b.north + 4 * r);
  const rivers = toSegments(RIVERS.map((line) => ({ line, width: 0.03 })), b);
  const forests = toSegments(FOREST_BELTS, b);
  const barrens = toSegments(BARREN_BELTS, b);

  const raw = {
    water: new Float32Array(n), urban: new Float32Array(n), forest: new Float32Array(n), barren: new Float32Array(n), other: new Float32Array(n),
    agriPressure: new Float32Array(n), otherPressure: new Float32Array(n), barrenPressure: new Float32Array(n),
  };
  const alpha = new Float32Array(n);
  const rowKm2 = new Float32Array(h);
  const fine = res < 0.01 ? 1 : 0; // skip the finest octave at coarse (national) resolution

  sliceStart = performance.now();
  for (let r = 0; r < h; r++) {
    await maybeYield();
    const latTop = latFromMercY(y0 - (spanY * r) / h), latBottom = latFromMercY(y0 - (spanY * (r + 1)) / h);
    const lat = (latTop + latBottom) / 2;
    const rowRivers = segmentsNearLat(rivers, lat), rowForests = segmentsNearLat(forests, lat), rowBarrens = segmentsNearLat(barrens, lat);
    rowKm2[r] = res * 111.32 * Math.cos((lat * Math.PI) / 180) * (latTop - latBottom) * 110.57;
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (ids[i] === 0) continue;
      const lon = b.west + (c + 0.5) * res;

      let urban = 0;
      for (let k = 0; k < cities.length; k++) {
        const city = cities[k]!;
        const dx = (lon - city[0]) / city[2], dy = (lat - city[1]) / city[2];
        const d2 = dx * dx + dy * dy;
        if (d2 < 16) urban = Math.max(urban, Math.exp(-d2 * 0.5));
      }
      raw.urban[i] = urban * 0.8 + 0.2 * fbm(lon * 14, lat * 14, 5, 3);

      const lake = fbm(lon * 7, lat * 7, 21, 3);
      raw.water[i] = Math.max(0.95 * beltInfluence(lon, lat, rowRivers), lake * lake * 0.9);

      raw.forest[i] = 0.55 * fbm(lon * 4, lat * 4, 1, 3) + 0.45 * beltInfluence(lon, lat, rowForests) + 0.12 * fbm(lon * 22, lat * 22, 11, 1 + fine);
      raw.barren[i] = 0.55 * fbm(lon * 6, lat * 6, 4, 3) + 0.5 * beltInfluence(lon, lat, rowBarrens) + 0.12 * fbm(lon * 20, lat * 20, 13, 1 + fine);
      raw.other[i] = 0.75 * fbm(lon * 10, lat * 10, 6, 3) + 0.25 * hash(Math.floor(lon * 50), Math.floor(lat * 50), 9);
      raw.agriPressure[i] = fbm(lon * 3, lat * 3, 31, 2);
      raw.otherPressure[i] = fbm(lon * 3.5, lat * 3.5, 32, 2);
      raw.barrenPressure[i] = fbm(lon * 3.5, lat * 3.5, 33, 2);
      // Slight per-pixel opacity variation so the tint reads as texture, not a flat fill
      alpha[i] = 0.8 + 0.35 * valueNoise(lon * 45, lat * 45, 10);
    }
  }

  const bin = (field: Float32Array) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      if (ids[i] === 0) continue;
      const v = field[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const scale = hi > lo ? (BINS - 1) / (hi - lo) : 0;
    const out = new Uint16Array(n);
    for (let i = 0; i < n; i++) if (ids[i] !== 0) out[i] = Math.round((field[i]! - lo) * scale);
    return out;
  };

  return {
    states,
    bounds: b,
    w,
    h,
    ids,
    counts,
    water: bin(raw.water),
    urban: bin(raw.urban),
    forest: bin(raw.forest),
    barren: bin(raw.barren),
    other: bin(raw.other),
    agriPressure: bin(raw.agriPressure),
    otherPressure: bin(raw.otherPressure),
    barrenPressure: bin(raw.barrenPressure),
    alpha,
    rowKm2,
  };
}

// --- Classification ------------------------------------------------------------

/** Assigns classes so each state's pixel shares match `shares` (aligned with fields.states). */
async function classify(f: Fields, shares: Shares[]): Promise<Uint8Array> {
  const n = f.w * f.h;
  const S = f.states.length;
  const cls = new Uint8Array(n).fill(NONE);
  const passes: [number, keyof Shares, Uint16Array][] = [
    [WATER, "water", f.water],
    [BUILT, "built", f.urban],
    [FOREST, "forest", f.forest],
    [BARREN, "barren", f.barren],
    [OTHER, "other", f.other],
  ];
  const hist = new Uint32Array(S * BINS);
  const thresholds = new Int32Array(S);
  sliceStart = performance.now();
  for (const [klass, key, score] of passes) {
    await maybeYield();
    hist.fill(0);
    for (let i = 0; i < n; i++) {
      const id = f.ids[i]!;
      if (id !== 0 && cls[i] === NONE) hist[(id - 1) * BINS + score[i]!]!++;
    }
    for (let s = 0; s < S; s++) {
      const target = Math.round(((shares[s]?.[key] ?? 0) / 100) * f.counts[s]!);
      let acc = 0, t = BINS;
      while (t > 0 && acc < target) acc += hist[s * BINS + --t]!;
      thresholds[s] = target > 0 ? t : BINS;
    }
    for (let i = 0; i < n; i++) {
      const id = f.ids[i]!;
      if (id !== 0 && cls[i] === NONE && score[i]! >= thresholds[id - 1]!) cls[i] = klass;
    }
  }
  for (let i = 0; i < n; i++) if (f.ids[i] !== 0 && cls[i] === NONE) cls[i] = AGRI;
  return cls;
}

const classIndex = (c: LandClass) => LAND_CLASS_ORDER.indexOf(c);

/**
 * Replays the scenario's class-to-class conversions on the baseline map. For each
 * conversion, the pixels picked are those where the destination is most likely
 * (a smooth "pressure" field) and the source class is weakest — so changes form
 * coherent patches: suburbs around cities, clearings at forest margins, and so on.
 */
async function applyFlows(f: Fields, base: Uint8Array, flowsByState: Flow[][]): Promise<Uint8Array> {
  const n = f.w * f.h;
  const S = f.states.length;
  const cls = base.slice();
  const changed = new Uint8Array(n);
  const sourceScore: Partial<Record<LandClass, Uint16Array>> = { water: f.water, built: f.urban, forest: f.forest, barren: f.barren, other: f.other };
  const pressure: Record<LandClass, Uint16Array> = {
    agri: f.agriPressure, built: f.urban, water: f.water, forest: f.forest, barren: f.barrenPressure, other: f.otherPressure,
  };

  // Every distinct conversion, in the order the model applied them
  const pairs: [LandClass, LandClass][] = [];
  for (const flows of flowsByState) {
    for (const { from, to } of flows) if (!pairs.some(([a, b]) => a === from && b === to)) pairs.push([from, to]);
  }

  const hist = new Uint32Array(S * BINS);
  const thresholds = new Int32Array(S);
  const value = (i: number, from: LandClass, to: LandClass) => {
    const src = sourceScore[from];
    // 60% destination pressure + 40% weakness of the source class
    return Math.round(0.6 * pressure[to][i]! + 0.4 * (src ? BINS - 1 - src[i]! : BINS / 2));
  };

  sliceStart = performance.now();
  for (const [from, to] of pairs) {
    await maybeYield();
    const fromIdx = classIndex(from), toIdx = classIndex(to);
    hist.fill(0);
    for (let i = 0; i < n; i++) {
      const id = f.ids[i]!;
      if (id !== 0 && cls[i] === fromIdx && !changed[i]) hist[(id - 1) * BINS + value(i, from, to)]!++;
    }
    for (let s = 0; s < S; s++) {
      const pp = flowsByState[s]?.find((fl) => fl.from === from && fl.to === to)?.pp ?? 0;
      const target = Math.round((pp / 100) * f.counts[s]!);
      let acc = 0, t = BINS;
      while (t > 0 && acc < target) acc += hist[s * BINS + --t]!;
      thresholds[s] = target > 0 ? t : BINS;
    }
    for (let i = 0; i < n; i++) {
      const id = f.ids[i]!;
      if (id !== 0 && cls[i] === fromIdx && !changed[i] && value(i, from, to) >= thresholds[id - 1]!) {
        cls[i] = toIdx;
        changed[i] = 1;
      }
    }
    await maybeYield();
  }
  return cls;
}

// PNG encoding happens off the main thread with toBlob; the object URL is handed to MapLibre
function toObjectUrl(f: Fields, paint: (img: Uint8ClampedArray) => void): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = f.w;
  canvas.height = f.h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(f.w, f.h);
  paint(img.data);
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("PNG encoding failed"))), "image/png"),
  );
}

function paintBase(f: Fields, cls: Uint8Array, visible?: boolean[]) {
  return toObjectUrl(f, (data) => {
    for (let i = 0; i < cls.length; i++) {
      const k = cls[i]!;
      if (k === NONE || (visible && !visible[k])) continue;
      const rgba = CLASS_RGBA[k]!;
      const p = i * 4;
      data[p] = rgba[0];
      data[p + 1] = rgba[1];
      data[p + 2] = rgba[2];
      data[p + 3] = Math.min(255, rgba[3] * f.alpha[i]!);
    }
  });
}

// Changed pixels in their new class colour (near-opaque) with a light rim around each patch
async function paintChange(f: Fields, before: Uint8Array, after: Uint8Array): Promise<{ url: string; km2: number }> {
  const { w, h } = f;
  let km2 = 0;
  const changed = (i: number) => before[i] !== after[i];
  const url = await toObjectUrl(f, (data) => {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (!changed(i)) continue;
        km2 += f.rowKm2[r]!;
        const edge = (c > 0 && !changed(i - 1)) || (c < w - 1 && !changed(i + 1)) || (r > 0 && !changed(i - w)) || (r < h - 1 && !changed(i + w));
        const rgba = edge ? ([255, 255, 255, 215] as const) : CLASS_RGBA[after[i]!]!;
        const p = i * 4;
        data[p] = rgba[0];
        data[p + 1] = rgba[1];
        data[p + 2] = rgba[2];
        data[p + 3] = edge ? 215 : 235;
      }
    }
  });
  return { url, km2 };
}

// --- Public API with caching ------------------------------------------------------

const fieldsCache = new Map<string, Promise<Fields>>();
const baseCache = new Map<string, Promise<{ cls: Uint8Array; url: string }>>();

const remember = <T>(cache: Map<string, T>, key: string, make: () => T, limit: number, evict?: (v: T) => void): T => {
  let v = cache.get(key);
  if (v === undefined) {
    v = make();
    cache.set(key, v);
    if (cache.size > limit) {
      const oldest = cache.keys().next().value!;
      evict?.(cache.get(oldest)!);
      cache.delete(oldest);
    }
  }
  return v;
};

export type RasterCoords = [[number, number], [number, number], [number, number], [number, number]];

export interface RegionRaster {
  coordinates: RasterCoords;
  baseUrl: string;
  /** Object URL owned by the caller — revoke it once replaced */
  changeUrl: string | null;
  changedKm2: number;
}

/**
 * @param states       states in the region
 * @param baseKey      cache key identifying `baseShares` (e.g. the year)
 * @param baseShares   observed shares per state, aligned with `states`
 * @param flowsByState scenario conversions per state, or null for no scenario
 * @param visible      optional per-class visibility (indexed like LULC_CLASSES) for the base layer
 */
export async function renderRegion(states: string[], baseKey: string, baseShares: Shares[], flowsByState: Flow[][] | null, visible?: boolean[]): Promise<RegionRaster> {
  const fields = await remember(fieldsCache, states.join("|"), () => buildFields(states), 4);
  const base = await remember(
    baseCache,
    `${states.join("|")}#${baseKey}${visible ? `#${visible.map(Number).join("")}` : ""}`,
    async () => {
      const cls = await classify(fields, baseShares);
      return { cls, url: await paintBase(fields, cls, visible) };
    },
    8,
    (evicted) => evicted.then((b) => URL.revokeObjectURL(b.url)),
  );
  const { west, east, south, north } = fields.bounds;
  const coordinates: RasterCoords = [[west, north], [east, north], [east, south], [west, south]];
  if (!flowsByState) return { coordinates, baseUrl: base.url, changeUrl: null, changedKm2: 0 };
  const change = await paintChange(fields, base.cls, await applyFlows(fields, base.cls, flowsByState));
  return { coordinates, baseUrl: base.url, changeUrl: change.url, changedKm2: change.km2 };
}

// Keeps LAND_CLASS_ORDER and the raster class indices in lockstep
if (LAND_CLASS_ORDER.join() !== LULC_CLASSES.map((c) => c.id).join()) {
  throw new Error("LULC_CLASSES must follow LAND_CLASS_ORDER");
}
