import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Columns3,
  Gavel,
  Loader2,
  Play,
  Square,
} from "lucide-react";
import {
  BASELINE,
  C,
  DISTRIBUTIONAL,
  OUTCOMES,
  SCENARIOS,
  SHAP,
  SIM_BANNER,
  SIM_STEPS,
  STUDY_BOUNDS,
  VETO,
  VILLAGES,
  type ScenarioId,
} from "./data";
import { Chip, fmt, Panel, Prov, useCountUp } from "./ui";

maplibregl.config.WORKER_URL = mapWorkerUrl;

// ---------------------------------------------------------------------------
// Synthetic model surface (stand-in for the XGBoost output; trained labels are
// the real 2019→2024 LULC transitions in the production pipeline)
// ---------------------------------------------------------------------------

type Pt = [number, number];
const CENTER: Pt = [73.856, 18.52];
const HIGHWAYS: [Pt, Pt][] = [
  [
    [73.6, 18.75],
    [73.82, 18.6],
  ], // Mumbai–Pune expressway
  [
    [73.86, 18.53],
    [73.88, 18.86],
  ], // Pune–Nashik
  [
    [73.87, 18.51],
    [74.12, 18.46],
  ], // Pune–Solapur
  [
    [73.9, 18.55],
    [74.12, 18.69],
  ], // Pune–Ahmednagar
];
const segDist = (p: Pt, [a, b]: [Pt, Pt]) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

type Hex = { id: number; c: Pt; ring: Pt[]; p: number; hwy: number; core: number };

const HEXES: Hex[] = (() => {
  const out: Hex[] = [];
  const r = 0.0145;
  const w = Math.sqrt(3) * r;
  const h = 1.5 * r * 0.95;
  let id = 0;
  for (let row = 0, y = 18.45; y < 18.86; row++, y += h) {
    for (let x = 73.62 + (row % 2 ? w / 2 : 0); x < 74.12; x += w) {
      const c: Pt = [x, y];
      const core = Math.hypot(x - CENTER[0], (y - CENTER[1]) * 1.1);
      if (core < 0.045) continue; // the existing city core is already built
      const hwy = Math.min(...HIGHWAYS.map((s) => segDist(c, s)));
      const noise = 0.08 * Math.sin(x * 211 + y * 97) * Math.cos(x * 53 - y * 131);
      const p = Math.max(
        0.02,
        Math.min(
          0.97,
          0.82 * Math.exp(-core / 0.13) + 0.42 * Math.exp(-hwy / 0.025) + noise - 0.06,
        ),
      );
      const ring: Pt[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        ring.push([x + r * Math.cos(a), y + r * 0.95 * Math.sin(a)]);
      }
      ring.push(ring[0]!);
      out.push({ id: id++, c, ring, p, hwy, core });
    }
  }
  return out;
})();

/** Vetoed parcels (clustered display of the 312) with the legal reason. */
const VETO_ZONES: { reason: string; at: Pt; n: number }[] = [
  { reason: "Tribal land (73AA)", at: [73.68, 18.74], n: 9 },
  { reason: "ESZ", at: [73.655, 18.5], n: 8 },
  { reason: "Tenancy restriction", at: [74.03, 18.6], n: 8 },
];
const VETO_PARCELS = VETO_ZONES.flatMap((z, zi) =>
  Array.from({ length: z.n }, (_, i) => {
    const a = i * 2.4 + zi;
    const d = 0.006 + (i % 4) * 0.0055;
    const x = z.at[0] + Math.cos(a) * d * 1.2;
    const y = z.at[1] + Math.sin(a) * d;
    const s = 0.0036 + ((i * 7) % 3) * 0.0008;
    return {
      type: "Feature" as const,
      properties: { reason: z.reason },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [x - s, y - s * 0.8],
            [x + s, y - s * 0.9],
            [x + s * 1.1, y + s * 0.8],
            [x - s * 0.9, y + s],
            [x - s, y - s * 0.8],
          ],
        ],
      },
    };
  }),
);
const VETO_LABELS = VETO_ZONES.map((z) => ({
  type: "Feature" as const,
  properties: { label: `Vetoed · ${z.reason}` },
  geometry: { type: "Point" as const, coordinates: [z.at[0], z.at[1] + 0.027] },
}));

/** Reference cell (highest probability near Hinjewadi) — carries the sheet SHAP values. */
const REF_HEX =
  HEXES.filter((h) => Math.hypot(h.c[0] - 73.73, h.c[1] - 18.59) < 0.05).sort(
    (a, b) => b.p - a.p,
  )[0]?.id ?? 0;

type Levers = { cap: number; buffer: number; coverage: number; horizon: 5 | 10 };
const DEFAULTS: Levers = { cap: 20, buffer: 200, coverage: 80, horizon: 5 };

/** Scenario multiplier on conversion probability. */
function factor(s: ScenarioId, l: Levers) {
  const h = l.horizon === 10 ? 1.35 : 1;
  if (s === "S1") return (0.55 + l.cap / 100) * h;
  if (s === "S2") return (0.95 - (l.coverage - 40) / 800) * h;
  return 0.97 * h;
}
const hexP = (hx: Hex, s: ScenarioId, l: Levers, bufferCut: boolean) =>
  Math.min(
    0.98,
    hx.p *
      factor(s, l) *
      (bufferCut && hx.hwy > 0.07 && hx.core > 0.2 ? Math.max(0.55, 1 - l.buffer / 900) : 1),
  );

function hexGeo(s: ScenarioId, l: Levers) {
  return {
    type: "FeatureCollection" as const,
    features: HEXES.map((hx) => ({
      type: "Feature" as const,
      properties: { id: hx.id, p: Number(hexP(hx, s, l, true).toFixed(3)) },
      geometry: { type: "Polygon" as const, coordinates: [hx.ring] },
    })),
  };
}

/** Outcomes: exact consistency-sheet values at the default levers, scaled by lever changes. */
function outcomes(s: ScenarioId, l: Levers) {
  const o = OUTCOMES[s];
  const h = l.horizon === 10 ? 1.6 : 1;
  const capShift = s === "S1" ? (DEFAULTS.cap - l.cap) * 55 : 0;
  const bufShift = (l.buffer - DEFAULTS.buffer) * 1.4;
  const covShift = s === "S2" ? (l.coverage - DEFAULTS.coverage) * 6 : 0;
  const d = (base: number, v: number) => base + (v - base) * h;
  return {
    agri: [d(BASELINE.agri, o.agri[0] + capShift), o.agri[1]] as const,
    dev: [d(BASELINE.dev, o.dev[0] - capShift), o.dev[1]] as const,
    flood: [d(BASELINE.flood, o.flood[0] - bufShift), o.flood[1]] as const,
    disputes: o.disputes
      ? ([d(BASELINE.disputes, o.disputes[0] - covShift), o.disputes[1]] as const)
      : null,
    veto: Math.round(VETO.count * (l.horizon === 10 ? 1.4 : 1)),
    dist: DISTRIBUTIONAL.map((x) => ({
      ...x,
      value: Math.round(
        x.value * (s === "S1" ? 1 : s === "S2" ? 0.4 : 0.25) * (l.horizon === 10 ? 1.5 : 1),
      ),
    })),
    isDefault:
      l.cap === DEFAULTS.cap &&
      l.buffer === DEFAULTS.buffer &&
      l.coverage === DEFAULTS.coverage &&
      l.horizon === DEFAULTS.horizon,
  };
}

// ---------------------------------------------------------------------------

function Num({ v, suffix = "" }: { v: number; suffix?: string }) {
  const x = useCountUp(v, 650);
  return (
    <>
      {fmt(x)}
      {suffix}
    </>
  );
}

function hatchImage() {
  const size = 10;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  g.fillStyle = "rgba(192,57,43,0.28)";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "#c0392b";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, size);
  g.lineTo(size, 0);
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

const PCOLOR: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "p"],
  0,
  "#fbf4df",
  0.12,
  "#f6d58c",
  0.26,
  "#efa451",
  0.4,
  "#df6d35",
  0.56,
  "#b53b25",
  0.8,
  "#6e1a14",
];

/** Small SVG render of one scenario's surface for side-by-side compare. */
function MiniSurface({ s, l }: { s: ScenarioId; l: Levers }) {
  const [[w0, s0], [e0, n0]] = STUDY_BOUNDS;
  const X = (x: number) => ((x - w0) / (e0 - w0)) * 300;
  const Y = (y: number) => (1 - (y - s0) / (n0 - s0)) * 250;
  const col = (p: number) => {
    const stops = ["#fbf4df", "#f6d58c", "#efa451", "#df6d35", "#b53b25", "#6e1a14"];
    return stops[p < 0.12 ? 0 : p < 0.26 ? 1 : p < 0.4 ? 2 : p < 0.56 ? 3 : p < 0.8 ? 4 : 5]!;
  };
  const mean = HEXES.reduce((a, h) => a + hexP(h, s, l, true), 0) / HEXES.length;
  return (
    <figure className="wf-mini-surface">
      <svg viewBox="0 0 300 250">
        {HEXES.map((h) => (
          <polygon
            key={h.id}
            points={h.ring.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ")}
            fill={col(hexP(h, s, l, true))}
            stroke="#fff"
            strokeWidth="0.4"
          />
        ))}
      </svg>
      <figcaption>
        <b>{s}</b> {SCENARIOS.find((x) => x.id === s)!.title}
        <span>mean p = {mean.toFixed(2)}</span>
      </figcaption>
    </figure>
  );
}

export function SimulateScreen({ head, onNext }: { head: ReactNode; onNext: () => void }) {
  const [scenario, setScenario] = useState<ScenarioId>("S1");
  const [levers, setLevers] = useState<Levers>(DEFAULTS);
  const [applied, setApplied] = useState<{ s: ScenarioId; l: Levers }>({ s: "S1", l: DEFAULTS });
  const [running, setRunning] = useState(-1);
  const [compare, setCompare] = useState(false);
  const [hexId, setHexId] = useState<number>(REF_HEX);

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const stale = scenario !== applied.s || JSON.stringify(levers) !== JSON.stringify(applied.l);
  const res = useMemo(() => outcomes(applied.s, applied.l), [applied]);

  useEffect(() => {
    if (!mapEl.current) return;
    const m = new maplibregl.Map({
      container: mapEl.current,
      bounds: STUDY_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      attributionControl: false,
      style: {
        version: 8,
        glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
        sources: {
          img: {
            type: "raster",
            tiles: [
              "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
            ],
            tileSize: 256,
          },
          hex: { type: "geojson", data: hexGeo("S1", DEFAULTS) as never },
          veto: {
            type: "geojson",
            data: { type: "FeatureCollection", features: VETO_PARCELS } as never,
          },
          vetoLbl: {
            type: "geojson",
            data: { type: "FeatureCollection", features: VETO_LABELS } as never,
          },
          sel: { type: "geojson", data: { type: "FeatureCollection", features: [] } as never },
          vil: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: VILLAGES.map((v) => ({
                type: "Feature",
                properties: { name: v.name },
                geometry: { type: "Point", coordinates: [v.lon, v.lat] },
              })),
            } as never,
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#efeee6" } },
          {
            id: "img",
            type: "raster",
            source: "img",
            paint: { "raster-saturation": -0.85, "raster-opacity": 0.55, "raster-contrast": -0.1 },
          },
          {
            id: "hex",
            type: "fill",
            source: "hex",
            paint: {
              "fill-color": PCOLOR,
              "fill-opacity": 0.86,
              "fill-color-transition": { duration: 600 },
            },
          },
          {
            id: "hex-line",
            type: "line",
            source: "hex",
            paint: { "line-color": "rgba(255,255,255,0.7)", "line-width": 0.5 },
          },
          { id: "veto", type: "fill", source: "veto", paint: { "fill-pattern": "hatch" } },
          {
            id: "veto-line",
            type: "line",
            source: "veto",
            paint: { "line-color": C.red, "line-width": 1.4 },
          },
          {
            id: "veto-lbl",
            type: "symbol",
            source: "vetoLbl",
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Medium"],
              "text-size": 11,
            },
            paint: { "text-color": "#8e2418", "text-halo-color": "#fff", "text-halo-width": 1.8 },
          },
          {
            id: "sel",
            type: "line",
            source: "sel",
            paint: { "line-color": C.ink, "line-width": 2.6 },
          },
          {
            id: "vil-dot",
            type: "circle",
            source: "vil",
            paint: {
              "circle-radius": 3,
              "circle-color": "#fff",
              "circle-stroke-color": C.ink,
              "circle-stroke-width": 1.4,
            },
          },
          {
            id: "vil",
            type: "symbol",
            source: "vil",
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Medium"],
              "text-size": 11,
              "text-offset": [0, 0.9],
              "text-anchor": "top",
            },
            paint: {
              "text-color": C.ink,
              "text-halo-color": "rgba(255,255,255,0.92)",
              "text-halo-width": 1.6,
            },
          },
        ],
      },
    });
    m.on("styleimagemissing", (e) => {
      if (e.id === "hatch" && !m.hasImage("hatch")) m.addImage("hatch", hatchImage());
    });
    m.on("click", "hex", (e) => {
      const id = e.features?.[0]?.properties?.["id"];
      if (typeof id === "number") setHexId(id);
    });
    m.on("mouseenter", "hex", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "hex", () => (m.getCanvas().style.cursor = ""));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // recolour after a run
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const run = () =>
      (m.getSource("hex") as maplibregl.GeoJSONSource | undefined)?.setData(
        hexGeo(applied.s, applied.l) as never,
      );
    if (m.isStyleLoaded()) run();
    else m.once("load", run);
  }, [applied]);

  // selected hex outline
  useEffect(() => {
    const m = map.current;
    const hx = HEXES.find((h) => h.id === hexId);
    if (!m || !hx) return;
    const run = () =>
      (m.getSource("sel") as maplibregl.GeoJSONSource | undefined)?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [hx.ring] },
      } as never);
    if (m.isStyleLoaded()) run();
    else m.once("load", run);
  }, [hexId]);

  useEffect(() => {
    if (!compare) map.current?.resize();
  }, [compare]);

  const runSim = () => {
    if (running >= 0) return;
    setRunning(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      if (i >= SIM_STEPS.length) {
        window.clearInterval(t);
        setApplied({ s: scenario, l: levers });
        setRunning(-1);
      } else setRunning(i);
    }, 560);
  };

  const hx = HEXES.find((h) => h.id === hexId) ?? HEXES[0]!;
  const hp = hexP(hx, applied.s, applied.l, true);
  // SHAP for the selected cell — the reference cell shows the published values
  const shapRows =
    hexId === REF_HEX
      ? SHAP
      : SHAP.map((f, i) => ({
          ...f,
          value: Number(
            (
              f.value *
              (0.75 + 0.5 * hx.p) *
              (i === 0 ? Math.exp(-hx.hwy / 0.06) + 0.4 : 1)
            ).toFixed(2),
          ),
        }));
  const maxShap = Math.max(...shapRows.map((s) => Math.abs(s.value)), 0.22);
  const maxDist = 16;

  const set = <K extends keyof Levers>(k: K, v: Levers[K]) => setLevers((l) => ({ ...l, [k]: v }));

  return (
    <div className="wf-screen">
      {head}
      <div className="wf-sim">
        {/* ---------------- Controls ---------------- */}
        <Panel className="wf-controls" eyebrow="Policy sandbox" title="Choose a lever">
          <div className="wf-scen">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={scenario === s.id ? "on" : ""}
                onClick={() => setScenario(s.id)}
              >
                <span className="id">{s.id}</span>
                <span>
                  <b>{s.title}</b>
                  <small>{s.lever}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="wf-levers">
            <label className={scenario !== "S1" ? "dim" : ""}>
              <span>
                Conversion cap <b>{levers.cap}% of baseline</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={levers.cap}
                onChange={(e) => set("cap", Number(e.target.value))}
                style={{ ["--p" as string]: `${levers.cap}%` }}
              />
            </label>
            <label>
              <span>
                Flood buffer <b>{levers.buffer} m</b>
              </span>
              <input
                type="range"
                min={0}
                max={500}
                step={25}
                value={levers.buffer}
                onChange={(e) => set("buffer", Number(e.target.value))}
                style={{ ["--p" as string]: `${levers.buffer / 5}%` }}
              />
            </label>
            <label className={scenario !== "S2" ? "dim" : ""}>
              <span>
                Resurvey coverage <b>40% → {levers.coverage}%</b>
              </span>
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={levers.coverage}
                onChange={(e) => set("coverage", Number(e.target.value))}
                style={{ ["--p" as string]: `${((levers.coverage - 40) / 60) * 100}%` }}
              />
            </label>
            <div className="wf-horizon">
              <span>Time horizon</span>
              <div className="wf-seg sm">
                {([5, 10] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={levers.horizon === h ? "on" : ""}
                    onClick={() => set("horizon", h)}
                  >
                    {h} yrs
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`wf-btn primary block ${stale ? "pulse" : ""}`}
            onClick={runSim}
            disabled={running >= 0}
          >
            {running >= 0 ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
            {running >= 0 ? "Simulating…" : stale ? "Run simulation" : "Re-run simulation"}
          </button>
          <ol className="wf-simsteps">
            {SIM_STEPS.map((s, i) => {
              const st =
                running < 0
                  ? stale
                    ? "wait"
                    : "done"
                  : i < running
                    ? "done"
                    : i === running
                      ? "run"
                      : "wait";
              return (
                <li key={s} className={st}>
                  <span>
                    {st === "done" ? (
                      <Check size={11} strokeWidth={3} />
                    ) : st === "run" ? (
                      <Loader2 size={11} className="spin" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {s}
                </li>
              );
            })}
          </ol>
          <div className="wf-banner amber small">
            <AlertTriangle size={14} />
            {SIM_BANNER}
          </div>
        </Panel>

        {/* ---------------- Map ---------------- */}
        <div className="wf-simmap">
          <div
            ref={mapEl}
            className="wf-map-layer"
            style={{ visibility: compare ? "hidden" : "visible" }}
          />
          {compare && (
            <div className="wf-compare">
              {SCENARIOS.map((s) => (
                <MiniSurface key={s.id} s={s.id} l={applied.l} />
              ))}
            </div>
          )}
          <div className="wf-map-top">
            <div className="wf-maptitle">
              <b>Conversion probability · {applied.s}</b>
              <small>
                Agriculture → built-up within {applied.l.horizon} years · XGBoost, trained on real
                2019→2024 LULC transitions
              </small>
            </div>
            <div className="wf-seg dark">
              <button
                type="button"
                className={!compare ? "on" : ""}
                onClick={() => setCompare(false)}
              >
                <Square size={12} /> {applied.s}
              </button>
              <button
                type="button"
                className={compare ? "on" : ""}
                onClick={() => setCompare(true)}
              >
                <Columns3 size={13} /> S1 · S2 · S3
              </button>
            </div>
          </div>
          {running >= 0 && (
            <div className="wf-simoverlay">
              <Loader2 size={22} className="spin" />
              <b>{SIM_STEPS[running]}…</b>
              <span>
                step {running + 1} of {SIM_STEPS.length}
              </span>
            </div>
          )}
          <div className="wf-legend">
            <b>Conversion probability</b>
            <div className="wf-legend-grad heat" />
            <div className="wf-legend-scale">
              <span>0</span>
              <span>0.5</span>
              <span>1</span>
            </div>
            <span className="wf-legend-veto">
              <i /> Vetoed by legal engine
            </span>
          </div>
          <div className="wf-veto">
            <span className="ico">
              <Gavel size={16} />
            </span>
            <div>
              <span className="wf-eyebrow">Rules-as-code</span>
              <b>
                Legal engine vetoed <Num v={res.veto} /> parcels
              </b>
              <div className="wf-veto-tags">
                {VETO.reasons.map((r) => (
                  <span key={r}>{r}</span>
                ))}
              </div>
            </div>
          </div>

          <span className="wf-map-credit">
            Sentinel-2 cloudless 2024 © EOX · model surface illustrative
          </span>
        </div>

        {/* ---------------- Results ---------------- */}
        <div className="wf-results">
          <Panel
            eyebrow={`Outcome · ${applied.l.horizon}-year horizon`}
            title={`Baseline vs ${applied.s}`}
            right={
              stale ? <Chip tone="amber">Levers changed — re-run</Chip> : <Prov kind="model" />
            }
            flush
          >
            <table className="wf-table compact">
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th>Baseline</th>
                  <th>{applied.s}</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Agri land retained", BASELINE.agri, res.agri, "ha", 1],
                    ["Development area", BASELINE.dev, res.dev, "ha", 0],
                    ["Flood exposure", BASELINE.flood, res.flood, "ha", -1],
                    ["Land disputes", BASELINE.disputes, res.disputes, "", -1],
                  ] as const
                ).map(([k, base, v, unit, good]) => {
                  if (!v)
                    return (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{fmt(base)}</td>
                        <td colSpan={2} className="dim">
                          n/a — S2/S3 lever
                        </td>
                      </tr>
                    );
                  const delta = v[0] - base;
                  const tone = good === 0 ? "" : delta * good > 0 ? "up" : "down";
                  return (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>
                        {fmt(base)} {unit}
                      </td>
                      <td>
                        <b>
                          <Num v={v[0]} />
                        </b>{" "}
                        <small>± {fmt(v[1])}</small>
                      </td>
                      <td className={`wf-delta ${tone}`}>
                        {delta > 0 ? "+" : ""}
                        {fmt(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          <Panel
            eyebrow="Explain this cell · SHAP"
            title={`p = ${hp.toFixed(2)} for the selected cell`}
            sub="Click any hexagon to explain it"
          >
            <div className="wf-shap">
              {shapRows.map((f) => (
                <div key={f.label}>
                  <span>{f.label}</span>
                  <i>
                    <em
                      className={f.value >= 0 ? "pos" : "neg"}
                      style={{ width: `${(Math.abs(f.value) / maxShap) * 50}%` }}
                    />
                  </i>
                  <b className={f.value >= 0 ? "pos" : "neg"}>
                    {f.value >= 0 ? "+" : "−"}
                    {Math.abs(f.value).toFixed(2)}
                  </b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            eyebrow="Distributional lens"
            title="The average hides who loses"
            sub={`Net effect by group under ${applied.s} · %`}
          >
            <div className="wf-diverge">
              {res.dist.map((d) => (
                <div key={d.label}>
                  <span>{d.label}</span>
                  <i>
                    <em
                      className={d.value >= 0 ? "pos" : "neg"}
                      style={{ width: `${(Math.abs(d.value) / maxDist) * 50}%` }}
                    />
                  </i>
                  <b className={d.value >= 0 ? "pos" : "neg"}>
                    {d.value > 0 ? "+" : d.value < 0 ? "−" : ""}
                    {Math.abs(d.value)}%
                  </b>
                </div>
              ))}
            </div>
          </Panel>

          <button type="button" className="wf-btn ghost block" onClick={onNext}>
            Register a KPI for this policy <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
