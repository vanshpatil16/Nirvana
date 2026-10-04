import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

interface ProvisionRow {
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
}

interface JurisdictionRow {
  jurisdiction: string;
  provisions: number;
}

const PAGE = 40;

/**
 * Extractive two-sentence summary of a provision excerpt: the excerpt starts
 * mid-statute, so the first raw 260 characters read like boilerplate. Taking
 * the leading sentences gives the actual operative text.
 */
function summarize(excerpt: string): string {
  const text = excerpt.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    const next = (out + " " + s.trim()).trim();
    if (out && next.length > 200) break;
    out = next;
    if (out.length > 90) break;
  }
  return out.length <= text.length ? out : text.slice(0, 197) + "…";
}

/**
 * Browse view over the full statutory corpus: every provision indexed from
 * India Code, paginated and filterable by jurisdiction. This is the listing
 * that lets the library surface all 14k+ provisions rather than only the 14
 * instruments that have a full simulation template.
 */
export function StatutoryBrowse() {
  const [jurisdictions, setJurisdictions] = useState<JurisdictionRow[]>([]);
  const [jurisdiction, setJurisdiction] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<ProvisionRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/policies/jurisdictions");
        if (!res.ok) return;
        const body = (await res.json()) as { jurisdictions?: JurisdictionRow[] };
        setJurisdictions(body.jurisdictions ?? []);
      } catch {
        /* the browse table still works unfiltered */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (jurisdiction) params.set("jurisdiction", jurisdiction);
      params.set("limit", String(PAGE));
      params.set("offset", String(offset));
      const res = await fetch(`/api/policies?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { total: number; results: ProvisionRow[] };
      setTotal(body.total);
      setRows(body.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [jurisdiction, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const missing = rows.filter((r) => !summaries[r.id]);
    if (!missing.length) return;
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/policies/summaries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: missing.map((r) => ({ id: r.id, title: r.title, excerpt: r.excerpt })),
          }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { summaries?: Record<string, string> };
        if (live && body.summaries) setSummaries((prev) => ({ ...prev, ...body.summaries }));
      } catch {
        /* cards fall back to the extractive summary */
      }
    })();
    return () => {
      live = false;
    };
    // summaries intentionally excluded: each id is fetched once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    <div className="pl-section">
      <div className="pl-section-head">
        <div>
          <span className="pl-eyebrow">Statutory corpus</span>
          <h2>
            {total === null
              ? "Indexed provisions"
              : `${total.toLocaleString("en-IN")} provisions indexed`}
          </h2>
          <p>
            Every provision parsed from India Code in this build. The 14 instruments above are
            the ones with a full simulation template; the corpus below is everything they draw
            citations from.
          </p>
        </div>
        <select
          aria-label="Filter by jurisdiction"
          className="pl-select"
          value={jurisdiction}
          onChange={(e) => {
            setJurisdiction(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All jurisdictions</option>
          {jurisdictions.map((j) => (
            <option key={j.jurisdiction} value={j.jurisdiction}>
              {j.jurisdiction} ({j.provisions.toLocaleString("en-IN")})
            </option>
          ))}
        </select>
      </div>
      <div className="pl-card" style={{ padding: 16 }}>
        {loading && (
          <p className="pl-muted">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </p>
        )}
        {error && <p className="pl-muted">Could not load: {error}</p>}
        <div className="pl-corpus-grid">
          {rows.map((r) => (
            <article key={r.id} className="pl-corpus-card">
              <div className="pl-corpus-top">
                <span className="pl-tag grey">{r.jurisdiction}</span>
                {r.year !== null && <span className="pl-tag grey">{r.year}</span>}
              </div>
              <h3>{r.title}</h3>
              <p className="pl-corpus-act">{r.act}</p>
              {(r.section || r.provision_title) && (
                <p className="pl-corpus-sec">
                  {r.section ? `§ ${r.section}` : ""}
                  {r.section && r.provision_title ? " · " : ""}
                  {r.provision_title ?? ""}
                </p>
              )}
              <p className="pl-corpus-excerpt">{summaries[r.id] ?? summarize(r.excerpt)}</p>
              {r.document_url ? (
                <a href={r.document_url} target="_blank" rel="noreferrer" className="pl-link">
                  India Code <ExternalLink size={12} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            paddingTop: 16,
            alignItems: "center",
          }}
        >
          <button
            className="pl-btn sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            Previous
          </button>
          <span className="pl-muted">
            {offset + 1}–{Math.min(offset + PAGE, total ?? offset + PAGE)}
            {total !== null ? ` of ${total.toLocaleString("en-IN")}` : ""}
          </span>
          <button
            className="pl-btn sm"
            disabled={loading || (total !== null && offset + PAGE >= total)}
            onClick={() => setOffset(offset + PAGE)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
