import { useMemo } from "react";
import states from "@/data/india-states.json";

/**
 * Lightweight SVG map of India for the Innovation Portal.
 *
 * The dashboard's India map is a full MapLibre instance wired to live imagery,
 * which is the wrong tool here: the pilot map only needs to show which states
 * host challenges and pilots, and the portal is server-rendered, so it must not
 * depend on a WebGL context or a tile provider. Projecting the same
 * `india-states.json` GeoJSON to SVG keeps it dependency-free and SSR-safe.
 */

type Ring = number[][];
type Feature = {
  type: "Feature";
  properties: { name: string };
  geometry: { type: string; coordinates: unknown };
};

const FEATURES = (states as unknown as { features: Feature[] }).features;

/** India's extent in the source GeoJSON, used to normalise the projection. */
const LON_MIN = 67.5;
const LON_MAX = 98.5;
const LAT_MIN = 5.0;
const LAT_MAX = 37.5;

const VIEW_W = 620;
const VIEW_H = 700;

/** Islands drawn tiny at this scale; keeping them distorts the mainland. */
const OMITTED = ["Lakshadweep", "Andaman and Nicobar Islands"];

/**
 * Equirectangular projection with a standard-parallel cosine correction, which
 * is enough to keep India's outline recognisable at this size without pulling in
 * a projection library. Returns SVG coordinates inside the viewBox.
 */
function project(lon: number, lat: number): [number, number] {
  const midLat = (LAT_MIN + LAT_MAX) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const x = (lon - LON_MIN) / (LON_MAX - LON_MIN);
  const y = 1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN);
  // India's width relative to its height, so the outline is not stretched.
  const width = VIEW_W * 0.8;
  const height = VIEW_H * 0.94;
  return [x * width + (VIEW_W - width) / 2, y * height + VIEW_H * 0.03];
}

function ringToPath(ring: Ring): string {
  return ring
    .map((point) => {
      const lon = point[0];
      const lat = point[1];
      if (typeof lon !== "number" || typeof lat !== "number") return "";
      const [x, y] = project(lon, lat);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .reduce((acc, point, i) => `${acc}${i === 0 ? "M" : "L"}${point}`, "");
}

function featureToPath(feature: Feature): string {
  const parts: string[] = [];
  if (feature.geometry.type === "Polygon") {
    for (const ring of feature.geometry.coordinates as Ring[]) parts.push(`${ringToPath(ring)} Z`);
  } else if (feature.geometry.type === "MultiPolygon") {
    for (const polygon of feature.geometry.coordinates as Ring[][]) {
      for (const ring of polygon) parts.push(`${ringToPath(ring)} Z`);
    }
  }
  return parts.join(" ");
}

const PATHS = FEATURES.filter((f) => !OMITTED.includes(f.properties.name)).map((f) => ({
  name: f.properties.name,
  d: featureToPath(f),
}));

export interface PilotMapStat {
  state: string;
  challenges: number;
  pilots: number;
}

/**
 * National innovation map. States hosting challenges or pilots are shaded by
 * pilot count; the rest stay as quiet context.
 */
export function InnovationPilotMap({
  stats,
  activeState,
  onSelect,
}: {
  stats: PilotMapStat[];
  /** Currently selected state filter, used to dim unrelated states. */
  activeState?: string | null;
  onSelect?: (state: string | null) => void;
}) {
  const byState = useMemo(() => new Map(stats.map((s) => [s.state, s])), [stats]);
  const maxPilots = useMemo(() => Math.max(1, ...stats.map((s) => s.pilots)), [stats]);

  const fillFor = (name: string): string => {
    const stat = byState.get(name);
    if (!stat) return "#E7E3D4";
    // Green intensity scales with pilot count so heavier presence reads darker.
    const t = stat.pilots / maxPilots;
    return `color-mix(in oklab, var(--primary) ${Math.round(20 + t * 55)}%, #EFEBDE)`;
  };

  const isDimmed = (name: string) =>
    !!activeState && activeState !== "All States" && activeState !== name;

  return (
    <figure className="inno-map">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="Map of India showing states with active innovation pilots"
      >
        {PATHS.map((p) => {
          const stat = byState.get(p.name);
          const interactive = !!stat && !!onSelect;
          return (
            <path
              key={p.name}
              d={p.d}
              className={`inno-map-state${stat ? " active" : ""}${isDimmed(p.name) ? " dimmed" : ""}`}
              fill={fillFor(p.name)}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={
                stat
                  ? `${p.name}: ${stat.challenges} challenges, ${stat.pilots} pilots`
                  : `${p.name}: no active pilots`
              }
              onClick={interactive ? () => onSelect?.(p.name) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect?.(p.name);
                      }
                    }
                  : undefined
              }
            />
          );
        })}
      </svg>
      <figcaption className="inno-map-legend">
        <span>
          <i className="swatch low" /> Pilot activity
        </span>
        <span>
          <i className="swatch none" /> No active pilot
        </span>
        <small>Demo figures — not official pilot records.</small>
      </figcaption>
    </figure>
  );
}
