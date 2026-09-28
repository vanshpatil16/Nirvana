/**
 * State-aware cadastral provider registry.
 *
 * Resolves `getParcelProvider(state, district, taluka)` to real, licensed
 * cadastral geometry endpoints — vector-tile releases from
 * ramSeraph/indian_cadastrals served by indianopenmaps.com (CC0, upstream
 * provenance documented per release).
 *
 * HOUSE RULES
 * - Only genuine cadastral releases (state land-record / remote-sensing
 *   portals) are listed. OpenStreetMap landuse polygons are NEVER cadastral
 *   and live in parcelService.ts under their own class.
 * - `fields: null` means the layer's attribute schema has not been verified
 *   here — identifiers from such layers must never be quoted as survey
 *   numbers.
 * - States with no verified public cadastral release return null; the UI
 *   must then say "no verified public cadastral geometry" rather than
 *   falling back to anything OSM.
 * - Raster-mosaic releases are recorded (so coverage is honest) but never
 *   wired: they carry no queryable attributes.
 */

import type { ReliabilityClass } from "@/data/data-sources";

const TILE_BASE = "https://indianopenmaps.com";
const VERIFIED_ON = "2026-09-27";

export type CadastreFormat = "vector" | "raster";

export interface CadastreLayer {
  /** Short id, e.g. "mrsac", "ncscm-coastal". */
  id: string;
  label: string;
  /** Path on indianopenmaps.com, always ending with "/". */
  tilePath: string;
  format: CadastreFormat;
  /** Geographic scope of this layer inside the state. */
  scope: string;
  /** Verified attribute names, null when the schema has not been checked here. */
  fields: string[] | null;
  /** District names this overlay covers (district-specific releases). */
  districts?: string[];
  note?: string;
}

export interface CadastreProvider {
  /** Slug of the state release, e.g. "maharashtra". */
  id: string;
  /** Display name exactly as the map's india-states.json uses it. */
  stateName: string;
  /** Other display names that should resolve to this release. */
  aliases: string[];
  label: string;
  primary: CadastreLayer;
  overlays: CadastreLayer[];
  /** Honest coverage statement — partial coverage is stated, never glossed. */
  coverage: string;
  /** What can and cannot be identified on this layer. */
  identifierNote: string;
  license: string;
  provider: string;
  upstream: string;
  reliabilityClass: ReliabilityClass;
  verifiedOn: string;
}

/** Vector-tile template for MapLibre (`{z}/{x}/{y}` substituted client-side). */
export function tileUrl(layer: CadastreLayer): string {
  return `${TILE_BASE}${layer.tilePath}{z}/{x}/{y}.pbf`;
}

/** TileJSON endpoint (bounds, zooms, attribution, vector-layer schema). */
export function tileJsonUrl(layer: CadastreLayer): string {
  return `${TILE_BASE}${layer.tilePath}tiles.json`;
}

/**
 * Vector-layer ids inside the tiles (MapLibre requires `source-layer` on every
 * layer it draws from a vector source; without it the style silently drops the
 * layer). Read from the release's own TileJSON so the name can never drift
 * from what the tiles actually carry. Empty array = upstream unavailable.
 */
export async function vectorLayerIds(layer: CadastreLayer): Promise<string[]> {
  return vectorLayerIdsFromUrl(tileJsonUrl(layer));
}

/** Same lookup for any TileJSON URL (WRIS/NDEM overlays use this directly). */
export async function vectorLayerIdsFromUrl(url: string): Promise<string[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { vector_layers?: { id?: string }[] };
    return (json.vector_layers ?? []).map((v) => v.id).filter((id): id is string => !!id);
  } catch {
    return [];
  }
}

const CC0 = "CC0 1.0 (Datameet aggregation; attribution requested to Datameet + upstream agency)";
const SERVED_BY = "indianopenmaps.com (Datameet)";

function vector(id: string, label: string, tilePath: string, scope: string, fields: string[] | null, extra?: Partial<CadastreLayer>): CadastreLayer {
  return { id, label, tilePath, format: "vector", scope, fields, ...extra };
}

function raster(id: string, label: string, tilePath: string, scope: string): CadastreLayer {
  return { id, label, tilePath, format: "raster", scope, fields: null, note: "Raster mosaic upstream — no queryable attributes; not connected here." };
}

const MRSAC_FIELDS = ["OBJECTID", "DTNCODE", "DTENAME", "THNCODE", "THENAME", "VINCODE", "VIL_NAME", "CCODE", "PIN", "REMARK"];
const NCSCM_FIELDS = ["Survey_Number", "Village", "Taluk", "District"];

const NO_SCHEMA_NOTE =
  "Attribute schema not verified in this session — identifiers from this layer are unverified and must never be quoted as survey numbers.";

function provider(
  id: string,
  stateName: string,
  label: string,
  primary: CadastreLayer,
  coverage: string,
  identifierNote: string,
  overlays: CadastreLayer[] = [],
  aliases: string[] = [],
): CadastreProvider {
  return {
    id,
    stateName,
    aliases,
    label,
    primary,
    overlays,
    coverage,
    identifierNote,
    license: CC0,
    provider: SERVED_BY,
    upstream: "State land-record / remote-sensing portals via ramSeraph/indian_cadastrals",
    reliabilityClass: "C",
    verifiedOn: VERIFIED_ON,
  };
}

// ---------------------------------------------------------------------------
// Releases (27 states/UTs; 24 vector, 3 raster-only primaries)
// ---------------------------------------------------------------------------

const P_COASTAL = "Coastal strip only (NCSCM district layer).";

export const CADASTRE_PROVIDERS: CadastreProvider[] = [
  provider(
    "maharashtra",
    "Maharashtra",
    "MRSAC cadastre",
    vector("mrsac", "MRSAC cadastre", "/not-so-open/cadastrals/maharashtra/mrsac/", "Statewide bounds 72.65–80.90 E, 15.61–22.03 N", MRSAC_FIELDS),
    "Statewide tile coverage; publisher states no completeness gap for this release, but overall completeness is unverified. Verified empirically over Nanded (z13 tiles, ~710 parcels per tile, DTENAME=Nanded).",
    "No survey-number attribute. Plots identify via village name (VIL_NAME), village/plot codes (CCODE, PIN) and admin codes (DTENAME/THENAME).",
    [
      vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/maharashtra/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS, {
        note: "Carries Survey_Number — coastal districts only.",
      }),
    ],
  ),
  provider(
    "gujarat",
    "Gujarat",
    "NCOG cadastre",
    vector("ncog", "NCOG cadastre", "/not-so-open/cadastrals/gujarat/ncog/", "Statewide (NCOG)", null),
    "NCOG statewide layer; the VEDAS layer covers only two talukas; Matribhoomi and NCSCM coastal layers also available upstream.",
    NO_SCHEMA_NOTE,
    [
      vector("vedas", "VEDAS cadastre", "/not-so-open/cadastrals/gujarat/vedas/", "Two talukas only", null),
      vector("matribhoomi", "Matribhoomi cadastre", "/not-so-open/cadastrals/gujarat/matribhoomi/", "Matribhoomi coverage", null),
      vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/gujarat/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS),
    ],
  ),
  provider(
    "karnataka",
    "Karnataka",
    "KGISMAPS cadastre",
    vector("kgismaps", "KGISMAPS cadastre", "/not-so-open/cadastrals/karnataka/kgismaps/", "Statewide (KGISMAPS)", null),
    "Statewide KGISMAPS layer; NCSCM coastal layer also available upstream.",
    NO_SCHEMA_NOTE,
    [vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/karnataka/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS)],
  ),
  provider(
    "kerala",
    "Kerala",
    "Bhuvan cadastre",
    vector("bhuvan", "Bhuvan cadastre", "/not-so-open/cadastrals/kerala/bhuvan/", "Statewide (Bhuvan)", null),
    "Bhuvan statewide layer; LSGDP urban and NCSCM coastal layers also available upstream.",
    NO_SCHEMA_NOTE,
    [
      vector("lsgdp-urban", "LSGDP urban cadastre", "/not-so-open/cadastrals/kerala/urban/lsgdp/", "Urban local bodies", null),
      vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/kerala/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS),
    ],
  ),
  provider(
    "tamil-nadu",
    "Tamil Nadu",
    "TNGIS cadastre",
    vector("tngis", "TNGIS cadastre", "/not-so-open/cadastrals/tamil-nadu/tngis/", "Statewide (TNGIS)", null),
    "Statewide TNGIS layer; NCSCM coastal layer also available upstream.",
    NO_SCHEMA_NOTE,
    [vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/tamil-nadu/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS)],
  ),
  provider(
    "telangana",
    "Telangana",
    "Bhunaksha (TRACGIS) cadastre",
    vector("tracgis", "Bhunaksha cadastre", "/not-so-open/cadastrals/telangana/bhunaksha/tracgis/", "Statewide (TRACGIS)", [
      "Parcel_num",
      "SNo",
      "V_Name",
      "New_Villagename",
      "New_Mandal",
      "New_District",
      "New_Revenue_Division",
      "Classification_code",
    ]),
    "Statewide Telangana Bhunaksha-derived layer (TRACGIS).",
    "Carries plot identifiers (Parcel_num, SNo) and village/mandal/district names. Still not the register of rights — verify against the official Dharani record before legal use.",
  ),
  provider(
    "andhra-pradesh",
    "Andhra Pradesh",
    "APSAC cadastre",
    vector("apsac", "APSAC cadastre", "/not-so-open/cadastrals/andhra-pradesh/apsac/", "Statewide (APSAC)", null),
    "APSAC statewide layer; forest and NCSCM coastal layers also available upstream.",
    NO_SCHEMA_NOTE,
    [
      vector("forest", "APSAC forest cadastre", "/not-so-open/cadastrals/andhra-pradesh/forest/apsac/", "Forest areas", null),
      vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/andhra-pradesh/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS),
    ],
  ),
  provider(
    "punjab",
    "Punjab",
    "PunjabGIS cadastre",
    vector("punjabgis", "PunjabGIS cadastre", "/not-so-open/cadastrals/punjab/punjabgis/", "Statewide (PunjabGIS)", null),
    "PARTIAL — publisher flags only parts of 6 districts covered. NCOG layer also available upstream.",
    NO_SCHEMA_NOTE,
    [
      vector("ncog", "NCOG cadastre", "/not-so-open/cadastrals/punjab/ncog/", "NCOG coverage", null),
      vector("ncog-jalandhar", "NCOG Jalandhar cadastre", "/not-so-open/cadastrals/punjab/jalandhar/ncog/", "Jalandhar district", null, {
        districts: ["Jalandhar"],
      }),
    ],
  ),
  provider(
    "bihar",
    "Bihar",
    "Matribhoomi cadastre",
    vector("matribhoomi", "Matribhoomi cadastre", "/not-so-open/cadastrals/bihar/matribhoomi/", "Matribhoomi coverage", null),
    "Matribhoomi coverage; NCOG and NBSS/Bhoomi layers also available upstream.",
    NO_SCHEMA_NOTE,
    [
      vector("ncog", "NCOG cadastre", "/not-so-open/cadastrals/bihar/ncog/", "NCOG coverage", null),
      vector("nbss", "NBSS / Bhoomi cadastre", "/not-so-open/cadastrals/bihar/nbss/", "NBSS coverage", null),
    ],
  ),
  provider(
    "haryana",
    "Haryana",
    "HRSAC cadastre",
    vector("hrsac", "HRSAC cadastre", "/not-so-open/cadastrals/haryana/hrsac/", "Statewide (HRSAC)", null),
    "Statewide HRSAC layer.",
    NO_SCHEMA_NOTE,
  ),
  provider(
    "uttar-pradesh",
    "Uttar Pradesh",
    "NCOG cadastre",
    vector("ncog", "NCOG cadastre", "/not-so-open/cadastrals/uttar-pradesh/ncog/", "Partial — 34 districts", null),
    "PARTIAL — publisher states only 34 districts are partly or fully covered.",
    NO_SCHEMA_NOTE,
  ),
  provider(
    "jammu-and-kashmir",
    "Jammu and Kashmir",
    "LRIS Khasra cadastre",
    vector("lris-khasra", "LRIS Khasra cadastre", "/not-so-open/cadastrals/jammu-and-kashmir/khasras/lris/", "Khasra coverage", null),
    "LRIS Khasra/ULPIN layers; Matribhoomi layer covers Jammu West only.",
    NO_SCHEMA_NOTE,
    [
      vector("lris-ulpin", "LRIS ULPIN cadastre", "/not-so-open/cadastrals/jammu-and-kashmir/ulpins/lris/", "ULPIN coverage", null),
      vector("matribhoomi", "Matribhoomi cadastre", "/not-so-open/cadastrals/jammu-and-kashmir/matribhoomi/", "Jammu West only", null),
    ],
  ),
  provider(
    "west-bengal",
    "West Bengal",
    "Bhuvan cadastre",
    vector("bhuvan", "Bhuvan cadastre", "/not-so-open/cadastrals/west-bengal/bhuvan/", "Nalhati-I block only", null),
    "PARTIAL — the Bhuvan layer covers only Nalhati-I block; SISDP and AMRUT urban layers are separate coverages.",
    NO_SCHEMA_NOTE,
    [
      vector("sisdp", "Bhuvan SISDP cadastre", "/not-so-open/cadastrals/west-bengal/sisdp/bhuvan/", "SISDP coverage", null),
      vector("wb-amrut-urban", "WB AMRUT urban cadastre", "/not-so-open/cadastrals/west-bengal/urban/wb-amrut/", "Urban wards", null),
    ],
  ),
  provider(
    "chhattisgarh",
    "Chhattisgarh",
    "Bhuvan cadastre",
    vector("bhuvan", "Bhuvan cadastre", "/not-so-open/cadastrals/chhattisgarh/bhuvan/", "Jashpur + Kanker only", null),
    "PARTIAL — publisher states only Jashpur and Kanker districts are covered by the Bhuvan layer.",
    NO_SCHEMA_NOTE,
    [vector("dhamtari", "NCOG Dhamtari cadastre", "/not-so-open/cadastrals/chhattisgarh/dhamtari/ncog/", "Dhamtari district", null, { districts: ["Dhamtari"] })],
  ),
  provider(
    "goa",
    "Goa",
    "Bhunaksha cadastre",
    vector("bhunaksha", "Bhunaksha cadastre", "/not-so-open/cadastrals/goa/bhunaksha/", "Statewide (Bhunaksha)", null),
    "Statewide Bhunaksha layer; OneMapGoaGIS (Apr 2025 + Mar 2026) and NBSS layers also available upstream.",
    NO_SCHEMA_NOTE,
    [
      vector("onemap", "OneMapGoaGIS cadastre", "/not-so-open/cadastrals/goa/onemapgoagis/", "Apr 2025 snapshot", null),
      vector("onemap-2026", "OneMapGoaGIS cadastre", "/not-so-open/cadastrals/goa/mar2026/onemapgoagis/", "Mar 2026 snapshot", null),
      vector("nbss", "NBSS / Bhoomi cadastre", "/not-so-open/cadastrals/goa/nbss/", "NBSS coverage", null),
    ],
  ),
  provider(
    "assam",
    "Assam",
    "Bhuvan cadastre",
    vector("bhuvan", "Bhuvan cadastre", "/not-so-open/cadastrals/assam/bhuvan/", "Incomplete coverage", null),
    "PARTIAL — publisher flags this release as incomplete.",
    NO_SCHEMA_NOTE,
  ),
  provider(
    "manipur",
    "Manipur",
    "MARSAC cadastre",
    vector("marsac", "MARSAC cadastre", "/not-so-open/cadastrals/manipur/marsac/", "Statewide (MARSAC)", null),
    "Statewide MARSAC layer.",
    NO_SCHEMA_NOTE,
  ),
  provider(
    "tripura",
    "Tripura",
    "NESDR cadastre",
    vector("nesdr", "NESDR cadastre", "/not-so-open/cadastrals/tripura/nesdr/", "Statewide (NESDR)", null),
    "NESDR statewide layer; Matribhoomi layer also available upstream.",
    NO_SCHEMA_NOTE,
    [vector("matribhoomi", "Matribhoomi cadastre", "/not-so-open/cadastrals/tripura/matribhoomi/", "Matribhoomi coverage", null)],
  ),
  provider(
    "delhi",
    "Delhi",
    "GSDL cadastre",
    vector("gsdl", "GSDL cadastre", "/not-so-open/cadastrals/delhi/urban/gsdl/", "Urban (GSDL)", null),
    "Urban cadastre layer for Delhi (GSDL).",
    NO_SCHEMA_NOTE,
  ),
  provider(
    "madhya-pradesh",
    "Madhya Pradesh",
    "MPBhulekh plot cadastre",
    vector("mpbhulekh-plots", "MPBhulekh plot cadastre", "/not-so-open/cadastrals/madhya-pradesh/plots/mpbhulekh/", "Statewide plots (MPBhulekh)", null),
    "MPBhulekh plot layer is the connected vector release; MPSSDI and MPBhulekh survey layers exist upstream only as raster mosaics.",
    NO_SCHEMA_NOTE,
    [
      raster("mpssdi", "MPSSDI cadastre", "/not-so-open/cadastrals/madhya-pradesh/mpssdi/", "Statewide (raster)"),
      raster("mpbhulekh-surveys", "MPBhulekh survey cadastre", "/not-so-open/cadastrals/madhya-pradesh/surveys/mpbhulekh/", "Statewide (raster)"),
    ],
  ),
  provider(
    "rajasthan",
    "Rajasthan",
    "NCOG cadastre (raster)",
    raster("ncog", "NCOG cadastre", "/not-so-open/cadastrals/rajasthan/ncog/", "Statewide (raster mosaic)"),
    "Available upstream as a raster mosaic only — no queryable vector geometry; not connected here. Publisher's completeness issue remains open.",
    "Raster mosaic: no attributes at all.",
  ),
  provider(
    "jharkhand",
    "Jharkhand",
    "JSAC cadastre (raster)",
    raster("jsac", "JSAC cadastre", "/not-so-open/cadastrals/jharkhand/jsac/", "Statewide (raster mosaic)"),
    "Available upstream as a raster mosaic only — not connected here.",
    "Raster mosaic: no attributes at all.",
  ),
  provider(
    "odisha",
    "Odisha",
    "4kgeo cadastre (raster)",
    raster("4kgeo", "Odisha 4kgeo cadastre", "/not-so-open/cadastrals/odisha/odisha4kgeo/", "Statewide (raster mosaic)"),
    "Available upstream as a raster mosaic only — not connected here.",
    "Raster mosaic: no attributes at all.",
  ),
  provider(
    "pondicherry",
    "Pondicherry",
    "NCSCM coastal cadastre",
    vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/puducherry/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS),
    "Coastal strip only (NCSCM). Puducherry UT release.",
    "Carries Survey_Number, Village, Taluk, District attributes.",
    [],
    ["Puducherry"],
  ),
  provider(
    "lakshadweep",
    "Lakshadweep",
    "Bharatmaps cadastre",
    vector("bharatmaps", "Bharatmaps cadastre", "/not-so-open/cadastrals/lakshadweep/bharatmaps/", "Island group (Bharatmaps)", null),
    "Island coverage; NCSCM coastal layer also available upstream.",
    NO_SCHEMA_NOTE,
    [vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/lakshadweep/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS)],
  ),
  provider(
    "andaman-and-nicobar-islands",
    "Andaman and Nicobar Islands",
    "NCSCM coastal cadastre",
    vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/andaman-and-nicobar/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS),
    "Coastal strip only (NCSCM).",
    "Carries Survey_Number, Village, Taluk, District attributes.",
    [],
    ["Andaman & Nicobar Islands"],
  ),
  provider(
    "dadra-and-nagar-haveli-and-daman-and-diu",
    "Dadra and Nagar Haveli",
    "NCSCM coastal cadastre",
    vector("ncscm-coastal", "NCSCM coastal cadastre", "/not-so-open/cadastrals/dadra-and-nagar-haveli-and-daman-and-diu/coastal/ncscm/", P_COASTAL, NCSCM_FIELDS),
    "Coastal strip only (NCSCM); covers both DNH and Daman & Diu parts of the merged UT.",
    "Carries Survey_Number, Village, Taluk, District attributes.",
    [],
    ["Daman and Diu"],
  ),
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const byName = new Map<string, CadastreProvider>();
for (const p of CADASTRE_PROVIDERS) {
  byName.set(p.stateName.toLowerCase(), p);
  for (const alias of p.aliases) byName.set(alias.toLowerCase(), p);
}

/**
 * State-aware parcel provider resolution.
 *
 * Returns null for states with no verified public cadastral release — callers
 * must render an explicit "no verified public cadastral geometry" state and
 * must NOT substitute OSM polygons as cadastre.
 *
 * `district` and `taluka` refine the layer choice inside a state release
 * (see `cadastreLayerFor`) but never change which upstream release is used.
 */
export function getParcelProvider(
  state?: string | null,
  _district?: string | null,
  _taluka?: string | null,
): CadastreProvider | null {
  if (!state) return null;
  return byName.get(state.trim().toLowerCase()) ?? null;
}

/** Pick the layer for a provider: district-specific overlay when it exists, else the primary layer. */
export function cadastreLayerFor(
  providerOrNull: CadastreProvider | null,
  district?: string | null,
  _taluka?: string | null,
): CadastreLayer | null {
  if (!providerOrNull) return null;
  if (district) {
    const d = district.trim().toLowerCase();
    const match = providerOrNull.overlays.find((o) => o.districts?.some((name) => name.toLowerCase() === d));
    if (match) return match;
  }
  return providerOrNull.primary;
}

/** True when the layer can be rendered as queryable vector geometry. */
export function isWiredLayer(layer: CadastreLayer | null): layer is CadastreLayer {
  return layer !== null && layer.format === "vector";
}

/** States/UTs with a cadastral release registered (any format). */
export function listCadastralStates(): CadastreProvider[] {
  return CADASTRE_PROVIDERS;
}
