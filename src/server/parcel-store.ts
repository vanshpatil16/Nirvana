/**
 * Cadastral parcel store backing GET /api/parcels.
 *
 * Maharashtra: real cadastral plot outlines for Vadnerbhairav (Chandwad, Nashik),
 * see src/data/cadastral/README.md for provenance. Other states are unaffected —
 * they have no dataset here and fall through to the existing OSM fallbacks.
 *
 * Current scale (one village): an in-memory array with bbox prefiltering.
 * Production scale (thousands+ parcels): replace DATASETS with PostGIS —
 *   SELECT … WHERE ST_Intersects(geom, ST_MakeEnvelope(…))
 * with the GIST index from scripts/import_parcels.py --slug <name> (*.sql).
 * The response shape stays identical normalized GeoJSON either way.
 */

import vadnerbhairavChandwad from "@/data/cadastral/vadnerbhairav-chandwad.json";

interface StoredFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

interface CadastralDataset {
  slug: string;
  features: StoredFeature[];
}

const DATASETS: CadastralDataset[] = [
  {
    slug: "vadnerbhairav-chandwad",
    ...(vadnerbhairavChandwad as unknown as Omit<CadastralDataset, "slug">),
  },
];

export interface ParcelQuery {
  bbox: [number, number, number, number];
  village?: string | undefined;
  surveyNumber?: string | undefined;
  parcelId?: string | undefined;
}

// A whole village (2,457 plots) fits in one map viewport request
const MAX_FEATURES = 3000;
const MAX_SPAN_DEG = 2;

function featureBounds(feature: StoredFeature): [number, number, number, number] | null {
  const ring = feature.geometry.coordinates[0];
  if (!ring || ring.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const pt of ring) {
    const x = pt?.[0];
    const y = pt?.[1];
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0)) return null;
  return [x0, y0, x1, y1];
}

function overlaps(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function matches(value: unknown, wanted?: string): boolean {
  if (!wanted) return true;
  return typeof value === "string" && value.toLowerCase() === wanted.toLowerCase();
}

export function queryParcels(query: ParcelQuery): {
  type: "FeatureCollection";
  features: StoredFeature[];
} {
  const [x0, y0, x1, y1] = query.bbox;
  const features: StoredFeature[] = [];
  for (const dataset of DATASETS) {
    for (const feature of dataset.features) {
      if (features.length >= MAX_FEATURES) break;
      const bounds = featureBounds(feature);
      if (!bounds || !overlaps(bounds, [x0, y0, x1, y1])) continue;
      const props = feature.properties;
      if (!matches(props["village"], query.village)) continue;
      if (!matches(props["surveyNumber"], query.surveyNumber)) continue;
      if (!matches(props["parcelId"], query.parcelId)) continue;
      features.push(feature);
    }
  }
  return { type: "FeatureCollection", features };
}

export function datasetSlugs(): string[] {
  return DATASETS.map((d) => d.slug ?? "unknown");
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/** GET /api/parcels?bbox=minLon,minLat,maxLon,maxLat[&village=…&surveyNumber=…&parcelId=…] */
export function handleParcelsApi(request: Request): Response {
  const url = new URL(request.url);
  const bboxParam = url.searchParams.get("bbox");
  if (!bboxParam) return badRequest("Missing required bbox=minLon,minLat,maxLon,maxLat");
  const parts = bboxParam.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return badRequest("Invalid bbox; expected four finite numbers");
  }
  const [x0, y0, x1, y1] = parts as [number, number, number, number];
  if (x0 >= x1 || y0 >= y1) return badRequest("Invalid bbox ordering");
  if (x1 - x0 > MAX_SPAN_DEG || y1 - y0 > MAX_SPAN_DEG) {
    return badRequest(`bbox span capped at ${MAX_SPAN_DEG} degrees per request`);
  }
  const result = queryParcels({
    bbox: [x0, y0, x1, y1],
    village: url.searchParams.get("village") ?? undefined,
    surveyNumber: url.searchParams.get("surveyNumber") ?? undefined,
    parcelId: url.searchParams.get("parcelId") ?? undefined,
  });
  return Response.json(result, {
    headers: {
      "X-Data-Source": "NIRVANA cadastral import",
      "X-Datasets": datasetSlugs().join(","),
      "Cache-Control": "public, max-age=300",
    },
  });
}
