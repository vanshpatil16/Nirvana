import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  GEOGRAPHY_SHAPES,
  REGION_OUTLINE_RING,
  STUDY_REGION,
  type GeographyImpact,
} from "@/data/policySimulation";
import { Inbox } from "lucide-react";
import { Empty, PrototypeTag } from "./States";

maplibregl.config.WORKER_URL = mapWorkerUrl;

const SAT_TILES = [
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
];

/** Sequential ramp for modelled intensity (low → high). */
const INTENSITY_RAMP: [number, string][] = [
  [0, "#eef4ee"],
  [25, "#d4e8d8"],
  [50, "#9fcdb0"],
  [75, "#4d9d74"],
  [100, "#075b3a"],
];

/** Diverging ramp for signed change (fall → rise). */
const SIGNED_RAMP: [number, string][] = [
  [-12, "#b3302f"],
  [-6, "#e08a80"],
  [-2, "#f6ded9"],
  [0, "#f2f5f0"],
  [2, "#d7ecdd"],
  [6, "#7cbf95"],
  [12, "#0b7a4b"],
];

type Metric = "intensity" | "change";

function featureCollection(impact: GeographyImpact[]) {
  const byId = new Map(impact.map((i) => [i.geographyId, i]));
  return {
    type: "FeatureCollection" as const,
    features: GEOGRAPHY_SHAPES.map((s) => {
      const row = byId.get(s.id);
      return {
        type: "Feature" as const,
        id: s.id,
        properties: {
          id: s.id,
          name: row?.name ?? s.id,
          code: row?.code ?? s.id,
          zone: row?.zone ?? "",
          intensity: row?.intensity ?? 0,
          pct: row?.changePct ?? 0,
          inTarget: row?.inTarget ? 1 : 0,
        },
        geometry: { type: "Polygon" as const, coordinates: [s.ring] },
      };
    }),
  };
}

const OUTLINE_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: REGION_OUTLINE_RING },
    },
  ],
};

const loaded = new WeakSet<maplibregl.Map>();
const whenLoaded = (map: maplibregl.Map, fn: () => void) =>
  loaded.has(map) ? fn() : map.once("load", fn);

/**
 * Simulated-impact map.
 *
 * Geometry comes from the mock geography layer; the values painted on it come
 * from the current `SimulationResult`, so any parameter change re-colours the
 * map without a single hand-drawn shape.
 */
export function ImpactMap({
  impact,
  headline,
  emptyHint,
}: {
  impact: GeographyImpact[];
  headline?: string;
  emptyHint?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [metric, setMetric] = useState<Metric>("intensity");
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; value: string } | null>(
    null,
  );

  const geo = useMemo(() => featureCollection(impact), [impact]);
  const maxAbs = useMemo(() => Math.max(1, ...impact.map((i) => Math.abs(i.changePct))), [impact]);
  const hasData = impact.some((i) => i.intensity > 0 || Math.abs(i.changePct) > 0.01);

  useEffect(() => {
    if (!container.current) return;
    const b = STUDY_REGION.bounds;
    const map = new maplibregl.Map({
      container: container.current,
      bounds: [
        [b.west, b.south],
        [b.east, b.north],
      ],
      fitBoundsOptions: { padding: 30 },
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          sat: { type: "raster", tiles: SAT_TILES, tileSize: 256 },
          units: { type: "geojson", data: geo as never },
          outline: { type: "geojson", data: OUTLINE_GEOJSON as never },
        },
        layers: [
          { id: "sat", type: "raster", source: "sat", paint: { "raster-opacity": 0.88 } },
          {
            id: "units",
            type: "fill",
            source: "units",
            paint: {
              "fill-color": [
                "interpolate",
                ["linear"],
                ["get", "intensity"],
                ...INTENSITY_RAMP.flat(),
              ],
              "fill-opacity": ["case", ["==", ["get", "inTarget"], 1], 0.8, 0.26],
            },
          },
          {
            id: "unit-lines",
            type: "line",
            source: "units",
            paint: {
              "line-color": ["case", ["==", ["get", "inTarget"], 1], "#075b3a", "#9aa8a0"],
              "line-width": ["case", ["==", ["get", "inTarget"], 1], 1.6, 0.7],
              "line-opacity": 0.9,
            },
          },
          {
            id: "region-outline",
            type: "line",
            source: "outline",
            paint: { "line-color": "#17231d", "line-width": 1.6, "line-opacity": 0.55 },
          },
        ],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.once("load", () => {
      loaded.add(map);
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // created once; later effects push data and paint changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenLoaded(map, () => {
      (map.getSource("units") as maplibregl.GeoJSONSource | undefined)?.setData(geo as never);
      const stops =
        metric === "intensity"
          ? INTENSITY_RAMP
          : SIGNED_RAMP.map(([v, c]) => [(v / maxAbs) * 100, c] as [number, string]);
      map.setPaintProperty("units", "fill-color", [
        "interpolate",
        ["linear"],
        ["get", metric === "intensity" ? "intensity" : "pct"],
        ...stops.flat(),
      ]);
    });
  }, [geo, metric, maxAbs, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const move = (e: maplibregl.MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ["units"] })[0];
      if (!f) {
        setTip(null);
        return;
      }
      const p = f.properties as { name: string; intensity: number; pct: number; inTarget: number };
      setTip({
        x: e.point.x,
        y: e.point.y,
        name: p.name,
        value:
          metric === "intensity"
            ? `Impact intensity ${p.intensity}/100${p.inTarget ? "" : " · outside target"}`
            : `${p.pct > 0 ? "+" : ""}${p.pct.toFixed(2)}% vs baseline`,
      });
    };
    const click = (e: maplibregl.MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ["units"] })[0];
      const props = f?.properties as { id?: string } | undefined;
      const id = props?.["id"];
      setSelected((prev) => (id && prev === id ? null : (id ?? null)));
    };
    map.on("mousemove", move);
    map.on("click", click);
    return () => {
      map.off("mousemove", move);
      map.off("click", click);
    };
  }, [metric, selected]);

  const legend = metric === "intensity" ? INTENSITY_RAMP : SIGNED_RAMP;
  const selectedRow = impact.find((i) => i.geographyId === selected) ?? null;

  return (
    <div className="pl-map">
      <div ref={container} className="canvas" />
      {!ready && <div className="pl-map-loading">Preparing study-region map…</div>}

      <div className="pl-map-chip">
        <span>{headline ?? "Modelled impact by unit"}</span>
        <PrototypeTag label="Simulated values" />
      </div>

      {tip && (
        <div className="pl-map-tip" style={{ left: tip.x, top: tip.y }}>
          <strong>{tip.name}</strong>
          <span>{tip.value}</span>
        </div>
      )}

      <div className="pl-map-legend">
        <b>{metric === "intensity" ? "Modelled impact intensity" : "Signed change vs baseline"}</b>
        <div className="ramp">
          {legend.map(([, c]) => (
            <i key={c} style={{ background: c }} />
          ))}
        </div>
        <div className="ramp-labels">
          {metric === "intensity" ? (
            <>
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </>
          ) : (
            <>
              <span>−{maxAbs.toFixed(0)}%</span>
              <span>0</span>
              <span>+{maxAbs.toFixed(0)}%</span>
            </>
          )}
        </div>
      </div>

      <div className="pl-map-modes">
        <button
          className={metric === "intensity" ? "active" : ""}
          onClick={() => setMetric("intensity")}
        >
          Impact
        </button>
        <button className={metric === "change" ? "active" : ""} onClick={() => setMetric("change")}>
          Signed change
        </button>
      </div>

      {!hasData && (
        <div style={{ position: "absolute", inset: "auto 12px 62px 12%", zIndex: 3 }}>
          <Empty icon={Inbox} title="No modelled impact for this configuration" compact>
            {emptyHint ??
              "Select at least one land category for the policy to act on, or pick units with development pressure."}
          </Empty>
        </div>
      )}

      {selectedRow && (
        <div
          style={{
            position: "absolute",
            zIndex: 3,
            top: 52,
            right: 12,
            width: 210,
          }}
        >
          <div className="pl-card" style={{ padding: "11px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>{selectedRow.name}</strong>
              <span className="pl-tag">{selectedRow.code}</span>
            </div>
            <dl className="pl-kv" style={{ marginTop: 8 }}>
              <div>
                <dt>Zone</dt>
                <dd>{selectedRow.zone}</dd>
              </div>
              <div>
                <dt>Impact intensity</dt>
                <dd>{selectedRow.intensity}/100</dd>
              </div>
              <div>
                <dt>Change vs baseline</dt>
                <dd>
                  {selectedRow.changePct > 0 ? "+" : ""}
                  {selectedRow.changePct.toFixed(2)}%
                </dd>
              </div>
            </dl>
            <button
              className="pl-btn sm ghost"
              style={{ marginTop: 8, width: "100%" }}
              onClick={() => setSelected(null)}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ranked unit list beside the map — same data, keyboard accessible. */
export function UnitRanking({
  impact,
  selected,
  onSelect,
}: {
  impact: GeographyImpact[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = [...impact].sort((a, b) => b.intensity - a.intensity);
  if (!rows.length) return null;
  return (
    <div className="pl-unit-list">
      {rows.map((r) => (
        <button
          key={r.geographyId}
          className={`pl-unit ${selected === r.geographyId ? "on" : ""}`}
          onClick={() => onSelect(r.geographyId)}
        >
          <i
            style={{
              background:
                r.intensity > 66
                  ? "#075b3a"
                  : r.intensity > 33
                    ? "#4d9d74"
                    : r.intensity > 0
                      ? "#9fcdb0"
                      : "#dfe6df",
            }}
          />
          <span>
            {r.name}
            <small>
              {r.code} · {r.zone}
            </small>
          </span>
          <b>{r.intensity}</b>
        </button>
      ))}
    </div>
  );
}
