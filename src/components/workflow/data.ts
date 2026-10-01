/**
 * NIRVANA evidence workflow — data for the seven story chapters.
 *
 * Every number shown on screen comes from here and matches the SIH
 * consistency sheet exactly. Provenance:
 *   REAL       Esri / Impact Observatory 10 m Annual LULC tiles (2019, 2024),
 *              Sentinel-2 cloudless imagery, Act titles & section numbers
 *   SYNTHETIC  land records (RoR, owners, ULPIN, survey numbers), village
 *              boundaries (tessellation), district panel for DiD
 *   SIMULATED  federation router, XGBoost/SHAP surface, RAGAS score — run in
 *              the browser for the prototype
 */

export const ULPIN = "80471234567890"; // one 14-character numeric format, used everywhere
export const DISTRICT = "Pune, Maharashtra";

export type Lang = "en" | "hi" | "mr";
export type Role = "officer" | "policymaker" | "researcher";

/** Hex mirrors of the site theme tokens, for SVG / MapLibre paint. */
export const C = {
  forest: "#004e2b",
  forestDark: "#00331b",
  forestDeep: "#032110",
  forestSoft: "#c8eccf",
  mint: "#e7f5ea",
  ink: "#15281b",
  muted: "#5b6d64",
  faint: "#8a978f",
  line: "#e3e1d4",
  cream: "#faf8f1",
  paper: "#fffdf8",
  saffron: "#e8891d",
  saffronSoft: "#fdf0dc",
  red: "#c0392b",
  redSoft: "#fbe9e6",
  green: "#1f8a5b",
  greenSoft: "#e3f3ea",
  amber: "#d98b09",
  amberSoft: "#fdf3dc",
  blue: "#2f6f9f",
} as const;

// ---------------------------------------------------------------------------
// Chapters (the 7-step demo story)
// ---------------------------------------------------------------------------

export type ChapterId = "verify" | "ask" | "protect" | "simulate" | "prove" | "capsule" | "loop";

export const CHAPTERS: {
  id: ChapterId;
  verb: Record<Lang, string>;
  title: Record<Lang, string>;
  role: Role;
  /** Data-honesty class of everything shown in this chapter. */
  prov: "real" | "synthetic" | "simulated" | "illustrative" | "model";
}[] = [
  {
    id: "verify",
    verb: { en: "Verify", hi: "सत्यापन", mr: "पडताळणी" },
    title: {
      en: "Find the break before it becomes a dispute",
      hi: "विवाद बनने से पहले गड़बड़ी पकड़ें",
      mr: "वाद होण्याआधी त्रुटी शोधा",
    },
    role: "officer",
    prov: "synthetic",
  },
  {
    id: "ask",
    verb: { en: "Copilot", hi: "कोपायलट", mr: "कोपायलट" },
    title: {
      en: "Ask in your language. Leave with a cited answer.",
      hi: "अपनी भाषा में पूछें, स्रोत सहित उत्तर पाएँ",
      mr: "तुमच्या भाषेत विचारा, संदर्भासह उत्तर मिळवा",
    },
    role: "officer",
    prov: "synthetic",
  },
  {
    id: "protect",
    verb: { en: "Protect", hi: "सुरक्षा", mr: "संरक्षण" },
    title: {
      en: "Query in, aggregates out — no record ever moves",
      hi: "प्रश्न अंदर, केवल समेकित आँकड़े बाहर",
      mr: "प्रश्न आत, फक्त एकत्रित आकडे बाहेर",
    },
    role: "officer",
    prov: "simulated",
  },
  {
    id: "simulate",
    verb: { en: "Simulate", hi: "अनुकरण", mr: "अनुकरण" },
    title: {
      en: "Test the fix before you sign it",
      hi: "नीति लागू करने से पहले परखें",
      mr: "धोरण लागू करण्याआधी तपासा",
    },
    role: "policymaker",
    prov: "simulated",
  },
  {
    id: "prove",
    verb: { en: "Prove", hi: "प्रमाण", mr: "पुरावा" },
    title: {
      en: "Register the target first. Then ask: did it work?",
      hi: "पहले लक्ष्य दर्ज करें, फिर पूछें: क्या असर हुआ?",
      mr: "आधी लक्ष्य नोंदवा, मग विचारा: परिणाम झाला का?",
    },
    role: "policymaker",
    prov: "synthetic",
  },
  {
    id: "capsule",
    verb: { en: "Capsule", hi: "कैप्सूल", mr: "कॅप्सूल" },
    title: {
      en: "Package it so anyone can re-run it",
      hi: "ऐसा पैकेज जिसे कोई भी दोबारा चला सके",
      mr: "कोणीही पुन्हा चालवू शकेल असे पॅकेज",
    },
    role: "researcher",
    prov: "synthetic",
  },
  {
    id: "loop",
    verb: { en: "Loop", hi: "चक्र", mr: "चक्र" },
    title: {
      en: "Every result becomes new evidence",
      hi: "हर परिणाम नया प्रमाण बनता है",
      mr: "प्रत्येक निकाल नवा पुरावा बनतो",
    },
    role: "researcher",
    prov: "illustrative",
  },
];

export const ROLES: { id: Role; label: string; initials: string; focus: string }[] = [
  {
    id: "officer",
    label: "District Officer",
    initials: "DO",
    focus: "Verification queue · field tasks",
  },
  {
    id: "policymaker",
    label: "Policymaker",
    initials: "PM",
    focus: "Scenarios · targets vs measured",
  },
  { id: "researcher", label: "Researcher", initials: "RS", focus: "Capsules · research gaps" },
];

// ---------------------------------------------------------------------------
// Scores — bands follow the consistency sheet: 82 HIGH · 68 MEDIUM · 54 MEDIUM
// ---------------------------------------------------------------------------

export type Band = "high" | "medium" | "low";
export const bandOf = (score: number): Band =>
  score >= 70 ? "high" : score >= 50 ? "medium" : "low";
export const bandColor = (b: Band) => (b === "high" ? C.red : b === "medium" ? C.amber : C.green);
export const bandLabel = (b: Band) => (b === "high" ? "HIGH" : b === "medium" ? "MEDIUM" : "LOW");

// ---------------------------------------------------------------------------
// Chapter 1 — VERIFY
// ---------------------------------------------------------------------------

export type Village = {
  id: string;
  name: string;
  area?: string;
  score: number;
  issue: string;
  lon: number;
  lat: number;
};

/** Top-10 villages to verify (real village names, synthetic scores). */
export const VILLAGES: Village[] = [
  {
    id: "maan",
    name: "Maan",
    area: "Hinjewadi Ph. III",
    score: 82,
    issue: "Orphaned deed",
    lon: 73.705,
    lat: 18.593,
  },
  {
    id: "wagholi",
    name: "Wagholi",
    score: 68,
    issue: "Share over-allocation",
    lon: 73.982,
    lat: 18.58,
  },
  { id: "baner", name: "Baner", score: 64, issue: "Owner mismatch", lon: 73.787, lat: 18.561 },
  {
    id: "kharadi",
    name: "Kharadi",
    score: 61,
    issue: "Mutation staleness",
    lon: 73.941,
    lat: 18.552,
  },
  { id: "bavdhan", name: "Bavdhan", score: 57, issue: "Area mismatch", lon: 73.779, lat: 18.515 },
  {
    id: "hadapsar",
    name: "Hadapsar",
    score: 54,
    issue: "Record–reality mismatch",
    lon: 73.935,
    lat: 18.5,
  },
  {
    id: "hinjewadi",
    name: "Hinjewadi",
    score: 49,
    issue: "Pending RCCMS",
    lon: 73.738,
    lat: 18.59,
  },
  { id: "chakan", name: "Chakan", score: 45, issue: "Temporal inversion", lon: 73.862, lat: 18.76 },
  {
    id: "talegaon",
    name: "Talegaon",
    score: 38,
    issue: "Ghost transfer",
    lon: 73.675,
    lat: 18.735,
  },
  { id: "shirur", name: "Shirur", score: 31, issue: "Duplicate ULPIN", lon: 74.07, lat: 18.83 },
];

/** Study window — Pune metropolitan fringe (PMRDA core). */
export const STUDY_BOUNDS: [[number, number], [number, number]] = [
  [73.6, 18.44],
  [74.12, 18.86],
];

/** Convex outline of the study window (used to clip the village tessellation). */
const OUTLINE: [number, number][] = [
  [73.63, 18.52],
  [73.7, 18.46],
  [73.86, 18.44],
  [74.02, 18.46],
  [74.1, 18.55],
  [74.12, 18.72],
  [74.08, 18.84],
  [73.92, 18.86],
  [73.72, 18.83],
  [73.64, 18.72],
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Pt = [number, number];

/** Sutherland–Hodgman clip of a polygon by one half-plane (keep side where f(p) <= 0). */
function clipHalf(poly: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const fa = f(a);
    const fb = f(b);
    if (fa <= 0) out.push(a);
    if (fa * fb < 0) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Voronoi cell of site i, clipped to the convex study outline. */
function cell(sites: Pt[], i: number): Pt[] {
  let poly: Pt[] = OUTLINE.slice();
  const s = sites[i]!;
  // clip by the outline itself is implicit (we start from it); then by bisectors
  for (let j = 0; j < sites.length && poly.length; j++) {
    if (j === i) continue;
    const o = sites[j]!;
    const mx = (s[0] + o[0]) / 2;
    const my = (s[1] + o[1]) / 2;
    const dx = o[0] - s[0];
    const dy = o[1] - s[1];
    poly = clipHalf(poly, (p) => (p[0] - mx) * dx + (p[1] - my) * dy);
  }
  return poly;
}

export type Cell = {
  id: string;
  name: string | null;
  score: number;
  band: Band;
  ring: Pt[];
  lon: number;
  lat: number;
};

/** Village tessellation: the 10 ranked villages + background villages (synthetic boundaries). */
export const CELLS: Cell[] = (() => {
  const r = rng(7);
  const sites: Pt[] = VILLAGES.map((v) => [v.lon, v.lat]);
  const meta: { id: string; name: string | null; score: number }[] = VILLAGES.map((v) => ({
    id: v.id,
    name: v.name,
    score: v.score,
  }));
  // background villages on a jittered grid, kept away from the named ones
  for (let x = 73.66; x <= 74.1; x += 0.052) {
    for (let y = 18.47; y <= 18.84; y += 0.046) {
      const p: Pt = [x + (r() - 0.5) * 0.03, y + (r() - 0.5) * 0.028];
      if (sites.some((s) => Math.hypot(s[0] - p[0], s[1] - p[1]) < 0.034)) continue;
      sites.push(p);
      meta.push({ id: `v${meta.length}`, name: null, score: Math.round(8 + r() * 36) });
    }
  }
  return sites
    .map((s, i) => {
      const ring = cell(sites, i);
      const m = meta[i]!;
      return { ...m, band: bandOf(m.score), ring, lon: s[0], lat: s[1] };
    })
    .filter((c) => c.ring.length >= 3);
})();

export const CELLS_GEOJSON = {
  type: "FeatureCollection" as const,
  features: CELLS.map((c) => ({
    type: "Feature" as const,
    properties: {
      id: c.id,
      name: c.name ?? "",
      score: c.score,
      band: c.band,
      named: c.name ? 1 : 0,
    },
    geometry: { type: "Polygon" as const, coordinates: [[...c.ring, c.ring[0]!]] },
  })),
};

export const OUTLINE_GEOJSON = {
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: [...OUTLINE, OUTLINE[0]!] },
};

export const CONTRIBUTORS = [
  { label: "Record vs Reality", pct: 40 },
  { label: "Area mismatch", pct: 20 },
  { label: "Owner mismatch", pct: 20 },
  { label: "Mutation staleness", pct: 10 },
  { label: "RCCMS", pct: 10 },
];

export const CHECK_NAMES = [
  "Orphaned deed",
  "Partition mismatch",
  "Share over-allocation",
  "Ghost transfer",
  "Temporal inversion",
  "Dormant succession",
  "Duplicate ULPIN",
  "Pending RCCMS",
] as const;

export type Parcel = {
  village: string;
  survey: string;
  ulpin: string;
  recorded: string;
  areaHa: number;
  sat2024: { built: number; agri: number; veg: number };
  score: number;
  failed: string[];
};

/** Parcel detail per ranked village. Maan / Wagholi / Hadapsar are pinned by the consistency sheet. */
export const PARCELS: Record<string, Parcel> = {
  maan: {
    village: "Maan",
    survey: "124/2",
    ulpin: ULPIN,
    recorded: "Agriculture",
    areaHa: 2.4,
    sat2024: { built: 72, agri: 18, veg: 10 },
    score: 82,
    failed: ["Orphaned deed", "Ghost transfer", "Pending RCCMS"],
  },
  wagholi: {
    village: "Wagholi",
    survey: "311/1",
    ulpin: "80471234561176",
    recorded: "Agriculture",
    areaHa: 1.85,
    sat2024: { built: 48, agri: 41, veg: 11 },
    score: 68,
    failed: ["Share over-allocation", "Partition mismatch"],
  },
  hadapsar: {
    village: "Hadapsar",
    survey: "57/4",
    ulpin: "80471234560412",
    recorded: "Agriculture",
    areaHa: 0.92,
    sat2024: { built: 61, agri: 27, veg: 12 },
    score: 54,
    failed: ["Temporal inversion"],
  },
};

export function parcelFor(v: Village): Parcel {
  const pinned = PARCELS[v.id];
  if (pinned) return pinned;
  const seed = VILLAGES.indexOf(v) + 3;
  const built = Math.min(80, 20 + Math.round(v.score * 0.55));
  const failed = CHECK_NAMES.filter((_, i) => (i * 3 + seed) % 7 === 0 || i === seed % 8).slice(
    0,
    v.score >= 50 ? 2 : 1,
  );
  return {
    village: v.name,
    survey: `${60 + seed * 23}/${(seed % 4) + 1}`,
    ulpin: `8047123456${String(1000 + seed * 137).slice(-4)}`,
    recorded: "Agriculture",
    areaHa: Number((0.8 + (seed % 5) * 0.37).toFixed(2)),
    sat2024: { built, agri: Math.max(6, 88 - built), veg: 100 - built - Math.max(6, 88 - built) },
    score: v.score,
    failed: [...failed],
  };
}

export const OWNERS = [
  { name: "Ramesh", share: 40 },
  { name: "Suresh", share: 30 },
  { name: "Meena", share: 30 },
];

export const TIMELINE = [
  { year: "2010", label: "Sale", state: "ok" as const, note: "Registered deed" },
  {
    year: "2015",
    label: "Mutation MISSING",
    state: "missing" as const,
    note: "No entry in mutation register",
  },
  { year: "2020", label: "Transfer", state: "ok" as const, note: "Built on an unmutated title" },
];

export const SCREENING_BANNER =
  "Screening signal — requires field verification. Not a legal ruling.";

// ---------------------------------------------------------------------------
// Chapter 2 — COPILOT
// ---------------------------------------------------------------------------

export const QUESTION: Record<Lang, string> = {
  en: "Which villages in Pune changed agricultural land to built-up between 2019 and 2024?",
  hi: "2019 से 2024 के बीच पुणे के किन गाँवों में खेती की ज़मीन निर्माण क्षेत्र में बदली?",
  mr: "2019 ते 2024 दरम्यान पुण्यातील कोणत्या गावांमध्ये शेतजमीन बांधकामात बदलली?",
};

export const LANG_NAME: Record<Lang, string> = { en: "English", hi: "हिंदी", mr: "मराठी" };

export const QUERY_PLAN = {
  intent: "landuse_change",
  district: "Pune",
  from_class: "agriculture",
  to_class: "built_up",
  years: [2019, 2024],
  aggregation: "village",
};

/** Answer paragraph as segments; numbers in {n} are citation markers. */
export const ANSWER: Record<Lang, (string | number)[]> = {
  en: [
    "Three villages show the clearest agriculture → built-up shift. Maan was 91% agricultural in 2019 and is 18% built-up in 2024; Baner went 87% → 35%; Wagholi 76% → 62%",
    1,
    ". Converting agricultural land to another use requires permission under §44 of the Maharashtra Land Revenue Code",
    2,
    ", and each change should appear in the mutation register",
    3,
    ". One village is withheld because fewer than 5 parcels changed (k < 5).",
  ],
  hi: [
    "तीन गाँवों में खेती से निर्माण की ओर सबसे स्पष्ट बदलाव दिखता है। मान 2019 में 91% कृषि था और 2024 में 18% निर्मित है; बाणेर 87% → 35%; वाघोली 76% → 62%",
    1,
    "। कृषि भूमि का उपयोग बदलने के लिए महाराष्ट्र भू-राजस्व संहिता की धारा 44 के तहत अनुमति ज़रूरी है",
    2,
    ", और हर बदलाव फेरफार रजिस्टर में दर्ज होना चाहिए",
    3,
    "। एक गाँव छुपाया गया है क्योंकि 5 से कम भूखंड बदले (k < 5)।",
  ],
  mr: [
    "तीन गावांमध्ये शेतीकडून बांधकामाकडे सर्वात स्पष्ट बदल दिसतो. माण 2019 मध्ये 91% शेती होते आणि 2024 मध्ये 18% बांधकाम आहे; बाणेर 87% → 35%; वाघोली 76% → 62%",
    1,
    ". शेतजमिनीचा वापर बदलण्यासाठी महाराष्ट्र जमीन महसूल संहितेच्या कलम 44 अंतर्गत परवानगी आवश्यक आहे",
    2,
    ", आणि प्रत्येक बदल फेरफार नोंदवहीत नोंदवला गेला पाहिजे",
    3,
    ". एक गाव वगळले आहे कारण 5 पेक्षा कमी भूखंड बदलले (k < 5).",
  ],
};

export const FEDERATED_ROWS = [
  { village: "Maan", agri: 91, built: 18, suppressed: false },
  { village: "Baner", agri: 87, built: 35, suppressed: false },
  { village: "Wagholi", agri: 76, built: 62, suppressed: false },
  { village: "Village D", agri: null, built: null, suppressed: true },
];

export type Source = {
  n: number;
  kind: "Dataset" | "Act" | "Report" | "Records";
  title: string;
  note: string;
  prov: "real" | "synthetic";
};

export const SOURCES: Source[] = [
  {
    n: 1,
    kind: "Dataset",
    title: "Esri / Impact Observatory 10 m Annual Land Cover",
    note: "2019 & 2024 · village zonal stats",
    prov: "real",
  },
  {
    n: 2,
    kind: "Act",
    title: "Maharashtra Land Revenue Code, 1966 — §44",
    note: "Conversion of use of land · India Code",
    prov: "real",
  },
  {
    n: 3,
    kind: "Act",
    title: "Maharashtra Land Revenue Code, 1966 — §§148–150",
    note: "Record of rights · register of mutations",
    prov: "real",
  },
  {
    n: 4,
    kind: "Act",
    title: "Registration Act, 1908 — §17",
    note: "Compulsorily registrable documents",
    prov: "real",
  },
  {
    n: 5,
    kind: "Report",
    title: "Census of India 2011 — Village Directory, Pune",
    note: "Village codes & names",
    prov: "real",
  },
  {
    n: 6,
    kind: "Records",
    title: "RoR snapshot 2025-12-31 (Illustrative)",
    note: "Synthetic land records",
    prov: "synthetic",
  },
];

export const PIPELINE = [
  { title: "Understood intent", detail: "landuse_change" },
  { title: "JSON query plan", detail: "plan" },
  { title: "Pydantic validation", detail: "district ✓ · layers ✓ · years ✓" },
  {
    title: "Federated router",
    detail: "Maharashtra node ✓ · Records moved: 0 · Cells suppressed (k < 5): 1",
  },
  { title: "Retrieval", detail: "BM25 + vector + knowledge graph → 6 sources" },
  { title: "Faithfulness (RAGAS)", detail: "0.94 · Evidence grade B" },
] as const;

// ---------------------------------------------------------------------------
// Chapter 3 — PROTECT
// ---------------------------------------------------------------------------

export const GUARDRAIL = {
  question: "Show owner names for parcels in Maan village",
  answer:
    "Request not allowed — field owner_names is not in the allowed schema. Ask for aggregate statistics instead.",
  rephrase: "How many parcels in Maan changed land use between 2019 and 2024?",
};

export const SCHEMA_FIELDS: { field: string; allowed: boolean; why: string }[] = [
  { field: "district", allowed: true, why: "admin unit" },
  { field: "village", allowed: true, why: "aggregation key" },
  { field: "lulc_class", allowed: true, why: "satellite layer" },
  { field: "year", allowed: true, why: "2017–2024" },
  { field: "area_ha", allowed: true, why: "aggregate only" },
  { field: "mutation_count", allowed: true, why: "aggregate only" },
  { field: "owner_names", allowed: false, why: "personal data" },
  { field: "aadhaar_no", allowed: false, why: "personal data" },
  { field: "phone", allowed: false, why: "personal data" },
];

export const NODES = [
  { id: "MH", name: "Maharashtra", role: "Pune in scope", active: true, rows: 4 },
  { id: "KA", name: "Karnataka", role: "no matching district", active: false, rows: 0 },
  { id: "GJ", name: "Gujarat", role: "no matching district", active: false, rows: 0 },
];

// ---------------------------------------------------------------------------
// Chapter 4 — SIMULATE
// ---------------------------------------------------------------------------

export type ScenarioId = "S1" | "S2" | "S3";

export const SCENARIOS: { id: ScenarioId; title: string; lever: string }[] = [
  { id: "S1", title: "Restrict agri conversion", lever: "State lever" },
  { id: "S2", title: "ULPIN + resurvey coverage 40% → 80%", lever: "DoLR lever" },
  { id: "S3", title: "Auto-mutation + conclusive titling", lever: "DoLR lever" },
];

export const BASELINE = { agri: 41200, dev: 9800, flood: 6450, disputes: 1180 };

/** Scenario outcomes at the default lever settings (median of 40 runs, ± = IQR/2). */
export const OUTCOMES: Record<
  ScenarioId,
  {
    agri: [number, number];
    dev: [number, number];
    flood: [number, number];
    disputes: [number, number] | null;
  }
> = {
  S1: { agri: [44600, 900], dev: [7100, 600], flood: [6100, 300], disputes: null },
  S2: { agri: [43100, 1100], dev: [8300, 700], flood: [5900, 400], disputes: [940, 70] },
  S3: { agri: [42300, 800], dev: [9100, 500], flood: [6200, 350], disputes: [610, 60] },
};

export const DISTRIBUTIONAL = [
  { label: "Smallholders", value: -3 },
  { label: "Large holders", value: 15 },
  { label: "Tribal areas", value: 8 },
  { label: "Flood-prone", value: -5 },
];

export const SHAP = [
  { label: "Distance to highway", value: 0.21 },
  { label: "Road density (1 km)", value: 0.17 },
  { label: "Built-up 2019 nearby", value: 0.13 },
  { label: "Slope", value: -0.12 },
  { label: "Protected area overlap", value: -0.09 },
];

export const VETO = { count: 312, reasons: ["Tribal land (73AA)", "ESZ", "Tenancy restriction"] };

export const SIM_STEPS = [
  "Loading twin",
  "Applying rules",
  "Scoring parcels",
  "Distributional analysis",
];

export const SIM_BANNER = "Scenario estimates, not forecasts. The policymaker decides.";

// ---------------------------------------------------------------------------
// Chapter 5 — PROVE
// ---------------------------------------------------------------------------

export const KPI = {
  policy: "Auto-mutation + conclusive titling (S3)",
  owner: "Revenue & Forest Dept., GoM",
  indicator: "Median mutation time",
  unit: "days",
  baseline: 30,
  target: "≤ 20",
  treated: 5,
  control: 5,
  design: "Difference-in-differences",
  period: "2023–2025",
  hash: "SHA-256: a3f9…7c21",
  hashFull: "a3f94be10c5d27e8f61a09b3dd4c8e2f57a1b06c9e3d48f2b7c0a5e61d9f7c21",
};

export const DID = {
  treated: [30, 20] as const,
  control: [30, 28] as const,
  naive: -10,
  effect: -8,
  ci: [-11, -5] as const,
  grade: "B",
};

export const TREATED_DISTRICTS = ["Pune", "Nashik", "Nagpur", "Aurangabad", "Thane"];

export const CONTROLS = [
  { district: "Satara", sim: 0.94, ok: true, reason: "Pre-trend matched" },
  { district: "Kolhapur", sim: 0.92, ok: true, reason: "Pre-trend matched" },
  { district: "Ahmednagar", sim: 0.9, ok: true, reason: "Pre-trend matched" },
  { district: "Solapur", sim: 0.88, ok: true, reason: "Pre-trend matched" },
  { district: "Jalgaon", sim: 0.86, ok: true, reason: "Pre-trend matched" },
  { district: "Ratnagiri", sim: 0.41, ok: false, reason: "Pre-trend diverged" },
  { district: "Beed", sim: 0.52, ok: false, reason: "Boundary change 2023" },
  { district: "Sindhudurg", sim: 0.38, ok: false, reason: "Flood shock 2023" },
];

/** Half-yearly median mutation time. Reform launched 2023 H1 (index 4). Ends exactly at 20 / 28. */
export const TRENDS = {
  x: [
    "2021 H1",
    "2021 H2",
    "2022 H1",
    "2022 H2",
    "2023 H1",
    "2023 H2",
    "2024 H1",
    "2024 H2",
    "2025 H1",
    "2025 H2",
  ],
  treated: [30.3, 30.1, 30.4, 30.0, 30.0, 27.2, 24.6, 22.4, 21.0, 20.0],
  control: [30.4, 30.2, 30.3, 30.1, 30.0, 29.6, 29.1, 28.7, 28.3, 28.0],
  reform: 4,
};

export const PLACEBOS = [
  { test: "Fake reform year (2021)", detail: "effect −0.6 d · p = 0.61", pass: true },
  { test: "Fake district (Satara as treated)", detail: "effect −1.1 d · p = 0.42", pass: true },
  {
    test: "Unrelated KPI (birth registration time)",
    detail: "effect +0.3 d · p = 0.77",
    pass: true,
  },
];

export const PLACEBO_FAILED = {
  test: "Fake reform year (2022 H2)",
  detail: "effect −6.9 d · p = 0.03 — anticipation effect",
  pass: false,
};

// ---------------------------------------------------------------------------
// Chapter 6 — CAPSULE
// ---------------------------------------------------------------------------

export const CAPSULE = {
  id: "EC-PUNE-2026-0042",
  title: "Does auto-mutation reduce median mutation time?",
  created: "26 Sep 2026 · 11:58 IST",
  commit: "8f31c0a",
  items: [
    { k: "Question", v: "Does auto-mutation + conclusive titling reduce median mutation time?" },
    { k: "JSON plan", v: '{ "intent": "kpi_evaluation", "kpi": "median_mutation_time", … }' },
    { k: "Dataset versions", v: "LULC 2024.1 · RoR snapshot 2025-12-31 (synthetic) · panel v3" },
    { k: "Code commit", v: "8f31c0a · workflow/did-eval" },
    { k: "Method", v: "DiD, two-way fixed effects, clustered SE (DoWhy)" },
    { k: "Parameters", v: "5 treated · 5 controls · 2021–2025 · reform 2023 H1" },
    { k: "Results", v: "−8 days · 95% CI [−11, −5] · grade B" },
    { k: "Citations", v: "6 sources · RAGAS 0.94" },
    { k: "Hash", v: "SHA-256: a3f9…7c21" },
  ],
  rerunLog: [
    "Resolving dataset versions … LULC 2024.1 ✓  RoR 2025-12-31 ✓  panel v3 ✓",
    "Checking out commit 8f31c0a … ✓",
    "Re-validating JSON plan (Pydantic) … ✓",
    "Re-estimating DiD (two-way FE, clustered SE) … −8.0 d  [−11, −5]",
    "Re-running placebo suite … 3 / 3 passed",
    "Hashing outputs … SHA-256: a3f9…7c21",
  ],
};
