/**
 * Data / GIS layer for the Copilot — executes a validated QueryPlan against the
 * datasets the platform actually has, and says plainly when one isn't connected.
 *
 * Every result carries a provenance tag so the UI (and the LLM prompt) can keep
 * platform data, demo/model data and missing integrations apart:
 *   live        real external data (Sentinel-2 cloudless tiles, OSM parcels)
 *   platform    data imported into this platform (cadastral extract)
 *   demo        demonstration model / placeholder figures — never official
 *   reference   demo research & policy catalogue
 *   document    verbatim text of real Acts / policies (Policy Lab library)
 *   unavailable integration interface exists, API not connected yet
 *
 * To plug in a real API, replace the matching `run*` function; the result shape stays.
 */

import {
  ALL_INDIA,
  LAND_CLASS_ORDER,
  STATE_AREA_KM2,
  STATE_NAMES,
  ZERO_DELTAS,
  regionOutcome,
  scenarioFlows,
  type LandClass,
} from "@/data/land-scenario";
import { STATE_STATS } from "@/data/state-intelligence";
import { POLICIES, searchCatalogue } from "@/data/research-hub";
import { queryParcels } from "./parcel-store";
import {
  libraryOverview,
  primaryIndicators,
  searchPolicies,
  type PolicyQuote,
} from "./policy-context";
import type { DatasetId, LandClassName, Place, QueryPlan } from "@/copilot/plan";

export type Provenance = "live" | "platform" | "demo" | "reference" | "document" | "unavailable";

export interface DataResult {
  dataset: DatasetId;
  label: string;
  provenance: Provenance;
  region: string | null;
  headline: string;
  rows?: { label: string; value: string; emphasis?: boolean }[];
  table?: { columns: string[]; rows: string[][] };
  source: string;
  note?: string | undefined;
  /** verbatim excerpts from real documents (policy_library only) */
  quotes?: PolicyQuote[] | undefined;
}

export interface EvidenceItem {
  label: string;
  detail: string;
  provenance: Provenance | "ai";
}

const CLASS_TO_MODEL: Record<LandClassName, LandClass> = {
  agriculture: "agri",
  forest: "forest",
  built_up: "built",
  water: "water",
  barren: "barren",
  other: "other",
};
const CLASS_LABEL: Record<LandClass, string> = {
  agri: "Agriculture",
  forest: "Forest",
  built: "Built-up",
  water: "Water",
  barren: "Barren",
  other: "Other",
};

const fmt = (v: number, d = 1) => v.toFixed(d);
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-IN");
const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`;

const regionOf = (p: Place | null) =>
  p?.state && STATE_NAMES.includes(p.state) ? p.state : ALL_INDIA;
const areaOf = (region: string) =>
  region === ALL_INDIA
    ? STATE_NAMES.reduce((s, n) => s + (STATE_AREA_KM2[n] ?? 0), 0)
    : (STATE_AREA_KM2[region] ?? 0);

// ---------------------------------------------------------------------------

function runLulc(plan: QueryPlan, place: Place | null): DataResult {
  const region = regionOf(place);
  const from = String(plan.from_year ?? 2018);
  const to = String(plan.to_year ?? 2024);
  const a = regionOutcome(region, from, ZERO_DELTAS).baseline.shares;
  const b = regionOutcome(region, to, ZERO_DELTAS).baseline.shares;
  const area = areaOf(region);
  const flows = scenarioFlows(a, {
    built: b.built - a.built,
    forest: b.forest - a.forest,
    water: b.water - a.water,
    agri: 0,
  }).sort((x, y) => y.pp - x.pp);
  const fromC = plan.from_class ? CLASS_TO_MODEL[plan.from_class] : null;
  const toC = plan.to_class ? CLASS_TO_MODEL[plan.to_class] : null;
  const focus = flows.filter((f) => (!fromC || f.from === fromC) && (!toC || f.to === toC));
  const km2 = (pp: number) => (pp / 100) * area;
  const where = region === ALL_INDIA ? "India" : region;

  if (plan.intent === "land_use_change" || plan.operation === "trend") {
    const total = focus.reduce((s, f) => s + f.pp, 0);
    const label =
      fromC || toC
        ? `${fromC ? CLASS_LABEL[fromC] : "Any class"} → ${toC ? CLASS_LABEL[toC] : "any class"}`
        : "All transitions";
    return {
      dataset: "lulc",
      label: `Land-use change · ${where} · ${from}→${to}`,
      provenance: "demo",
      region,
      headline:
        focus.length > 0
          ? `${label}: about ${fmtInt(km2(total))} km² (${fmt(total, 2)}% of ${where}) between ${from} and ${to}.`
          : `No ${label.toLowerCase()} transition appears in the model for ${where} between ${from} and ${to}.`,
      table: {
        columns: ["Transition", "% of area", "≈ km²"],
        rows: (focus.length ? focus : flows)
          .slice(0, 5)
          .map((f) => [
            `${CLASS_LABEL[f.from]} → ${CLASS_LABEL[f.to]}`,
            fmt(f.pp, 2),
            fmtInt(km2(f.pp)),
          ]),
      },
      rows: LAND_CLASS_ORDER.slice(0, 4).map((c) => ({
        label: `${CLASS_LABEL[c]} share`,
        value: `${fmt(a[c])}% → ${fmt(b[c])}% (${signed(b[c] - a[c], 2)} pp)`,
        emphasis: c === fromC || c === toC,
      })),
      source: "Nirvana land-use model (demonstration, calibrated to state-level shares)",
      note:
        place && place.name !== region && region !== ALL_INDIA
          ? `${place.name} is summarised at ${region} state level — district-level land-use statistics aren't loaded yet.`
          : undefined,
    };
  }

  return {
    dataset: "lulc",
    label: `Land-use mix · ${where} · ${to}`,
    provenance: "demo",
    region,
    headline: `In ${to}, ${where} is about ${fmt(b.agri, 0)}% agriculture, ${fmt(b.forest, 0)}% forest and ${fmt(b.built, 1)}% built-up.`,
    rows: LAND_CLASS_ORDER.map((c) => ({ label: CLASS_LABEL[c], value: `${fmt(b[c])}%` })),
    source: "Nirvana land-use model (demonstration)",
  };
}

function runSatellite(plan: QueryPlan): DataResult {
  const years = [plan.from_year, plan.to_year].filter((y): y is number => y != null);
  return {
    dataset: "satellite",
    label: "Sentinel-2 imagery",
    provenance: "live",
    region: null,
    headline: `Cloud-free Sentinel-2 mosaics are available for ${years.length ? years.join(" and ") : "2018–2024"} and can be compared on the map.`,
    source: "Sentinel-2 cloudless mosaics by EOX (Copernicus data), 10 m",
  };
}

function runCadastral(place: Place | null): DataResult {
  if (!place || place.lat == null || place.lon == null) {
    return {
      dataset: "cadastral",
      label: "Parcel boundaries",
      provenance: "live",
      region: null,
      headline:
        "Parcel footprints load on the map around any place you open (OpenStreetMap), with imported cadastral extracts where available.",
      source: "OpenStreetMap land-use polygons · platform cadastral store",
    };
  }
  const d = 0.02;
  const fc = queryParcels({ bbox: [place.lon - d, place.lat - d, place.lon + d, place.lat + d] });
  const n = fc.features.length;
  return n > 0
    ? {
        dataset: "cadastral",
        label: `Cadastral extract · ${place.name}`,
        provenance: "platform",
        region: place.state,
        headline: `${n} imported parcel boundaries lie within about 2 km of ${place.name}; they are highlighted on the map.`,
        source: "Platform cadastral store (imported extract)",
      }
    : {
        dataset: "cadastral",
        label: `Parcel boundaries · ${place.name}`,
        provenance: "live",
        region: place.state,
        headline: `No imported cadastral extract covers ${place.name}; parcel footprints are loaded live from OpenStreetMap when the map opens there.`,
        source: "OpenStreetMap land-use polygons (not a legal cadastral record)",
      };
}

function runStateStat(
  dataset: "disputes" | "climate" | "socio_economic",
  place: Place | null,
): DataResult {
  const region = regionOf(place);
  const entries = Object.entries(STATE_STATS);
  if (region === ALL_INDIA) {
    const top = [...entries]
      .sort((a, b) =>
        dataset === "disputes"
          ? b[1].disputes - a[1].disputes
          : dataset === "climate"
            ? b[1].riskLevel - a[1].riskLevel || b[1].highRiskDistricts - a[1].highRiskDistricts
            : b[1].socio - a[1].socio,
      )
      .slice(0, 5);
    const label =
      dataset === "disputes"
        ? "Active land disputes"
        : dataset === "climate"
          ? "Climate vulnerability"
          : "Vulnerable households";
    return {
      dataset,
      label: `${label} · national`,
      provenance: "demo",
      region: ALL_INDIA,
      headline: `Highest ${label.toLowerCase()}: ${top
        .map(([n]) => n)
        .slice(0, 3)
        .join(", ")}.`,
      table: {
        columns: [
          "State",
          dataset === "disputes"
            ? "Disputes"
            : dataset === "climate"
              ? "Risk · high-risk districts"
              : "% vulnerable",
        ],
        rows: top.map(([n, s]) => [
          n,
          dataset === "disputes"
            ? fmtInt(s.disputes)
            : dataset === "climate"
              ? `${s.risk} · ${s.highRiskDistricts}`
              : `${fmt(s.socio)}%`,
        ]),
      },
      source: "Nirvana state intelligence snapshot (demo data)",
    };
  }
  const s = STATE_STATS[region];
  if (!s) {
    return {
      dataset,
      label: region,
      provenance: "unavailable",
      region,
      headline: `No ${dataset.replace("_", "-")} snapshot is loaded for ${region}.`,
      source: "—",
    };
  }
  const rank = (get: (x: (typeof entries)[number][1]) => number) =>
    [...entries].sort((a, b) => get(b[1]) - get(a[1])).findIndex(([n]) => n === region) + 1;
  if (dataset === "disputes") {
    return {
      dataset,
      label: `Land disputes · ${region}`,
      provenance: "demo",
      region,
      headline: `${region} has about ${fmtInt(s.disputes)} active land disputes in the snapshot (rank ${rank((x) => x.disputes)} of ${entries.length}).`,
      rows: [
        { label: "Active disputes", value: fmtInt(s.disputes) },
        { label: "National rank", value: `${rank((x) => x.disputes)} / ${entries.length}` },
      ],
      source: "Nirvana dispute aggregates (demo data)",
      note: "Case-level dispute records (court / revenue) aren't connected yet.",
    };
  }
  if (dataset === "climate") {
    return {
      dataset,
      label: `Climate risk · ${region}`,
      provenance: "demo",
      region,
      headline: `${region} is rated ${s.risk} climate vulnerability with ${s.highRiskDistricts} high-risk districts in the snapshot.`,
      rows: [
        { label: "Vulnerability", value: s.risk },
        { label: "High-risk districts", value: String(s.highRiskDistricts) },
      ],
      source:
        "Nirvana climate vulnerability layer (demo) · live IMD weather available on the Dashboard",
    };
  }
  return {
    dataset,
    label: `Socio-economic · ${region}`,
    provenance: "demo",
    region,
    headline: `About ${fmt(s.socio)}% of households in ${region} are classed as vulnerable in the snapshot.`,
    rows: [
      { label: "Vulnerable households", value: `${fmt(s.socio)}%` },
      { label: "Land-use change since 2015", value: `+${fmt(s.change)}%` },
    ],
    source: "Nirvana socio-economic overlay (demo data)",
  };
}

function runResearch(plan: QueryPlan, query: string, place: Place | null): DataResult {
  const q = [query, plan.topic, place?.state].filter(Boolean).join(" ");
  const res = searchCatalogue(q);
  const papers = res.papers.slice(0, 3);
  const policies = POLICIES.filter(
    (p) => !place?.state || p.jurisdiction === place.state || p.jurisdiction === "India",
  )
    .filter((p) => res.policies.some((r) => r.id === p.id))
    .slice(0, 3);
  return {
    dataset: "research_policy",
    label: "Research & policy catalogue",
    provenance: "reference",
    region: place?.state ?? null,
    headline:
      papers.length || policies.length
        ? `${papers.length} studies and ${policies.length} policy documents in the catalogue match this question.`
        : "No catalogue items match this question yet.",
    rows: [
      ...papers.map((p) => ({
        label: `Study · ${p.year}`,
        value: `${p.title} — ${p.institution}`,
      })),
      ...policies.map((p) => ({ label: "Policy / law", value: p.title })),
    ],
    source: "Nirvana Research Hub catalogue (demonstration records)",
  };
}

/** Real Acts & policies from the Policy Lab library, with verbatim clause-level quotes. */
function runPolicyLibrary(plan: QueryPlan, query: string): DataResult {
  const matches = searchPolicies([query, plan.topic].filter(Boolean).join(" "));
  if (!matches.length) {
    const lib = libraryOverview();
    return {
      dataset: "policy_library",
      label: "Policy Lab library",
      provenance: "document",
      region: "Maharashtra",
      headline: `No instrument in the Policy Lab library matches this question. The library holds ${lib.length} Maharashtra and national instruments.`,
      table: {
        columns: ["Instrument", "Domain", "Year"],
        rows: lib.map((p) => [p.name, p.domain, String(p.year)]),
      },
      source: "Policy Lab library — Acts & policies read from their source PDFs",
    };
  }
  const quotes = matches.flatMap((m) => m.quotes.slice(0, m === matches[0] ? 3 : 1));
  const top = matches[0]!.policy;
  const inferred = quotes.filter((q) => q.method === "inferred").length;
  return {
    dataset: "policy_library",
    label: `Policy Lab library · ${matches.length} instrument${matches.length > 1 ? "s" : ""}`,
    provenance: "document",
    region: "Maharashtra",
    headline: `${top.name} (${top.sourceDocument.reference}) is the closest match in the Policy Lab library.`,
    rows: matches.map((m) => ({
      label: m.policy.domain,
      value: `${m.policy.name} · tracked in Policy Lab: ${primaryIndicators(m.policy).slice(0, 3).join(", ") || "—"}`,
      emphasis: m === matches[0],
    })),
    quotes,
    source: "Policy Lab library — Acts & policies read from their source PDFs",
    note: inferred
      ? `${inferred} excerpt${inferred > 1 ? "s back" : " backs"} a Policy Lab modelling value that the document itself doesn’t state.`
      : undefined,
  };
}

const notConnected = (dataset: DatasetId, label: string, where: string): DataResult => ({
  dataset,
  label,
  provenance: "unavailable",
  region: null,
  headline: `${label} isn't connected to the platform yet — verify at ${where}.`,
  source: "Integration interface ready; API not connected",
});

// Regional datasets are only loaded at state level: say so when the user asked about a city or district
function scopeNote(r: DataResult, place: Place | null): DataResult {
  if (!place || !r.region || r.region === ALL_INDIA) return r;
  if (place.name.toLowerCase() === r.region.toLowerCase()) return r;
  const note = `State-level figure for all of ${r.region} — ${place.name}-level data isn't loaded yet.`;
  return { ...r, label: `${r.label} (state-level)`, note: r.note ? `${note} ${r.note}` : note };
}

export function executePlan(plan: QueryPlan, query: string): DataResult[] {
  const out: DataResult[] = [];
  const places = [plan.location, plan.compare_with].filter((p): p is Place => !!p);
  // Two places in the same state share one state-level figure — compute it once and say why
  const seenRegions = new Set<string>();
  const targets = (places.length ? places : [null]).filter((p) => {
    const region = regionOf(p);
    if (seenRegions.has(region)) {
      out.push({
        dataset: "lulc",
        label: `Comparison limit · ${p?.name}`,
        provenance: "unavailable",
        region,
        headline: `${places.map((x) => x.name).join(" and ")} are both in ${region}; regional data is only loaded at state level, so they can't be compared separately yet.`,
        source: "District-level datasets not connected",
      });
      return false;
    }
    seenRegions.add(region);
    return true;
  });
  for (const ds of plan.datasets) {
    switch (ds) {
      case "lulc":
        targets.forEach((p) => out.push(scopeNote(runLulc(plan, p), p)));
        break;
      case "satellite":
        out.push(runSatellite(plan));
        break;
      case "cadastral":
        out.push(runCadastral(plan.location));
        break;
      case "disputes":
      case "climate":
      case "socio_economic":
        targets.forEach((p) => out.push(scopeNote(runStateStat(ds, p), p)));
        break;
      case "research_policy":
        out.push(runResearch(plan, query, plan.location));
        break;
      case "policy_library":
        out.push(runPolicyLibrary(plan, query));
        break;
      case "land_records":
        out.push(
          notConnected(
            "land_records",
            "Record of rights (7/12, Bhulekh)",
            "the state land-records portal (e.g. MahaBhumi / Bhulekh)",
          ),
        );
        break;
      case "registration":
        out.push(
          notConnected(
            "registration",
            "Registration & revenue records",
            "the state IGR registration portal",
          ),
        );
        break;
    }
  }
  return out;
}

/** Evidence list built from the data results — never from the LLM. */
export function evidenceFor(results: DataResult[]): EvidenceItem[] {
  const seen = new Set<string>();
  const items: EvidenceItem[] = [];
  for (const r of results) {
    // one evidence line per cited clause, so every quote in the answer is traceable
    if (r.quotes?.length) {
      for (const q of r.quotes) {
        const label = `${q.shortName} — ${q.clause}${q.page ? `, p. ${q.page}` : ""}`;
        if (seen.has(label)) continue;
        seen.add(label);
        items.push({
          label,
          detail: `${q.method === "inferred" ? "Modelling value, not stated in the text" : q.method === "derived" ? "Derived from the text" : "Verbatim text"}${q.sourceFile ? ` · ${q.sourceFile}` : ""}`,
          provenance: "document",
        });
      }
      continue;
    }
    const key = `${r.source}|${r.provenance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ label: r.source, detail: r.label, provenance: r.provenance });
  }
  return items;
}
