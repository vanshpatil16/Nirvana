/**
 * Statutory Search — the real-data view inside Policy Lab.
 *
 * Everything on this screen comes from `GET /api/policies/*`, which is backed by
 * 71,522 provisions of Indian land legislation parsed from India Code. There is
 * no mock data here and no seeded "example" result: if the model artefacts are
 * not installed the screen says so, because a blank list that looks like "no
 * matching law" is a lie about a legal question.
 *
 * What the screen is careful about:
 *   - LAW is labelled LAW. Nothing here is called policy, implementation or
 *     outcome, because this corpus contains none of those.
 *   - Ranking is by TF-IDF cosine. The trained boosters' probabilities are shown
 *     only when the diagnostics say they discriminate, and the measured
 *     saturation verdict is displayed rather than hidden.
 *   - Every result carries its official India Code link. The screen's job is to
 *     get the user to the primary document, not to be the primary document.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scale, Search, ExternalLink, AlertTriangle, Loader2, Info } from "lucide-react";

interface SearchHit {
  id: string;
  act: string;
  title: string;
  section: string | null;
  provision_title: string | null;
  excerpt: string;
  jurisdiction: string;
  status: string | null;
  year: number | null;
  document_url: string;
  source_url: string;
  text_truncated: boolean;
  text_full_chars: number;
  relevance: number;
  model_subject_hits: { subject: string; probability: number }[];
}

interface Diagnostics {
  saturated: boolean;
  mean_max_probability: number;
  mean_min_probability: number;
  mean_probability_spread: number;
  sample_size: number;
  interpretation: string;
}

interface SearchResponse {
  query: string;
  ranking_signal: string;
  model_role: string;
  model_diagnostics: Diagnostics;
  source: string;
  disclaimer: string;
  results: SearchHit[];
  error?: string;
  reason?: string;
}

interface SourceStatus {
  available: boolean;
  reason?: string;
  corpus?: { acts: number; provisions: number; jurisdictions: number };
  source?: string;
  generated_at?: string;
  measurement?: {
    cv?: {
      scheme?: string;
      auc_mean?: number;
      auc_std?: number;
      f1_mean?: number;
      f1_std?: number;
    };
  } | null;
  model?: { subjects: string[]; rows: number; features: number; trees: number } | null;
  model_diagnostics?: Diagnostics | null;
}

async function getJson<T>(url: string): Promise<{ status: number; body: T }> {
  const res = await fetch(url);
  return { status: res.status, body: (await res.json()) as T };
}

export function StatutorySearchView() {
  const [status, setStatus] = useState<SourceStatus | null>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void getJson<SourceStatus>("/api/policies/source-status")
      .then((r) => setStatus(r.body))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const run = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSubmitted(trimmed);
    try {
      const r = await getJson<SearchResponse>(
        `/api/policies/search?q=${encodeURIComponent(trimmed)}`,
      );
      if (r.status !== 200 || !Array.isArray(r.body.results)) {
        setData(null);
        setError(r.body?.error ?? `Request failed (HTTP ${r.status})`);
        if (r.body?.reason) setError(`${r.body.error}: ${r.body.reason}`);
      } else {
        setData(r.body);
      }
    } catch (e) {
      setData(null);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const cv = status?.measurement?.cv;
  const diagnostics = data?.model_diagnostics ?? status?.model_diagnostics ?? null;

  const corpusLine = useMemo(() => {
    if (!status?.corpus) return null;
    const c = status.corpus;
    return `${c.provisions.toLocaleString("en-IN")} provisions · ${c.acts.toLocaleString("en-IN")} enactments · ${c.jurisdictions} jurisdictions`;
  }, [status]);

  return (
    <div className="pl-stack">
      {/* ---------------------------------------------------- corpus banner */}
      <section className="pl-card" aria-labelledby="statute-corpus">
        <div className="pl-card-head">
          <Scale aria-hidden="true" />
          <h2 id="statute-corpus">Statutory corpus — LAW</h2>
        </div>
        {status === null && !error && <p className="pl-muted">Loading corpus status…</p>}
        {status && !status.available && (
          <div className="pl-notice warn">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Corpus not installed in this build.</strong>
              <p>{status.reason}</p>
            </div>
          </div>
        )}
        {status?.available && (
          <>
            <p className="pl-muted">{corpusLine}</p>
            <p className="pl-muted">
              Source: {status.source}
              {status.generated_at ? ` · built ${status.generated_at}` : ""}
            </p>
            {status.model && (
              <p className="pl-muted">
                Model: {status.model.rows.toLocaleString("en-IN")} training rows ·{" "}
                {status.model.features.toLocaleString("en-IN")} TF-IDF features ·{" "}
                {status.model.trees} boosted trees over {status.model.subjects.length} subjects
              </p>
            )}
            {cv?.auc_mean !== undefined && (
              <p className="pl-muted">
                Held-out CV (whole Acts held out): AUC {cv.auc_mean} ± {cv.auc_std} · F1{" "}
                {cv.f1_mean} ± {cv.f1_std}
              </p>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------------- query */}
      <section className="pl-card" aria-labelledby="statute-search">
        <div className="pl-card-head">
          <Search aria-hidden="true" />
          <h2 id="statute-search">Which provision governs this situation?</h2>
        </div>
        <form
          className="pl-search"
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the land situation, e.g. tenant cultivating forest land"
            aria-label="Describe the land situation"
          />
          <button className="pl-btn" type="submit" disabled={loading || !query.trim()}>
            {loading ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : (
              <Search aria-hidden="true" />
            )}
            Rank provisions
          </button>
        </form>
        <p className="pl-muted">
          Returns statutory provisions that may apply. It does not forecast what a policy will
          achieve, and it is not legal advice.
        </p>
      </section>

      {error && (
        <div className="pl-notice warn" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Search unavailable.</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- results */}
      {data && (
        <section className="pl-card" aria-labelledby="statute-results">
          <div className="pl-card-head">
            <Scale aria-hidden="true" />
            <h2 id="statute-results">
              {data.results.length} provision{data.results.length === 1 ? "" : "s"} for “
              {data.query}”
            </h2>
          </div>

          <div className="pl-notice">
            <Info aria-hidden="true" />
            <div>
              <p>
                <strong>Ranking signal:</strong> {data.ranking_signal}
              </p>
              <p>{data.model_role}</p>
              {diagnostics && (
                <p>
                  <strong>Measured:</strong> across {diagnostics.sample_size} sampled provisions the
                  boosters put every subject within {diagnostics.mean_probability_spread} of every
                  other (strongest {diagnostics.mean_max_probability}, weakest{" "}
                  {diagnostics.mean_min_probability}).
                </p>
              )}
            </div>
          </div>

          {data.results.length === 0 && (
            <p className="pl-muted">
              No provision in the index shares enough vocabulary with that description. Try naming
              the subject matter directly (for example “ceiling on holdings”).
            </p>
          )}

          <ul className="pl-hits">
            {data.results.map((hit) => (
              <li key={hit.id} className="pl-hit">
                <div className="pl-hit-head">
                  <span className="pl-hit-rel" title="TF-IDF cosine relevance">
                    {hit.relevance.toFixed(3)}
                  </span>
                  <div>
                    <strong>{hit.title}</strong>
                    <p className="pl-muted">
                      {hit.jurisdiction.toUpperCase()}
                      {hit.section ? ` · section ${hit.section}` : ""}
                      {hit.year ? ` · ${hit.year}` : ""}
                      {hit.status ? ` · ${hit.status}` : ""}
                    </p>
                  </div>
                </div>
                {hit.provision_title && <p className="pl-hit-sub">{hit.provision_title}</p>}
                <p className="pl-hit-excerpt">{hit.excerpt}…</p>
                {hit.model_subject_hits.length > 0 && (
                  <p className="pl-hit-tags">
                    {hit.model_subject_hits.map((m) => (
                      <span key={m.subject}>{m.subject}</span>
                    ))}
                  </p>
                )}
                <div className="pl-hit-actions">
                  <button
                    className="pl-btn sm ghost"
                    onClick={() => setOpenId(openId === hit.id ? null : hit.id)}
                    aria-expanded={openId === hit.id}
                  >
                    {openId === hit.id ? "Hide" : "Provenance"}
                  </button>
                  <a className="pl-btn sm" href={hit.document_url} target="_blank" rel="noreferrer">
                    Open on India Code <ExternalLink aria-hidden="true" />
                  </a>
                </div>
                {openId === hit.id && (
                  <dl className="pl-prov">
                    <dt>Act id</dt>
                    <dd>{hit.act}</dd>
                    <dt>Official handle</dt>
                    <dd>
                      <a href={hit.source_url} target="_blank" rel="noreferrer">
                        {hit.source_url}
                      </a>
                    </dd>
                    <dt>Document</dt>
                    <dd>
                      <a href={hit.document_url} target="_blank" rel="noreferrer">
                        {hit.document_url}
                      </a>
                    </dd>
                    <dt>Excerpt length</dt>
                    <dd>
                      {hit.text_truncated
                        ? `first 260 characters of ${hit.text_full_chars.toLocaleString("en-IN")} — read the full section at the source`
                        : `${hit.text_full_chars.toLocaleString("en-IN")} characters`}
                    </dd>
                  </dl>
                )}
              </li>
            ))}
          </ul>

          <p className="pl-muted">{data.disclaimer}</p>
        </section>
      )}
    </div>
  );
}
