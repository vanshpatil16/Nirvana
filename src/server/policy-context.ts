/**
 * Policy Lab library → Copilot context.
 *
 * Searches the real policy library that powers /policy-lab (Acts, rules and
 * policies read out of their source PDFs) and returns the matching instruments
 * with verbatim quotes, clause and page. Retrieval is deterministic keyword
 * scoring over the library — the LLM never picks the citations, it only gets
 * to explain the excerpts returned here.
 *
 * Every evidence row keeps the library's own grounding flag:
 *   explicit  the value / claim is stated in the document text
 *   derived   follows from the text but isn't stated as a figure
 *   inferred  a modelling value for the Policy Lab, NOT in the document
 */

import { indicatorById, POLICIES, type Policy, type PolicyEvidence } from "@/data/policySimulation";

export interface PolicyQuote {
  policy: string;
  shortName: string;
  clause: string;
  page: number;
  quote: string;
  claim: string;
  method: PolicyEvidence["method"];
  confidence: number;
  /** parameter this row supports, when it's a Policy Lab parameter */
  parameter?: string | undefined;
  value?: string | undefined;
  sourceFile?: string | undefined;
  /** citation of the instrument, e.g. "Maharashtra Act No. XLI of 1966" */
  reference: string;
  year: number;
}

export interface PolicyMatch {
  policy: Policy;
  score: number;
  quotes: PolicyQuote[];
}

// ---------------------------------------------------------------------------
// Tokenising (English + common Hindi / Marathi land-law vocabulary)
// ---------------------------------------------------------------------------

const STOP = new Set(
  "a an the of to in on for and or is are was be by with what which who how does do did can could should would about under this that these those it its as at from any all me tell say says said show explain policy policies act law rule rules section sec lab".split(
    " ",
  ),
);

/** Devanagari / Hinglish terms → English search terms. */
const SYNONYMS: [RegExp, string][] = [
  [/धारा|कलम|dhara|kalam/giu, "section"],
  [/कृषि|खेती|शेती|शेतजमीन|कृषी|krishi|kheti|sheti/giu, "agricultural agriculture"],
  [/अकृषि|अकृषिक|बिनशेती|non[- ]?agri|\bna\b/giu, "non-agricultural conversion"],
  [/रूपांतरण|रूपांतर|परिवर्तन|बदल|convert/giu, "conversion"],
  [/अनुमति|परवानगी|permission/giu, "permission collector"],
  [/किरायेदारी|किरायेदार|कूळ|कुळ|kul\b|tenant/giu, "tenancy tenant"],
  [/विखंडन|तुकडे|तुकडेबंदी|एकत्रीकरण|fragment/giu, "fragmentation consolidation holdings"],
  [/उद्योग|औद्योगिक|udyog|industr/giu, "industry industrial"],
  [/नगर\s*रचना|नगर\s*नियोजन|town\s*planning/giu, "town planning regional"],
  [/आधार/giu, "aadhaar"],
  [/भू[- ]?राजस्व|जमीन\s*महसूल|land\s*revenue/giu, "land revenue code"],
  [/लॉजिस्टिक|logistic/giu, "logistics warehousing"],
  [/सब्सिडी|अनुदान|प्रोत्साहन|incentive/giu, "incentive subsidy"],
  [/एफएसआय|fsi|floor\s*space/giu, "fsi floor space index"],
  [/midc|एमआयडीसी/giu, "midc industrial development"],
  [/udcpr|डीसीपीआर/giu, "udcpr development control"],
  [/mlrc/giu, "land revenue code"],
];

const expand = (text: string) =>
  SYNONYMS.reduce((t, [re, en]) => t.replace(re, (m) => `${m} ${en}`), text);

function tokens(text: string): string[] {
  return expand(text)
    .toLowerCase()
    .normalize("NFKD")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ies|es|s)$/, "") : w));
}

/** Section / clause numbers the user named, e.g. "section 42", "कलम 63", "s.42A". */
function sectionRefs(text: string): string[] {
  const out = new Set<string>();
  const re = /(?:section|sec\.?|s\.|धारा|कलम|dhara|kalam|rule|regulation)\s*(\d+[a-z]?)/giu;
  for (const m of expand(text).matchAll(re)) if (m[1]) out.add(m[1].toLowerCase());
  return [...out];
}

// ---------------------------------------------------------------------------
// Index (built once per server process)
// ---------------------------------------------------------------------------

type Row = { quote: PolicyQuote; terms: Map<string, number>; section: string };
type Doc = { policy: Policy; head: Map<string, number>; rows: Row[] };

const count = (weighted: [string, number][]) => {
  const m = new Map<string, number>();
  for (const [text, w] of weighted) for (const t of tokens(text)) m.set(t, (m.get(t) ?? 0) + w);
  return m;
};

const fmtValue = (v: unknown, unit?: string) =>
  typeof v === "boolean"
    ? v
      ? "yes"
      : "no"
    : Array.isArray(v)
      ? v.join(", ")
      : `${String(v)}${unit ? ` ${unit}` : ""}`;

let INDEX: Doc[] | null = null;
function index(): Doc[] {
  if (INDEX) return INDEX;
  INDEX = POLICIES.map((p) => {
    const src = p.sourceDocument;
    const head = count([
      [`${p.name} ${p.shortName}`, 4],
      [p.domain, 3],
      [`${src.title} ${src.reference} ${src.clause}`, 2],
      [p.objective, 1.5],
      [p.description, 1],
      [`${p.headline.value} ${p.headline.label}`, 1],
    ]);
    const mk = (e: PolicyEvidence, parameter?: string, value?: string): Row => ({
      quote: {
        policy: p.name,
        shortName: p.shortName,
        clause: e.clause,
        page: e.page,
        quote: e.quote
          .replace(/\s+/g, " ")
          .replace(/\s([;,.])/g, "$1")
          .trim(),
        claim: e.claim,
        method: e.method,
        confidence: e.confidence,
        parameter,
        value,
        sourceFile: src.sourceFile,
        reference: src.reference,
        year: src.year,
      },
      terms: count([
        [e.claim, 2.5],
        [e.clause, 2],
        [e.quote, 1],
        [parameter ?? "", 2],
      ]),
      section: e.clause.toLowerCase(),
    });
    const rows = [
      ...(p.evidence ?? []).map((e) => mk(e)),
      ...p.parameters
        .filter((x) => x.evidence)
        .map((x) => mk(x.evidence!, x.label, fmtValue(x.default, x.unit))),
    ];
    return { policy: p, head, rows };
  });
  return INDEX;
}

const score = (terms: Map<string, number>, q: string[]) =>
  q.reduce((s, t) => s + (terms.get(t) ?? 0), 0);

/** Top instruments for a question, each with its best-supported excerpts. */
export function searchPolicies(text: string, limit = 3): PolicyMatch[] {
  const q = [...new Set(tokens(text))];
  const secs = sectionRefs(text);
  const years = [...text.matchAll(/\b(19[4-9]\d|20[0-4]\d)\b/g)].map((m) => Number(m[1]));
  const matches: PolicyMatch[] = [];
  for (const d of index()) {
    const headScore = score(d.head, q);
    const rows = d.rows
      .map((r) => {
        let s = score(r.terms, q);
        // an explicitly named section number is the strongest signal there is
        if (
          secs.some((n) =>
            new RegExp(`(section|s\\.|rule|regulation)\\s*${n}(\\b|\\()`).test(r.section),
          )
        )
          s += 12;
        // prefer text the document actually states over modelling values
        if (r.quote.method === "explicit") s *= 1.25;
        else if (r.quote.method === "inferred") s *= 0.6;
        return { r, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    let total = headScore + (rows[0]?.s ?? 0) + (rows[1]?.s ?? 0) * 0.5;
    // "the 2025 policy" names one instrument; others from other years are weaker matches
    if (years.length)
      total = years.includes(d.policy.sourceDocument.year) ? total + 40 : total * 0.5;
    if (total < 3) continue;
    const seen = new Set<string>();
    matches.push({
      policy: d.policy,
      score: total,
      quotes: (rows.length
        ? rows
        : d.rows.filter((r) => r.quote.method === "explicit").map((r) => ({ r, s: 0 }))
      )
        .filter((x) => !seen.has(x.r.quote.quote) && !!seen.add(x.r.quote.quote))
        .slice(0, 3)
        .map((x) => x.r.quote),
    });
  }
  matches.sort((a, b) => b.score - a.score);
  // drop weak tail matches that only share a generic word with the question
  const top = matches[0]?.score ?? 0;
  return matches.filter((m) => m.score >= top * 0.3).slice(0, limit);
}

/** One-line list of everything in the library (for "what's in the Policy Lab?"). */
export function libraryOverview() {
  return POLICIES.map((p) => ({
    name: p.name,
    domain: p.domain,
    year: p.sourceDocument.year,
    headline: `${p.headline.value} — ${p.headline.label}`,
  }));
}

export const primaryIndicators = (p: Policy) =>
  p.indicators
    .filter((i) => i.role === "primary")
    .map((i) => indicatorById(i.indicatorId)?.name ?? i.indicatorId);
