import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import statesGeoJSON from "@/data/india-states.json";
import { STATE_STATS } from "@/data/state-intelligence";
import {
  ALL_INDIA,
  REGION_OPTIONS,
  regionStates,
  scenarioFlows,
  yearShares,
} from "@/data/land-scenario";
import { LULC_CLASSES, renderRegion, statesBounds } from "@/components/land-difference/lulcRaster";

maplibregl.config.WORKER_URL = mapWorkerUrl;

const IMAGERY_YEARS = ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
const satelliteTiles = (year: string) => [
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`,
];

// Demo overlays (approximate geometry, for orientation only)
const INFRA = {
  type: "FeatureCollection",
  features: [
    [
      [72.95, 19.02],
      [73.35, 18.8],
      [73.85, 18.52],
    ],
    [
      [73.1, 19.25],
      [73.8, 19.95],
      [75.3, 19.9],
      [77.0, 20.5],
      [79.0, 21.1],
    ],
    [
      [77.2, 28.6],
      [76.2, 27.0],
      [75.0, 25.5],
      [73.8, 23.8],
      [72.6, 23.0],
      [73.0, 21.6],
      [72.9, 19.4],
    ],
    [
      [77.6, 12.97],
      [78.8, 12.9],
      [80.27, 13.08],
    ],
    [
      [77.2, 28.6],
      [78.0, 27.2],
      [80.95, 26.85],
    ],
  ].map((coordinates) => ({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  })),
};

const circle = (lon: number, lat: number, r: number) =>
  Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return [lon + r * Math.cos(a), lat + r * 0.9 * Math.sin(a)];
  });

const PROTECTED = {
  type: "FeatureCollection",
  features: [
    [70.8, 21.15, 0.25],
    [79.35, 20.25, 0.15],
    [77.2, 21.45, 0.25],
    [80.6, 22.3, 0.2],
    [76.6, 11.7, 0.15],
    [76.45, 26.0, 0.15],
    [72.9, 19.22, 0.07],
  ].map(([lon, lat, r]) => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [circle(lon!, lat!, r!)] },
  })),
};

type StateFeature = { type: string; properties: { name: string }; geometry: unknown };
type GeoData = maplibregl.GeoJSONSourceSpecification["data"];

// State choropleths from the demo intelligence snapshot
const levelsGeo = (() => {
  const src = statesGeoJSON as unknown as { type: string; features: StateFeature[] };
  return {
    ...src,
    features: src.features.map((f) => {
      const st = STATE_STATS[f.properties.name];
      return {
        ...f,
        properties: {
          ...f.properties,
          risk: st?.riskLevel ?? -1,
          disputes: st?.disputeLevel ?? -1,
        },
      };
    }),
  };
})();

type OverlayId = "climate" | "disputes" | "infra" | "protected" | "urban" | "admin";

const OVERLAYS: { id: OverlayId; label: string; color: string; note?: string }[] = [
  { id: "urban", label: "Urban expansion", color: "#ffffff", note: "change" },
  { id: "climate", label: "Climate risk", color: "#F59E0B", note: "state" },
  { id: "disputes", label: "Land disputes", color: "#E34D4D", note: "state" },
  { id: "infra", label: "Infrastructure", color: "#3B82F6" },
  { id: "protected", label: "Protected areas", color: "#7C5CFC", note: "demo" },
  { id: "admin", label: "Administrative boundaries", color: "#DDF4E7" },
];

const loaded = new WeakSet<maplibregl.Map>();
const whenLoaded = (map: maplibregl.Map, fn: () => void) =>
  loaded.has(map) ? fn() : map.once("load", fn);

export function ResearchMap({
  initialRegion = "Maharashtra",
  height = 560,
}: {
  initialRegion?: string;
  height?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const token = useRef<object>({});
  const [region, setRegion] = useState(initialRegion);
  const [year, setYear] = useState("2024");
  const [compare, setCompare] = useState(false);
  const [fromYear, setFromYear] = useState("2018");
  const [classes, setClasses] = useState<boolean[]>([true, true, true, false, false, false]);
  const [overlays, setOverlays] = useState<Record<OverlayId, boolean>>({
    urban: false,
    climate: false,
    disputes: false,
    infra: true,
    protected: false,
    admin: true,
  });
  const [status, setStatus] = useState<string | null>("Preparing land-use layer…");

  useEffect(() => {
    if (!container.current) return;
    const b = statesBounds(regionStates(initialRegion));
    const map = new maplibregl.Map({
      container: container.current,
      bounds: [
        [b.west, b.south],
        [b.east, b.north],
      ],
      fitBoundsOptions: { padding: 40 },
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          satellite: { type: "raster", tiles: satelliteTiles("2024"), tileSize: 256 },
          states: { type: "geojson", data: levelsGeo as GeoData },
          infra: { type: "geojson", data: INFRA as GeoData },
          protected: { type: "geojson", data: PROTECTED as GeoData },
        },
        layers: [
          { id: "sat", type: "raster", source: "satellite" },
          {
            id: "climate",
            type: "fill",
            source: "states",
            filter: [">=", ["get", "risk"], 0],
            layout: { visibility: "none" },
            paint: {
              "fill-color": ["match", ["get", "risk"], 2, "#E34D4D", 1, "#F59E0B", "#FCE7B2"],
              "fill-opacity": 0.42,
            },
          },
          {
            id: "disputes",
            type: "fill",
            source: "states",
            filter: [">=", ["get", "disputes"], 0],
            layout: { visibility: "none" },
            paint: {
              "fill-color": ["match", ["get", "disputes"], 2, "#9B1C1C", 1, "#E34D4D", "#F7C6C6"],
              "fill-opacity": 0.4,
            },
          },
          {
            id: "protected",
            type: "fill",
            source: "protected",
            layout: { visibility: "none" },
            paint: {
              "fill-color": "#7C5CFC",
              "fill-opacity": 0.35,
              "fill-outline-color": "#ffffff",
            },
          },
          {
            id: "admin",
            type: "line",
            source: "states",
            paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.7 },
          },
          {
            id: "infra",
            type: "line",
            source: "infra",
            paint: { "line-color": "#3B82F6", "line-width": 3, "line-opacity": 0.9 },
          },
        ],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.once("load", () => loaded.add(map));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // created once; state changes are applied by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera + boundary emphasis follow the region
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = statesBounds(regionStates(region));
    map.fitBounds(
      [
        [b.west, b.south],
        [b.east, b.north],
      ],
      { padding: 40, duration: 800 },
    );
  }, [region]);

  // Imagery year
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenLoaded(map, () =>
      (map.getSource("satellite") as maplibregl.RasterTileSource).setTiles(satelliteTiles(year)),
    );
  }, [year]);

  // Vector overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenLoaded(map, () => {
      (["climate", "disputes", "protected", "admin", "infra"] as const).forEach((id) =>
        map.setLayoutProperty(id, "visibility", overlays[id] ? "visible" : "none"),
      );
    });
  }, [overlays]);

  // Land-use raster (+ urban-expansion change layer when comparing years)
  const classKey = classes.map(Number).join("");
  // Urban expansion on its own means "change since 2018"; Compare years picks the start year
  const comparing = overlays.urban || compare;
  const from = compare ? fromYear : "2018";
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const mine = {};
    token.current = mine;
    setStatus("Preparing land-use layer…");
    const states = regionStates(region);
    const baseYear = comparing ? from : year;
    const base = states.map((s) => yearShares(s, baseYear));
    const target = states.map((s) => yearShares(s, year));
    const flows =
      comparing && from < year
        ? base.map((b, k) => {
            const t = target[k]!;
            return scenarioFlows(b, {
              built: t.built - b.built,
              forest: t.forest - b.forest,
              water: t.water - b.water,
              agri: 0,
            });
          })
        : null;
    renderRegion(states, baseYear, base, flows, classes).then((r) => {
      if (token.current !== mine) return;
      whenLoaded(map, () => {
        const upsert = (id: string, url: string) => {
          const src = map.getSource(id) as maplibregl.ImageSource | undefined;
          if (src) src.updateImage({ url, coordinates: r.coordinates });
          else {
            map.addSource(id, { type: "image", url, coordinates: r.coordinates });
            map.addLayer(
              {
                id: `${id}-layer`,
                type: "raster",
                source: id,
                paint: { "raster-fade-duration": 250, "raster-resampling": "linear" },
              },
              "climate",
            );
          }
        };
        upsert("lulc", r.baseUrl);
        if (r.changeUrl) upsert("lulc-change", r.changeUrl);
        if (map.getLayer("lulc-change-layer"))
          map.setLayoutProperty(
            "lulc-change-layer",
            "visibility",
            r.changeUrl ? "visible" : "none",
          );
        setStatus(
          r.changeUrl
            ? `${Math.round(r.changedKm2).toLocaleString("en-IN")} km² changed ${baseYear} → ${year} (outlined)`
            : null,
        );
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, year, from, comparing, classKey]);

  const yearIdx = IMAGERY_YEARS.indexOf(year);
  const label = useMemo(() => (comparing ? `${from} → ${year}` : year), [comparing, from, year]);

  return (
    <div className="rh-gis" style={{ minHeight: height }}>
      <div className="rh-gis-map" style={{ minHeight: height }}>
        {/* maplibre's .maplibregl-map { position: relative } would override a class-based absolute */}
        <div ref={container} style={{ position: "absolute", inset: 0 }} />
        <div className="rh-gis-badge">
          <span>
            {region} · {label}
          </span>
          <span className="rh-muted" style={{ fontSize: 11 }}>
            Sentinel-2 cloudless · land use simulated (demo)
          </span>
        </div>
        {status && <div className="rh-gis-status">{status}</div>}
      </div>
      <aside className="rh-gis-panel" aria-label="Map layers">
        <div>
          <h4>Region</h4>
          <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === ALL_INDIA ? "All India" : r}
              </option>
            ))}
          </select>
        </div>
        <div className="rh-year">
          <h4>{compare ? "Compare years" : "Year"}</h4>
          {compare && (
            <select
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value)}
              aria-label="Compare from year"
            >
              {IMAGERY_YEARS.filter((y) => y < year).map((y) => (
                <option key={y} value={y}>
                  From {y}
                </option>
              ))}
            </select>
          )}
          <input
            type="range"
            min={0}
            max={IMAGERY_YEARS.length - 1}
            value={yearIdx}
            onChange={(e) => setYear(IMAGERY_YEARS[Number(e.target.value)]!)}
            aria-label="Year"
            aria-valuetext={year}
          />
          <div className="rh-year-ticks">
            <span>2018</span>
            <b>{year}</b>
            <span>2025</span>
          </div>
          <label className="rh-layer">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => {
                setCompare(e.target.checked);
                if (e.target.checked && fromYear >= year) setFromYear("2018");
              }}
            />
            Compare years
          </label>
        </div>
        <div>
          <h4>Land use</h4>
          {LULC_CLASSES.map((c, i) => (
            <label key={c.id} className="rh-layer">
              <input
                type="checkbox"
                checked={classes[i]}
                onChange={() => setClasses((prev) => prev.map((v, k) => (k === i ? !v : v)))}
              />
              <i style={{ backgroundColor: c.color }} />
              {c.label}
            </label>
          ))}
        </div>
        <div>
          <h4>Overlays</h4>
          {OVERLAYS.map((o) => (
            <label key={o.id} className="rh-layer">
              <input
                type="checkbox"
                checked={o.id === "urban" ? comparing : overlays[o.id]}
                disabled={o.id === "urban" && compare}
                onChange={() => setOverlays((prev) => ({ ...prev, [o.id]: !prev[o.id] }))}
              />
              <i
                style={{
                  backgroundColor: o.color,
                  border: o.id === "urban" || o.id === "admin" ? "1px solid #9aa79f" : undefined,
                }}
              />
              {o.label}
              {o.note && <small>{o.note}</small>}
            </label>
          ))}
          <label className="rh-layer" title="Parcel boundaries are available on the Dashboard map">
            <input type="checkbox" disabled />
            <i style={{ backgroundColor: "#fff", border: "1px solid #9aa79f" }} />
            Parcel boundaries
            <small>
              <a href="/dashboard" style={{ color: "inherit" }}>
                Dashboard
              </a>
            </small>
          </label>
        </div>
        <p className="rh-muted" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>
          Land-use classes and change layers are simulated for demonstration. Imagery © Copernicus
          Sentinel-2 cloudless by EOX.
        </p>
      </aside>
    </div>
  );
}
