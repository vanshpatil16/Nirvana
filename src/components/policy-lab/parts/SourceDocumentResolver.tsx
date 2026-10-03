/**
 * Source-document resolver.
 *
 * The prototype library declares `sourceFile` names but ships no PDFs, so its
 * cards had nothing to open. This asks the statutory API whether the corpus holds
 * a real official document for the instrument's title, and shows the answer:
 *
 *   resolved  -> the real India Code URL, labelled as PDF or landing page, with
 *                the matched enactment's title, year and status so the user can
 *                see whether the match is the instrument they meant;
 *   refused   -> an explicit "no document in this build", never a guessed link.
 *
 * A title match can land on a neighbouring enactment, so the match is shown next
 * to the link rather than behind it.
 */

import { useCallback, useState } from "react";
import { FileText, ExternalLink, Loader2, SearchX, AlertTriangle } from "lucide-react";

interface ResolvedMatch {
  act: string;
  title: string;
  jurisdiction: string;
  year: number | null;
  status: string | null;
  provisions_in_index: number;
  match_score: number;
}

interface DocumentResponse {
  query: string;
  resolved: boolean;
  reason?: string;
  match?: ResolvedMatch;
  document_url?: string;
  source_url?: string;
  is_pdf?: boolean;
  document_kind?: string;
  note?: string;
  candidates?: Array<{ act: string; title: string; jurisdiction: string; score: number }>;
}

export function SourceDocumentResolver({
  title,
  jurisdiction = "auto",
}: {
  title: string;
  jurisdiction?: string;
}) {
  const [state, setState] = useState<{ loading: boolean; data: DocumentResponse | null }>({
    loading: false,
    data: null,
  });

  const resolve = useCallback(async () => {
    setState({ loading: true, data: null });
    try {
      const res = await fetch(
        `/api/policies/document?jurisdiction=${encodeURIComponent(jurisdiction)}&title=${encodeURIComponent(title)}`,
      );
      const body = (await res.json()) as DocumentResponse;
      setState({ loading: false, data: body });
    } catch (e) {
      setState({
        loading: false,
        data: {
          query: title,
          resolved: false,
          reason: `Could not reach the document resolver (${String(e)}).`,
        },
      });
    }
  }, [title, jurisdiction]);

  if (!state.data) {
    return (
      <button className="pl-btn sm" onClick={() => void resolve()} disabled={state.loading}>
        {state.loading ? (
          <Loader2 className="spin" aria-hidden="true" />
        ) : (
          <FileText aria-hidden="true" />
        )}
        Find the official document
      </button>
    );
  }

  const d = state.data;

  if (!d.resolved) {
    return (
      <div className="pl-docref">
        <p className="pl-docref-head">
          <SearchX aria-hidden="true" />
          <strong>No official document in this build</strong>
        </p>
        <p>{d.reason}</p>
        {d.candidates && d.candidates.length > 0 && (
          <details>
            <summary>Closest enactments in the corpus ({d.candidates.length})</summary>
            <ul>
              {d.candidates.map((c) => (
                <li key={c.act}>
                  <b>{c.title}</b> <span>{c.jurisdiction}</span> — match {c.score}
                </li>
              ))}
            </ul>
          </details>
        )}
        <button className="pl-btn sm ghost" onClick={() => void resolve()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="pl-docref ok">
      <p className="pl-docref-head">
        <FileText aria-hidden="true" />
        <strong>Official document found</strong>
        <em>{d.document_kind}</em>
      </p>
      <p className="pl-docref-match">
        Matched enactment: <b>{d.match?.title}</b>
        {d.match?.jurisdiction ? ` · ${d.match.jurisdiction.toUpperCase()}` : ""}
        {d.match?.year ? ` · ${d.match.year}` : ""}
        {d.match?.status ? ` · ${d.match.status}` : ""}
        {d.match ? ` · ${d.match.provisions_in_index} provisions indexed` : ""}
      </p>
      <div className="pl-hit-actions">
        <a className="pl-btn sm primary" href={d.document_url} target="_blank" rel="noreferrer">
          {d.is_pdf ? "Open the PDF" : "Open on India Code"} <ExternalLink aria-hidden="true" />
        </a>
        {d.source_url && (
          <a className="pl-btn sm ghost" href={d.source_url} target="_blank" rel="noreferrer">
            Official handle
          </a>
        )}
      </div>
      {d.note && (
        <p className="pl-docref-note">
          <AlertTriangle aria-hidden="true" />
          {d.note}
        </p>
      )}
    </div>
  );
}
