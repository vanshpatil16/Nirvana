/**
 * GET /api/policies — statutory applicability search over real Indian land law.
 *
 * Answers the question a revenue officer or a citizen actually has: "which
 * provision governs this land situation?" and returns the provision, its Act,
 * its recorded status and the official India Code link, so the answer can be
 * opened and checked rather than taken on trust.
 *
 * SCORING IS THE TRAINED MODEL
 * ----------------------------
 * The model is `ml/train_model.py` output. Its reported cross-validation
 * numbers come from a GroupKFold split grouped by enactment, so whole Acts are
 * held out. That report is served verbatim from `model_report.json`; this
 * endpoint never restates or rounds it.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It ranks applicable statutory provisions. It does not forecast what a policy
 * will achieve: public Indian sources do not publish the outcome series that
 * would make that measurable, and a number here would be invented.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  EvidenceIndex,
  ModelBundle,
  RankedProvision,
  ModelDiagnostics,
} from "@/services/policyModel";
import { diagnose, rank } from "@/services/policyModel";

/**
 * The artefacts live in `public/data/`, NOT as JSON imports.
 *
 * The evidence index is ~24 MB of statute text. A `import(...)` of that pulls it
 * into the serverless function bundle, which bloats the build and makes every
 * cold start pay a 24 MB parse. Reading it from disk on first use keeps the
 * function small and lets Vercel stream it from the CDN-adjacent filesystem.
 * `ml/install_assets.py` writes the files there; `public/data/*.json` is
 * gitignored because they are build output, not source.
 */
const ASSET_DIR = join(process.cwd(), "public", "data");

let bundleCache: ModelBundle | null = null;
let indexCache: EvidenceIndex | null = null;
let reportCache: Record<string, unknown> | null | undefined;

function readAsset<T>(name: string): T | null {
  const path = join(ASSET_DIR, name);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function loadBundle(): ModelBundle | null {
  bundleCache ??= readAsset<ModelBundle>("model_ts.json");
  return bundleCache;
}

/**
 * Enactment year as an integer, or null.
 *
 * The corpus carries it as a pandas float rendered to text ("1995.0"), so it
 * arrives as a string. Left alone it becomes a timeline axis of "1806.0" keys
 * and a Map keyed by text rather than by number. Anything unparseable becomes
 * null, which the API reports as NOT RECORDED rather than guessing.
 */
function toYear(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value !== "string") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function loadIndex(): EvidenceIndex | null {
  if (indexCache) return indexCache;
  const raw = readAsset<EvidenceIndex>("evidence_index.json");
  if (!raw) return null;
  for (const p of raw.provisions) {
    const y = toYear(p.year);
    if (y !== null) p.year = y;
  }
  indexCache = raw;
  return indexCache;
}

function loadReport(): Record<string, unknown> | null {
  if (reportCache === undefined)
    reportCache = readAsset<Record<string, unknown>>("model_report.json");
  return reportCache;
}

let diagnosticsCache: ModelDiagnostics | null = null;

/** Scoring 300 provisions is not free, and the answer cannot change per request. */
function cachedDiagnostics(bundle: ModelBundle, index: EvidenceIndex): ModelDiagnostics {
  diagnosticsCache ??= diagnose(bundle, index);
  return diagnosticsCache;
}

/**
 * Significant words for title matching: lowercased, stopwords and bare numbers
 * dropped, so "The Maharashtra Land Revenue Code, 1966" reduces to
 * {maharashtra, land, revenue, code}.
 */
const TITLE_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "to",
  "at",
  "by",
  "with",
  "act",
  "acts",
  "code",
  "law",
  "rules",
  "regulation",
  "regulations",
  "act",
  "no",
  "year",
  "state",
  "government",
  "india",
  "as",
  "amended",
  "1950",
  "1960",
]);

function significantWords(text: string): string[] {
  const seen = new Set<string>();
  for (const w of (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)) {
    if (w.length > 2 && !TITLE_STOPWORDS.has(w) && !/^\d+$/.test(w)) seen.add(w);
  }
  return [...seen];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json;charset=utf-8" },
  });
}

const EMPTY_CORPUS_NOTE =
  "Model artefacts are not installed in this build. Run ml/build_corpus.py, " +
  "ml/train_model.py, ml/export_bundle.py, then ml/install_assets.py to place " +
  "model_ts.json and evidence_index.json in public/data/.";

export async function handlePoliciesApi(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // ------------------------------------------------------------- meta
  if (url.pathname === "/api/policies/source-status") {
    const index = loadIndex();
    const bundle = loadBundle();
    const report = loadReport();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    return json({
      available: true,
      corpus: index.counts,
      source: index.source,
      provenance_note: index.provenance_note,
      text_cap_chars: index.text_cap_chars,
      text_truncated_count: index.text_truncated_count,
      truncation_note: index.truncation_note,
      generated_at: index.generated_at,
      priority_jurisdictions: index.priority_jurisdictions,
      model_installed: bundle !== null,
      model: bundle
        ? {
            trained_at: bundle.generated_at,
            subjects: bundle.subjects,
            grouping: bundle.grouping,
            rows: bundle.n_rows,
            features: bundle.n_features,
            enactments: bundle.n_enactments,
            trees: bundle.tree_count,
          }
        : null,
      // Measured on the real corpus, cached because it scores 300 provisions.
      model_diagnostics: bundle ? cachedDiagnostics(bundle, index) : null,
      // Counted from the index itself, not asserted.
      subject_count: new Set(index.provisions.flatMap((p) => p.subjects)).size,
      jurisdictions_indexed: new Set(index.provisions.map((p) => p.jurisdiction)).size,
      provisions_indexed: index.provisions.length,
      acts_indexed: new Set(index.provisions.map((p) => p.act)).size,
      // Verbatim from model_report.json. Never recomputed, never rounded here.
      measurement: report,
    });
  }

  if (url.pathname === "/api/policies/jurisdictions") {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    const counts = new Map<string, number>();
    for (const p of index.provisions) {
      counts.set(p.jurisdiction, (counts.get(p.jurisdiction) ?? 0) + 1);
    }
    return json({
      jurisdictions: [...counts.entries()]
        .map(([jurisdiction, provisions]) => ({ jurisdiction, provisions }))
        .sort((a, b) => b.provisions - a.provisions),
    });
  }

  if (url.pathname === "/api/policies/topics") {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    const counts = new Map<string, number>();
    for (const p of index.provisions) {
      for (const s of p.subjects) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return json({
      topics: [...counts.entries()]
        .map(([topic, provisions]) => ({ topic, provisions }))
        .sort((a, b) => b.provisions - a.provisions),
    });
  }

  // ------------------------------------------------------------- timeline
  // What the corpus can actually support: provision and enactment counts by
  // year, and the recorded status of each enactment. It CANNOT support an
  // amendment chain — see the honesty note in the response.
  if (url.pathname === "/api/policies/timeline") {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });

    const byYear = new Map<number, { provisions: number; enactments: Set<string> }>();
    const acts = new Map<
      string,
      {
        act: string;
        title: string;
        year: number | null;
        status: string | null;
        effective: string | null;
        jurisdiction: string;
        provisions: number;
      }
    >();

    for (const p of index.provisions) {
      let entry = acts.get(p.act);
      if (!entry) {
        entry = {
          act: p.act,
          title: p.title,
          year: p.year ?? null,
          status: p.status ?? null,
          effective: p.effective_date ?? null,
          jurisdiction: p.jurisdiction,
          provisions: 0,
        };
        acts.set(p.act, entry);
      }
      entry.provisions += 1;

      if (p.year !== null) {
        let slot = byYear.get(p.year);
        if (!slot) {
          slot = { provisions: 0, enactments: new Set<string>() };
          byYear.set(p.year, slot);
        }
        slot.provisions += 1;
        slot.enactments.add(p.act);
      }
    }

    return json({
      granularity: "enactment year",
      years: [...byYear.entries()]
        .map(([year, v]) => ({ year, provisions: v.provisions, enactments: v.enactments.size }))
        .sort((a, b) => a.year - b.year),
      enactments: [...acts.values()]
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        .slice(0, Math.min(Number(url.searchParams.get("limit") ?? 100), 500)),
      source: index.source,
      honesty:
        "Counts are derived from the recorded enactment year and status in the corpus. " +
        "No amendment or repeal chain is inferred: the upstream sources record the " +
        "original enactment, not section-level amendments, so a version graph would " +
        "be invented. Any 'changed since' claim must be verified on India Code.",
    });
  }

  // ------------------------------------------------------------- changes
  if (url.pathname === "/api/policies/changes") {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    const jurisdiction = url.searchParams.get("jurisdiction") ?? undefined;

    const byAct = new Map<
      string,
      {
        act: string;
        title: string;
        year: number | null;
        status: string | null;
        effective: string | null;
        jurisdiction: string;
        provisions: number;
        subjects: Set<string>;
      }
    >();
    for (const p of index.provisions) {
      if (jurisdiction && p.jurisdiction !== jurisdiction) continue;
      let entry = byAct.get(p.act);
      if (!entry) {
        entry = {
          act: p.act,
          title: p.title,
          year: p.year ?? null,
          status: p.status ?? null,
          effective: p.effective_date ?? null,
          jurisdiction: p.jurisdiction,
          provisions: 0,
          subjects: new Set<string>(),
        };
        byAct.set(p.act, entry);
      }
      entry.provisions += 1;
      for (const s of p.subjects) entry.subjects.add(s);
    }

    const rows = [...byAct.values()].map((e) => ({
      act: e.act,
      title: e.title,
      jurisdiction: e.jurisdiction,
      year: e.year,
      status: e.status,
      effective_date: e.effective,
      provisions_in_index: e.provisions,
      subjects: [...e.subjects].sort(),
      source_url: index.provisions.find((p) => p.act === e.act)?.source_url ?? null,
    }));

    const byStatus = new Map<string, number>();
    for (const r of rows)
      byStatus.set(r.status ?? "NOT RECORDED", (byStatus.get(r.status ?? "NOT RECORDED") ?? 0) + 1);

    return json({
      jurisdiction: jurisdiction ?? "all",
      total_acts: rows.length,
      by_status: [...byStatus.entries()].map(([status, acts]) => ({ status, acts })),
      recent: rows
        .filter((r) => r.year !== null)
        .sort((a, b) => b.year! - a.year!)
        .slice(0, 50),
      source: index.source,
      honesty:
        "'status' is the act_status recorded by the upstream India Code metadata, " +
        "reproduced verbatim. It is NOT a legal determination by NIRVANA and it is " +
        "not refreshed at request time. Verify on India Code before relying on it.",
    });
  }

  // ------------------------------------------------------------- list
  if (url.pathname === "/api/policies") {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    const jurisdiction = url.searchParams.get("jurisdiction") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    let rows = index.provisions;
    if (jurisdiction) rows = rows.filter((p) => p.jurisdiction === jurisdiction);
    const page = rows.slice(offset, offset + limit).map(slim);

    return json({
      total: rows.length,
      offset,
      limit,
      source: index.source,
      results: page,
    });
  }

  // ------------------------------------------------------------- search
  // MUST come before the /:id matches below: `search`, `topics`, `timeline`,
  // `changes`, `jurisdictions` and `source-status` would otherwise all be
  // swallowed by /^\/api\/policies\/([^/]+)$/ and answered with a 404.
  if (url.pathname === "/api/policies/search") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) return json({ error: "Missing ?q=", results: [] });

    const bundle = loadBundle();
    const index = loadIndex();
    if (!bundle || !index) {
      return json(
        { error: "Model not installed", reason: EMPTY_CORPUS_NOTE, query: q, results: [] },
        503,
      );
    }
    const jurisdiction = url.searchParams.get("jurisdiction") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 8), 25);

    const results = rank(bundle, index, q, { jurisdiction, limit });
    const diagnostics = diagnose(bundle, index);

    return json({
      query: q,
      jurisdiction: jurisdiction ?? "all",
      model: {
        trained_at: bundle.generated_at,
        subjects: bundle.subjects,
        grouping: bundle.grouping,
        training_rows: bundle.n_rows,
        enactments: bundle.n_enactments,
      },
      // Stated plainly so the UI cannot present a saturated number as confidence.
      ranking_signal: "tfidf_cosine over statute text",
      model_role: diagnostics.saturated
        ? "Coarse filter only. The boosters are saturated, so model_probabilities are " +
          "NOT subject-level confidence. See model_diagnostics."
        : "Subject-level applicability from the trained one-vs-rest boosters.",
      model_diagnostics: diagnostics,
      source: index.source,
      disclaimer:
        "Statutory applicability ranked against real provision text. This is LAW, not " +
        "policy, not implementation, and not a prediction of outcomes. Every result " +
        "carries its India Code link: open it to verify before relying on it.",
      results: results.map(slim),
    });
  }

  // ------------------------------------------------------------- document
  // Resolve a library instrument's title to a REAL document in the corpus.
  //
  // The prototype library declares `sourceFile` names but ships no PDFs, so its
  // cards had nothing to open. Rather than attach a plausible-looking link, this
  // looks the title up in the indexed legislation and returns the official India
  // URL that is actually there - or reports that no match exists. `is_pdf` is
  // computed from the URL, not assumed: most corpus entries are handle landing
  // pages, and only some resolve straight to a PDF bitstream.
  const doc = url.pathname.match(/^\/api\/policies\/document$/);
  if (doc) {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    const title = (url.searchParams.get("title") ?? "").trim();
    if (!title) return json({ error: "Missing ?title=" });

    const jurisdiction = url.searchParams.get("jurisdiction") ?? undefined;
    const wantJurisdiction = jurisdiction === "auto" ? undefined : jurisdiction;

    // Score by shared significant words, so "Maharashtra Agricultural Lands
    // (Ceiling on Holdings) Act" still finds the corpus entry that reads
    // "...Act, 1961." A bare substring test would not.
    const wanted = significantWords(title);
    const scored: Array<{
      act: string;
      title: string;
      score: number;
      url: string;
      juris: string;
      year: number | null;
      status: string | null;
      provisions: number;
    }> = [];

    const byAct = new Map<
      string,
      {
        title: string;
        juris: string;
        year: number | null;
        status: string | null;
        n: number;
        url: string;
        src: string;
      }
    >();
    for (const p of index.provisions) {
      let e = byAct.get(p.act);
      if (!e) {
        e = {
          title: p.title,
          juris: p.jurisdiction,
          year: p.year,
          status: p.status,
          n: 0,
          url: p.document_url,
          src: p.source_url,
        };
        byAct.set(p.act, e);
      }
      e.n += 1;
    }

    for (const [act, e] of byAct) {
      if (wantJurisdiction && e.juris !== wantJurisdiction) continue;
      const have = new Set(significantWords(e.title));
      const overlap = wanted.filter((w) => have.has(w)).length;
      if (overlap === 0) continue;
      // Coverage of the query matters more than raw overlap: a 12-word title with
      // 4 shared words is a better match than a 4-word title sharing all 4.
      const score = overlap / Math.max(wanted.length, 1);
      scored.push({
        act,
        title: e.title,
        score,
        url: e.url,
        juris: e.juris,
        year: e.year,
        status: e.status,
        provisions: e.n,
      });
    }

    scored.sort((a, b) => b.score - a.score || b.provisions - a.provisions);
    const best = scored[0];
    if (!best || best.score < 0.45) {
      return json({
        query: title,
        resolved: false,
        reason:
          "No enactment in the indexed corpus matches that title closely enough to link. " +
          "The prototype library ships sourceFile names but no documents, so there is " +
          "nothing to open. This is reported rather than filled with a guessed URL.",
        candidates: scored.slice(0, 5).map((c) => ({
          act: c.act,
          title: c.title,
          jurisdiction: c.juris,
          score: Number(c.score.toFixed(3)),
        })),
      });
    }

    const entry = byAct.get(best.act)!;
    return json({
      query: title,
      resolved: true,
      match: {
        act: best.act,
        title: best.title,
        jurisdiction: best.juris,
        year: best.year,
        status: best.status,
        provisions_in_index: best.provisions,
        match_score: Number(best.score.toFixed(3)),
      },
      document_url: entry.url,
      source_url: entry.src,
      // Only some corpus entries point at a PDF bitstream; the rest are India Code
      // landing pages that host the PDF behind a "view" link.
      is_pdf: /\.pdf(\?|$)/i.test(entry.url),
      document_kind: /\.pdf(\?|$)/i.test(entry.url)
        ? "PDF (India Code bitstream)"
        : "India Code landing page",
      note:
        "Resolved from the indexed corpus by title match. This is the real official " +
        "document for the matched enactment, which may not be the exact instrument " +
        "named by the prototype library entry. Check the title and year before relying on it.",
      retrieved_at: index.generated_at,
    });
  }

  // ------------------------------------------------------------- single
  const single = url.pathname.match(/^\/api\/policies\/([^/]+)$/);
  if (single) {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    const id = decodeURIComponent(single[1]!);
    const found = index.provisions.find((p) => p.id === id || p.act === id);
    if (!found) return json({ error: "Not found", id }, 404);
    return json({ ...slim(found), text: found.text, source: index.source });
  }

  // ------------------------------------------------------------- evidence
  const evidence = url.pathname.match(/^\/api\/policies\/([^/]+)\/evidence$/);
  if (evidence) {
    const index = loadIndex();
    if (!index) return json({ available: false, reason: EMPTY_CORPUS_NOTE });
    const id = decodeURIComponent(evidence[1]!);
    const found = index.provisions.find((p) => p.id === id || p.act === id);
    if (!found) return json({ error: "Not found", id }, 404);

    // Every field the data-integrity rule demands, with an explicit marker when
    // the upstream build did not record it. Nothing is inferred.
    return json({
      provision: found.id,
      title: found.title,
      section: found.section ?? "NOT FOUND",
      authority: found.jurisdiction === "central" ? "INDIA" : found.jurisdiction.toUpperCase(),
      document_type: "LAW",
      status: found.status ?? "NOT VERIFIED",
      published: found.year !== null ? String(found.year) : "NOT FOUND",
      effective: found.effective_date ?? "NOT FOUND",
      retrieved_at: index.generated_at,
      source: index.source,
      official_source_url: found.source_url,
      original_document_url: found.document_url,
      text_truncated: found.text_truncated,
      text_full_chars: found.text_full_chars,
      quoted_text: found.text,
    });
  }

  return json({ error: "Not found" }, 404);
}

function slim(p: RankedProvision) {
  const { text: _text, ...rest } = p;
  return {
    ...rest,
    excerpt: (p.text ?? "").slice(0, 260),
    full_chars: p.text_full_chars,
  };
}
