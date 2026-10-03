/**
 * Statutory applicability scoring, in TypeScript, from the XGBoost dump.
 *
 * The model is trained in `ml/train_model.py` and exported to
 * `ml/data/model_ts.json` as a vocabulary + idf + tree array, so the product
 * scores a land situation without a Python runtime and without calling an
 * external inference service.
 *
 * This is the same arithmetic XGBoost performs, in the same order:
 *   margin_k = base_score + sum over the trees of class k of leaf value
 *   p_k      = sigmoid(margin_k)
 *
 * The formulation is ONE-VS-REST: 11 independent `binary:logistic` boosters,
 * because `multi:labelsoftprob` is absent from the installed XGBoost build.
 * Each subject therefore has its own probability and they do NOT sum to 1; a
 * provision legitimately matches several subjects at once. `trees_per_class`
 * says how many of the flat `trees` array belong to each booster.
 *
 * PROVENANCE, not a claim: the vocabulary, the idf weights and the leaf values
 * are copied verbatim from the trained model. Nothing here re-fits anything.
 */

/** A node of one XGBoost tree, in the shape `get_dump(dump_format: 'json')` emits. */
export interface TreeNode {
  nodeid: number;
  leaf?: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: TreeNode[];
}

export interface SubjectClass {
  name: string;
  probability: number;
}

export interface RankedProvision {
  id: string;
  act: string;
  title: string;
  provision_title: string | null;
  section: string | null;
  text: string;
  text_truncated: boolean;
  text_full_chars: number;
  jurisdiction: string;
  status: string | null;
  year: number | null;
  act_number: string | null;
  effective_date: string | null;
  provision_type: string | null;
  section_type: string | null;
  subjects: string[];
  acts_referenced: string[];
  has_proviso: boolean;
  source_url: string;
  document_url: string;
  /** TF-IDF cosine against the query. THIS is the ranking signal. */
  relevance: number;
  /** Raw one-vs-rest booster output. See `saturated` in the diagnostics. */
  model_probabilities: number[];
  /** Subjects whose booster cleared `subjectFloor`. May be empty. */
  model_subject_hits: { subject: string; probability: number }[];
}

/**
 * Measured facts about how the shipped model actually behaves, computed from the
 * bundle rather than assumed.
 */
export interface ModelDiagnostics {
  subjects: number;
  trees: number;
  /** Mean probability of a provision's strongest subject, over the sample. */
  mean_max_probability: number;
  /** Mean probability of a provision's weakest subject, over the sample. */
  mean_min_probability: number;
  /**
   * Mean of (max - min) across subjects, per provision. This is the number that
   * decides whether the boosters discriminate: if every subject lands within a
   * hair of every other, the output is a near-constant and must not be shown as
   * confidence, however high it reads.
   */
  mean_probability_spread: number;
  /** Fraction of sampled provisions where EVERY subject clears `saturationFloor`. */
  fraction_all_subjects_hot: number;
  saturated: boolean;
  sample_size: number;
  interpretation: string;
}

const SATURATION_FLOOR = 0.9;
const SPREAD_FLOOR = 0.15;

/**
 * Score a sample of the corpus and report how much the boosters discriminate.
 *
 * This exists because a squashed model looks perfect on screen. Reporting the
 * measurement is the difference between "the model says 0.99" and "the model
 * cannot tell these two subjects apart".
 */
export function diagnose(
  bundle: ModelBundle,
  index: EvidenceIndex,
  sampleSize = 300,
): ModelDiagnostics {
  const n = Math.min(sampleSize, index.provisions.length);
  const stride = Math.max(1, Math.floor(index.provisions.length / n));
  let sumMax = 0;
  let sumMin = 0;
  let sumSpread = 0;
  let allHot = 0;
  let counted = 0;

  for (let i = 0; i < index.provisions.length && counted < n; i += stride) {
    const p = index.provisions[i]!;
    const probs = score(bundle, p.text);
    if (!probs.length || probs.some((v) => Number.isNaN(v))) continue;
    const max = Math.max(...probs);
    const min = Math.min(...probs);
    sumMax += max;
    sumMin += min;
    sumSpread += max - min;
    if (probs.every((v) => v >= SATURATION_FLOOR)) allHot += 1;
    counted += 1;
  }

  const spread = counted > 0 ? sumSpread / counted : 0;
  const fraction = counted > 0 ? allHot / counted : 0;
  const saturated = spread < SPREAD_FLOOR;
  return {
    subjects: bundle.subjects.length,
    trees: bundle.tree_count,
    mean_max_probability: Number((counted > 0 ? sumMax / counted : 0).toFixed(4)),
    mean_min_probability: Number((counted > 0 ? sumMin / counted : 0).toFixed(4)),
    mean_probability_spread: Number(spread.toFixed(4)),
    fraction_all_subjects_hot: Number(fraction.toFixed(4)),
    saturated,
    sample_size: counted,
    interpretation: saturated
      ? `Squashed: the boosters put every subject within ${spread.toFixed(3)} of every other ` +
        `subject (mean spread ${spread.toFixed(3)} < ${SPREAD_FLOOR}), so the output carries ` +
        "almost no information about which subject applies. Ranking is carried by TF-IDF " +
        "cosine over the statute text. The cause is the labels, not the training: subject " +
        "facets are keyword hits in the same text the model reads, so every booster sees " +
        "strong evidence for its own keywords. Fixing it needs labels independent of the " +
        "text (provision_type / section_type), not a retune."
      : `Discriminating: mean spread ${spread.toFixed(3)} across subjects (floor ${SPREAD_FLOOR}), ` +
        `mean strongest subject ${(counted > 0 ? sumMax / counted : 0).toFixed(3)}. ` +
        "model_probabilities can be read as subject-level applicability, though the " +
        "absolute values are still high and should be compared within one result set.",
  };
}

export interface ModelBundle {
  generated_at: string;
  subjects: string[];
  seed: number;
  n_rows: number;
  n_features: number;
  n_enactments: number;
  folds: number;
  grouping: string;
  vocabulary: Record<string, number>;
  idf: number[];
  /** Trees per one-vs-rest booster, in subject order. */
  trees_per_class: number[];
  /**
   * Subjects that actually have a fitted booster. Present in newer artefacts;
   * absent ones are inferred by zipping `trees_per_class` onto `subjects`.
   */
  subjects_live?: string[];
  tree_count: number;
  trees: TreeNode[];
  /** Optional in the artefact: `binary:logistic` base is 0.5, i.e. margin 0. */
  base_score?: number;
}

export interface EvidenceIndex {
  generated_at: string;
  source: string;
  provenance_note: string;
  text_cap_chars: number;
  text_truncated_count: number;
  truncation_note: string;
  priority_jurisdictions: string[];
  counts: { acts: number; provisions: number; jurisdictions: number };
  provisions: RankedProvision[];
}

/**
 * XGBoost feature names are `f0`, `f1`, ... We must vectorise a query with the
 * *training* vocabulary and sublinear tf, in the exact tokenisation order
 * scikit-learn produced. Getting the tokeniser wrong degrades the model
 * silently rather than throwing, so this mirrors sklearn's defaults exactly.
 *
 * sklearn's TfidfVectorizer defaults that matter here:
 *   token_pattern  (?u)\b\w\w+\b  -> runs of 2+ word chars. Apostrophes and
 *                    hyphens are NOT word chars, so "tenant's holding" tokenises
 *                    to ["tenant", "s", ...] -> ["tenant"] because single chars
 *                    are dropped. Matching this exactly matters more than it
 *                    looks.
 *   \w is UNICODE    Python's `\w` matches letters and digits of every script;
 *                    JavaScript's `\w` is ASCII-only. Plain /\w\w+/ would split
 *                    Devanagari and ideographs into separate tokens and quietly
 *                    change the feature vector, so the class below is spelled
 *                    out as \p{L}\p{N} and the word boundaries are emulated with
 *                    lookarounds.
 *   bigram join     " " (a space), not "_". sklearn builds bigrams with
 *                    " ".join(tokens[i:i+n]); an underscore join makes every
 *                    bigram miss the vocabulary, and with ngram_range=(1,2)
 *                    that is half the feature space.
 *   order           strip_accents FIRST, then lower(). sklearn applies the
 *                    accent stripper before the lowercaser.
 */
const WORD_CLASS = "\\p{L}\\p{N}";
const TOKEN_RE = new RegExp(`(?<![${WORD_CLASS}_])[${WORD_CLASS}_]{2,}(?![${WORD_CLASS}_])`, "gu");

/** Strip accents the way sklearn's `strip_accents="unicode"` does (NFKD + remove marks). */
function stripAccents(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(text: string): string[] {
  return stripAccents(text).toLowerCase().match(TOKEN_RE) ?? [];
}

/**
 * Build a sparse TF-IDF vector for `text` using the training vocabulary.
 * Returns feature-index -> value, only for terms present in the vocabulary.
 */
export function vectorize(bundle: ModelBundle, text: string): Map<number, number> {
  const vec = new Map<number, number>();
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  // Term frequency, counting both unigrams and bigrams (ngram_range=(1, 2)).
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    counts.set(bg, (counts.get(bg) ?? 0) + 1);
  }

  let sumSq = 0;
  for (const [term, tf] of counts) {
    const col = bundle.vocabulary[term];
    if (col === undefined) continue;
    const idf = bundle.idf[col] ?? 1;
    // sublinear_tf: 1 + log(tf)
    const val = (1 + Math.log(tf)) * idf;
    vec.set(col, val);
    sumSq += val * val;
  }

  // L2 normalise, matching TfidfVectorizer's default norm='l2'.
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (const [k, v] of vec) vec.set(k, v / norm);
  }
  return vec;
}

/** Walk one tree, returning its leaf value. */
function evalTree(root: TreeNode, vec: Map<number, number>): number {
  let node = root;
  // Trees are finite; the guard prevents an infinite loop on a malformed dump.
  for (let guard = 0; guard < 512; guard += 1) {
    if (node.leaf !== undefined) return node.leaf;
    if (node.split === undefined) return 0;
    const col = Number(node.split.replace(/^f/, ""));
    const value = vec.get(col) ?? 0;
    if (value < (node.split_condition ?? 0)) {
      if (node.yes === undefined) return 0;
      const next = node.children?.find((c) => c.nodeid === node.yes);
      if (!next) return 0;
      node = next;
    } else {
      if (node.no === undefined) return 0;
      const next = node.children?.find((c) => c.nodeid === node.no);
      if (!next) return 0;
      node = next;
    }
  }
  return 0;
}

/**
 * Tree ranges per subject, in `bundle.trees` order.
 *
 * Older artefacts stored a flat class-major array; the shipped one-vs-rest
 * bundle declares the split explicitly via `trees_per_class`. If a subject was
 * too rare to fit a booster it gets an empty range and scores 0 rather than
 * silently borrowing another subject's trees.
 */
function classRanges(bundle: ModelBundle): Array<[number, number]> {
  const per = bundle.trees_per_class;
  if (!Array.isArray(per) || per.length === 0) {
    // Legacy multiclass layout: equal split, class-major.
    const n = Math.floor(bundle.trees.length / Math.max(bundle.subjects.length, 1));
    return bundle.subjects.map((_, k) => [k * n, n] as [number, number]);
  }

  const live = bundle.subjects_live;
  const ranges: Array<[number, number]> = [];
  let cursor = 0;
  for (let k = 0; k < bundle.subjects.length; k += 1) {
    const name = bundle.subjects[k]!;
    const slot = live ? live.indexOf(name) : k;
    if (slot < 0 || slot >= per.length) {
      ranges.push([0, 0]);
      continue;
    }
    const count = per[slot]!;
    ranges.push([cursor, count]);
    cursor += count;
  }
  return ranges;
}

/**
 * Score one text against the model, returning one independent probability per
 * subject. These do not sum to 1 — see the file header.
 */
export function score(bundle: ModelBundle, text: string): number[] {
  const vec = vectorize(bundle, text);
  const base = bundle.base_score ?? 0;
  return classRanges(bundle).map(([start, count]) => {
    let margin = base;
    for (let t = 0; t < count; t += 1) {
      const tree = bundle.trees[start + t];
      if (tree) margin += evalTree(tree, vec);
    }
    return 1 / (1 + Math.exp(-margin));
  });
}

/**
 * Inverted index over the corpus, so candidate generation is one pass of
 * lookups instead of a TF-IDF pass over every provision on every request.
 * Cached per EvidenceIndex instance.
 */
interface LexicalIndex {
  postings: Map<number, Array<[number, number]>>;
  norms: Float64Array;
}

const lexicalCache = new WeakMap<EvidenceIndex, LexicalIndex>();

export function buildLexicalIndex(bundle: ModelBundle, index: EvidenceIndex): LexicalIndex {
  const cached = lexicalCache.get(index);
  if (cached) return cached;

  const postings = new Map<number, Array<[number, number]>>();
  const norms = new Float64Array(index.provisions.length);
  index.provisions.forEach((p, row) => {
    const vec = vectorize(bundle, p.text);
    let sumSq = 0;
    for (const [col, weight] of vec) {
      sumSq += weight * weight;
      let list = postings.get(col);
      if (!list) {
        list = [];
        postings.set(col, list);
      }
      list.push([row, weight]);
    }
    norms[row] = Math.sqrt(sumSq);
  });

  const built: LexicalIndex = { postings, norms };
  lexicalCache.set(index, built);
  return built;
}

/** Cosine similarity of the query against every provision, via the postings. */
function lexicalScores(lex: LexicalIndex, qvec: Map<number, number>): Float64Array {
  const scores = new Float64Array(lex.norms.length);
  for (const [col, qw] of qvec) {
    const list = lex.postings.get(col);
    if (!list) continue;
    for (const [row, pw] of list) scores[row]! += qw * pw;
  }
  for (let i = 0; i < scores.length; i += 1) {
    const n = lex.norms[i]!;
    if (n > 0) scores[i]! /= n;
  }
  return scores;
}

/**
 * Rank provisions for a query and return the strongest with their evidence.
 *
 * WHAT ACTUALLY RANKS. Two stages, and it matters which one does the work:
 *
 *   1. TF-IDF cosine over the statute text produces the candidate pool AND the
 *      final order. This is the ranking signal, and it is honest: a provision is
 *      returned because the words of the query and the words of the statute
 *      actually overlap.
 *   2. The trained boosters score that pool. Their output is reported as
 *      `model_probabilities`, but it is deliberately NOT the sort key: with
 *      keyword-derived labels these boosters saturate (see `diagnose`), so
 *      sorting by them would be ordering by a near-constant.
 *
 * `pool` bounds stage 2's cost; raise it to widen recall, lower it for latency.
 */
export function rank(
  bundle: ModelBundle,
  index: EvidenceIndex,
  query: string,
  opts: {
    jurisdiction?: string | undefined;
    limit?: number;
    /** Minimum cosine for a provision to be returned at all. */
    minRelevance?: number;
    /** Per-subject probability needed to appear in `model_subject_hits`. */
    subjectFloor?: number;
    pool?: number;
  } = {},
): RankedProvision[] {
  const { jurisdiction, limit = 8, minRelevance = 0.02, subjectFloor = 0.5, pool = 400 } = opts;

  const lex = buildLexicalIndex(bundle, index);
  const qvec = vectorize(bundle, query);
  const cos = lexicalScores(lex, qvec);

  const candidates: Array<[number, number]> = [];
  for (let row = 0; row < cos.length; row += 1) {
    const p = index.provisions[row]!;
    if (jurisdiction && p.jurisdiction !== jurisdiction) continue;
    const c = cos[row]!;
    if (c <= 0) continue;
    candidates.push([row, c]);
  }
  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b[1] - a[1]);
  const shortlist = candidates.slice(0, Math.max(pool, limit));

  const scored: RankedProvision[] = [];
  for (const [row, cosine] of shortlist) {
    if (cosine < minRelevance) continue;
    const p = index.provisions[row]!;
    const probs = score(bundle, p.text);

    scored.push({
      ...p,
      relevance: Number(cosine.toFixed(4)),
      model_probabilities: probs.map((v) => Number(v.toFixed(4))),
      model_subject_hits: probs
        .map((prob, i) => ({ subject: bundle.subjects[i]!, probability: Number(prob.toFixed(4)) }))
        .filter((m) => m.probability >= subjectFloor)
        .sort((a, b) => b.probability - a.probability),
    });
  }

  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, limit);
}
