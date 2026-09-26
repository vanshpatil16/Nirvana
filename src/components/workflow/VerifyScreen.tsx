import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardCheck,
  GitBranch,
  Layers,
  Satellite,
  X,
} from "lucide-react";
import {
  bandColor,
  bandLabel,
  bandOf,
  C,
  CELLS_GEOJSON,
  CHECK_NAMES,
  CONTRIBUTORS,
  OUTLINE_GEOJSON,
  OWNERS,
  parcelFor,
  SCREENING_BANNER,
  STUDY_BOUNDS,
  TIMELINE,
  VILLAGES,
} from "./data";
import { Chip, Panel, Prov } from "./ui";

maplibregl.config.WORKER_URL = mapWorkerUrl;

type Base = "imagery" | "lulc";

const LULC_SERVICE =
  "https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/exportImage";
const yearRange = (y: number) => `${Date.UTC(y, 0, 1)},${Date.UTC(y, 11, 31)}`;

/** Real Esri / Impact Observatory 10 m Annual LULC, fetched per tile by bbox. */
const lulcTiles = (year: number) => [
  `${LULC_SERVICE}?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&time=${yearRange(year)}&renderingRule=${encodeURIComponent('{"rasterFunction":"Cartographic Renderer for Visualization and Analysis"}')}&f=image`,
];
const imageryTiles = (year: number) => [
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`,
];

export const LULC_LEGEND = [
  { label: "Built area", color: "#ed022a" },
  { label: "Crops", color: "#ffdb5c" },
  { label: "Trees", color: "#358221" },
  { label: "Rangeland", color: "#efcfa8" },
  { label: "Water", color: "#1a5bab" },
];

function style(year: number): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      img: {
        type: "raster",
        tiles: imageryTiles(year),
        tileSize: 256,
        attribution: "Sentinel-2 cloudless © EOX",
      },
      lulc: {
        type: "raster",
        tiles: lulcTiles(year),
        tileSize: 256,
        attribution: "Esri · Impact Observatory 10 m LULC",
      },
      cells: { type: "geojson", data: CELLS_GEOJSON as never },
      outline: { type: "geojson", data: OUTLINE_GEOJSON as never },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0e1f16" } },
      {
        id: "img",
        type: "raster",
        source: "img",
        paint: { "raster-saturation": -0.25, "raster-brightness-max": 0.92 },
      },
      {
        id: "lulc",
        type: "raster",
        source: "lulc",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.95, "raster-resampling": "nearest" },
      },
      {
        id: "cells-fill",
        type: "fill",
        source: "cells",
        paint: {
          "fill-color": ["match", ["get", "band"], "high", C.red, "medium", C.amber, C.green],
          "fill-opacity": ["case", ["==", ["get", "named"], 1], 0.46, 0.2],
        },
      },
      {
        id: "cells-line",
        type: "line",
        source: "cells",
        paint: { "line-color": "rgba(255,255,255,0.55)", "line-width": 0.8 },
      },
      {
        id: "cells-sel",
        type: "line",
        source: "cells",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#ffffff", "line-width": 3.2 },
      },
      {
        id: "outline",
        type: "line",
        source: "outline",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1.6,
          "line-dasharray": [3, 2],
          "line-opacity": 0.8,
        },
      },
      {
        id: "cells-label",
        type: "symbol",
        source: "cells",
        filter: ["==", ["get", "named"], 1],
        layout: {
          "text-field": ["concat", ["get", "name"], "\n", ["to-string", ["get", "score"]]],
          "text-font": ["Noto Sans Medium"],
          "text-size": 11.5,
          "text-line-height": 1.15,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(3,20,12,0.85)",
          "text-halo-width": 1.5,
        },
      },
    ],
  };
}

function applyBase(m: maplibregl.Map, base: Base) {
  if (!m.getLayer("lulc")) return;
  m.setLayoutProperty("lulc", "visibility", base === "lulc" ? "visible" : "none");
  m.setPaintProperty("img", "raster-opacity", base === "lulc" ? 0.35 : 1);
  // choropleth fill over imagery; outlines only over land cover (keeps the LULC colours readable)
  m.setPaintProperty(
    "cells-fill",
    "fill-opacity",
    base === "lulc"
      ? ["case", ["==", ["get", "named"], 1], 0.12, 0]
      : ["case", ["==", ["get", "named"], 1], 0.46, 0.2],
  );
  m.setPaintProperty(
    "cells-line",
    "line-color",
    base === "lulc" ? "rgba(20,30,24,0.55)" : "rgba(255,255,255,0.55)",
  );
}

// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const band = bandOf(score);
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <div className="wf-ring">
      <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#efece2" strokeWidth="9" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={bandColor(band)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform="rotate(-90 48 48)"
          className="wf-ring-arc"
        />
      </svg>
      <div>
        <b style={{ color: bandColor(band) }}>{score}</b>
        <small>/ 100</small>
      </div>
    </div>
  );
}

function OwnershipGraph({
  village,
  survey,
  area,
}: {
  village: string;
  survey: string;
  area: number;
}) {
  return (
    <div className="wf-graph">
      <svg
        viewBox="0 0 400 214"
        role="img"
        aria-label="Ownership graph: Ramesh 40%, Suresh 30%, Meena 30% hold the parcel"
      >
        <defs>
          <marker
            id="wf-arr"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={C.forest} />
          </marker>
          <linearGradient id="wf-pg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={C.forest} />
            <stop offset="1" stopColor={C.forestDark} />
          </linearGradient>
        </defs>
        {OWNERS.map((o, i) => {
          const y = 22 + i * 64;
          return (
            <g key={o.name} className="wf-graph-node" style={{ animationDelay: `${i * 120}ms` }}>
              <path
                d={`M150 ${y + 22} C 210 ${y + 22}, 214 107, 262 107`}
                fill="none"
                stroke={C.forest}
                strokeOpacity="0.55"
                strokeWidth={1.2 + o.share / 10}
                markerEnd="url(#wf-arr)"
                className="wf-graph-edge"
              />
              <rect
                x="190"
                y={(y + 22 + 107) / 2 - 10}
                width="38"
                height="18"
                rx="9"
                fill="#fff"
                stroke={C.line}
              />
              <text
                x="209"
                y={(y + 22 + 107) / 2 + 3}
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill={C.forest}
              >
                {o.share}%
              </text>
              <rect x="10" y={y} width="140" height="44" rx="12" fill="#fff" stroke={C.line} />
              <circle cx="34" cy={y + 22} r="13" fill={C.mint} />
              <text
                x="34"
                y={y + 26.5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fill={C.forest}
              >
                {o.name[0]}
              </text>
              <text x="55" y={y + 19} fontSize="12.5" fontWeight="700" fill={C.ink}>
                {o.name}
              </text>
              <text x="55" y={y + 34} fontSize="10" fill={C.muted}>
                Co-owner · {o.share}% share
              </text>
            </g>
          );
        })}
        <g className="wf-graph-node" style={{ animationDelay: "380ms" }}>
          <rect x="266" y="66" width="124" height="82" rx="14" fill="url(#wf-pg)" />
          <text
            x="328"
            y="89"
            textAnchor="middle"
            fontSize="9"
            fontWeight="800"
            letterSpacing="1.4"
            fill={C.forestSoft}
          >
            PARCEL
          </text>
          <text x="328" y="110" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">
            {village} {survey}
          </text>
          <text x="328" y="129" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.72)">
            {area.toFixed(2)} ha · Agriculture
          </text>
        </g>
      </svg>

      <div className="wf-tl">
        {TIMELINE.map((t, i) => (
          <div key={t.year} className={`wf-tl-item ${t.state}`}>
            {i > 0 && (
              <span
                className={`wf-tl-bar ${t.state === "missing" || TIMELINE[i - 1]!.state === "missing" ? "broken" : ""}`}
              />
            )}
            <span className="wf-tl-dot">
              {t.state === "missing" ? (
                <X size={11} strokeWidth={3} />
              ) : (
                <Check size={11} strokeWidth={3} />
              )}
            </span>
            <b>{t.year}</b>
            <span className="wf-tl-lbl">{t.label}</span>
            <small>{t.note}</small>
          </div>
        ))}
      </div>
      <p className="wf-graph-note">
        <AlertTriangle size={14} />
        <span>
          The 2020 transfer rests on a title whose 2015 mutation was never entered — the deed is{" "}
          <b>orphaned</b>.
        </span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VerifyScreen({ head, onNext }: { head: ReactNode; onNext: () => void }) {
  const [selected, setSelected] = useState("maan");
  const [split, setSplit] = useState(50);
  const [base, setBase] = useState<Base>("imagery");
  const [tab, setTab] = useState<"parcel" | "graph">("parcel");
  const [assigned, setAssigned] = useState<Set<string>>(new Set());

  const wrapRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const maps = useRef<maplibregl.Map[]>([]);
  const dragging = useRef(false);

  const village = VILLAGES.find((v) => v.id === selected) ?? VILLAGES[0]!;
  const parcel = useMemo(() => parcelFor(village), [village]);
  const band = bandOf(parcel.score);
  const rank = VILLAGES.indexOf(village) + 1;

  useEffect(() => {
    if (!aRef.current || !bRef.current) return;
    const mk = (el: HTMLElement, year: number) =>
      new maplibregl.Map({
        container: el,
        style: style(year),
        bounds: STUDY_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        attributionControl: false,
      });
    const a = mk(aRef.current, 2019);
    const b = mk(bRef.current, 2024);
    maps.current = [a, b];
    let syncing = false;
    const link = (from: maplibregl.Map, to: maplibregl.Map) => () => {
      if (syncing) return;
      syncing = true;
      to.jumpTo({ center: from.getCenter(), zoom: from.getZoom() });
      syncing = false;
    };
    a.on("move", link(a, b));
    b.on("move", link(b, a));
    for (const m of [a, b]) {
      m.on("click", "cells-fill", (e) => {
        const id = e.features?.[0]?.properties?.["id"];
        if (typeof id === "string" && VILLAGES.some((v) => v.id === id)) setSelected(id);
      });
      m.on("mouseenter", "cells-fill", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "cells-fill", () => (m.getCanvas().style.cursor = ""));
    }
    return () => {
      a.remove();
      b.remove();
      maps.current = [];
    };
  }, []);

  useEffect(() => {
    for (const m of maps.current) {
      const run = () => applyBase(m, base);
      if (m.isStyleLoaded()) run();
      else m.once("load", run);
    }
  }, [base]);

  useEffect(() => {
    const v = VILLAGES.find((x) => x.id === selected);
    const [a] = maps.current;
    for (const m of maps.current) {
      const run = () => m.setFilter("cells-sel", ["==", ["get", "id"], selected]);
      if (m.isStyleLoaded()) run();
      else m.once("load", run);
    }
    if (a && v)
      a.easeTo({ center: [v.lon, v.lat], zoom: Math.max(a.getZoom(), 10.4), duration: 900 });
  }, [selected]);

  const setSplitFrom = (x: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setSplit(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  };

  const toggleAssign = (id: string) =>
    setAssigned((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="wf-screen">
      {head}
      <div className="wf-verify">
        {/* ------------ Ranked queue ------------ */}
        <Panel
          className="wf-queue"
          eyebrow="Verification queue"
          title="Top-10 villages to verify"
          sub="Ranked by Integrity Index · Pune fringe"
          right={<Prov kind="synthetic" />}
          flush
        >
          <div className="wf-qhead">
            <span>#</span>
            <span>Village</span>
            <span>Index</span>
            <span />
          </div>
          <ol className="wf-qlist">
            {VILLAGES.map((v, i) => {
              const b = bandOf(v.score);
              const on = v.id === selected;
              const done = assigned.has(v.id);
              return (
                <li key={v.id} className={on ? "on" : ""} onClick={() => setSelected(v.id)}>
                  <span className="rk">{i + 1}</span>
                  <span className="vn">
                    <b>{v.name}</b>
                    <small>{v.issue}</small>
                  </span>
                  <span className="sc">
                    <b style={{ color: bandColor(b) }}>{v.score}</b>
                    <i className={`wf-band ${b}`}>{bandLabel(b)}</i>
                  </span>
                  <button
                    type="button"
                    className={`wf-assign ${done ? "done" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAssign(v.id);
                    }}
                    title="Assign field check"
                  >
                    {done ? <Check size={13} strokeWidth={3} /> : <ClipboardCheck size={13} />}
                    <span>{done ? "Assigned" : "Assign"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="wf-qfoot">
            <span>
              <b>{assigned.size}</b> field check{assigned.size === 1 ? "" : "s"} assigned
            </span>
            <span className="dim">Mobile app · GPS + photo</span>
          </div>
        </Panel>

        {/* ------------ Swipe map ------------ */}
        <div className="wf-mapbox" ref={wrapRef}>
          <div ref={aRef} className="wf-map-layer" />
          <div ref={bRef} className="wf-map-layer" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />

          <div className="wf-map-top">
            <div className="wf-seg dark">
              <button
                type="button"
                className={base === "imagery" ? "on" : ""}
                onClick={() => setBase("imagery")}
              >
                <Satellite size={13} /> Satellite
              </button>
              <button
                type="button"
                className={base === "lulc" ? "on" : ""}
                onClick={() => setBase("lulc")}
              >
                <Layers size={13} /> Land cover 10 m
              </button>
            </div>
            <Prov kind="real">Real imagery · 2019 vs 2024</Prov>
          </div>

          <span className="wf-year left" style={{ opacity: split > 12 ? 1 : 0 }}>
            {base === "lulc" ? "Land cover" : "Satellite"} 2019
          </span>
          <span className="wf-year right" style={{ opacity: split < 88 ? 1 : 0 }}>
            {base === "lulc" ? "Land cover" : "Satellite"} 2024
          </span>

          <div
            className="wf-swipe"
            style={{ left: `${split}%` }}
            role="slider"
            tabIndex={0}
            aria-label="Swipe between 2019 and 2024"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(split)}
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => dragging.current && setSplitFrom(e.clientX)}
            onPointerUp={() => (dragging.current = false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setSplit((s) => Math.max(0, s - 4));
              if (e.key === "ArrowRight") setSplit((s) => Math.min(100, s + 4));
            }}
          >
            <span className="wf-swipe-knob">
              <ArrowRight size={12} style={{ transform: "rotate(180deg)" }} />
              <ArrowRight size={12} />
            </span>
          </div>

          <div className="wf-legend">
            <b>Integrity Index</b>
            <div className="wf-legend-grad" />
            <div className="wf-legend-scale">
              <span>0 · verified</span>
              <span>50</span>
              <span>70</span>
              <span>100 · high risk</span>
            </div>
            {base === "lulc" && (
              <div className="wf-legend-lulc">
                {LULC_LEGEND.map((l) => (
                  <span key={l.label}>
                    <i style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="wf-map-credit">
            Sentinel-2 cloudless © EOX · Esri / Impact Observatory LULC · village boundaries
            illustrative
          </span>
        </div>

        {/* ------------ Detail ------------ */}
        <Panel
          className="wf-detail"
          eyebrow={`Rank ${rank} · ${village.area ? `${village.name} (${village.area})` : village.name}`}
          title={
            <>
              Survey {parcel.survey} <span className="wf-ulpin">ULPIN {parcel.ulpin}</span>
            </>
          }
          right={<Prov kind="illustrative" />}
          flush
        >
          <div className="wf-tabs">
            <button
              type="button"
              className={tab === "parcel" ? "on" : ""}
              onClick={() => setTab("parcel")}
            >
              <ClipboardCheck size={14} /> Integrity check
            </button>
            <button
              type="button"
              className={tab === "graph" ? "on" : ""}
              onClick={() => setTab("graph")}
            >
              <GitBranch size={14} /> Ownership graph
            </button>
          </div>

          {tab === "parcel" ? (
            <div className="wf-parcel" key={parcel.survey}>
              <div className="wf-rvr">
                <div className="wf-rvr-box">
                  <span className="k">Record (RoR)</span>
                  <b>{parcel.recorded}</b>
                  <small>Area {parcel.areaHa.toFixed(2)} ha</small>
                </div>
                <span className="wf-rvr-vs">≠</span>
                <div className="wf-rvr-box sat">
                  <span className="k">Satellite 2024</span>
                  <div className="wf-stack">
                    <i style={{ width: `${parcel.sat2024.built}%`, background: "#d8453a" }} />
                    <i style={{ width: `${parcel.sat2024.agri}%`, background: "#e9c24c" }} />
                    <i style={{ width: `${parcel.sat2024.veg}%`, background: "#4e9a58" }} />
                  </div>
                  <small>
                    <b>{parcel.sat2024.built}% built-up</b> · {parcel.sat2024.agri}% agriculture ·{" "}
                    {parcel.sat2024.veg}% vegetation
                  </small>
                </div>
              </div>

              <div className="wf-scorebox">
                <ScoreRing score={parcel.score} />
                <div className="wf-scoremeta">
                  <span className="k">Title Risk Score</span>
                  <span className={`wf-risk ${band}`}>
                    {parcel.score} {bandLabel(band)} RISK
                  </span>
                  <div className="wf-contrib">
                    {CONTRIBUTORS.map((c, i) => (
                      <div key={c.label}>
                        <span>{c.label}</span>
                        <i>
                          <em style={{ width: `${c.pct * 2.5}%`, animationDelay: `${i * 70}ms` }} />
                        </i>
                        <b>{c.pct}%</b>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wf-checks">
                {CHECK_NAMES.map((n) => {
                  const fail = parcel.failed.includes(n);
                  return (
                    <span key={n} className={fail ? "fail" : "pass"}>
                      {fail ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
                      {n}
                    </span>
                  );
                })}
              </div>

              <div className="wf-banner amber">
                <AlertTriangle size={15} />
                {SCREENING_BANNER}
              </div>
              <div className="wf-actions">
                <button
                  type="button"
                  className="wf-btn primary"
                  onClick={() => toggleAssign(village.id)}
                >
                  <ClipboardCheck size={15} />
                  {assigned.has(village.id) ? "Field check assigned ✓" : "Assign field check"}
                </button>
                <button type="button" className="wf-btn ghost" onClick={() => setTab("graph")}>
                  <GitBranch size={15} /> Trace ownership
                </button>
              </div>
            </div>
          ) : (
            <div className="wf-parcel">
              <div className="wf-graph-head">
                <Chip tone="forest">Knowledge graph · Neo4j</Chip>
                <Chip tone="red">1 broken link</Chip>
              </div>
              <OwnershipGraph
                village={parcel.village}
                survey={parcel.survey}
                area={parcel.areaHa}
              />
              <div className="wf-actions">
                <button type="button" className="wf-btn primary" onClick={onNext}>
                  Ask the Copilot about this area <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
