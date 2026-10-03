#!/usr/bin/env python3
"""
Export a compact inference bundle for the frontend.

The full corpus is 154 MB, which is not something a Vercel function should hold.
This builds two artefacts instead:

  evidence_index.json  a de-duplicated slice of the corpus: every land enactment,
                       but at most `--per-act` provisions each, kept in
                       Maharashtra first so the demo jurisdiction is complete.
                       Each entry keeps only what a citation needs plus the body
                       text used for scoring.

  model_ts.json        written by ml/train_model.py: TF-IDF vocabulary + idf +
                       the XGBoost tree dump, so inference runs in TypeScript
                       with no Python runtime.

Nothing is summarised or paraphrased. `text` is the section body exactly as the
statute gives it, and `source_url` / `document_url` are the India Code links
already recorded in the corpus.

Usage
-----
    python ml/export_bundle.py
    python ml/export_bundle.py --per-act 12 --max-bytes 20000000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent


def log(m: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=str(ROOT / "data"))
    ap.add_argument("--per-act", type=int, default=10,
                    help="max provisions kept per enactment")
    ap.add_argument("--text-chars", type=int, default=1400,
                    help="chars of section body kept for scoring; the official "
                         "document_url always holds the full text")
    ap.add_argument("--priority", default="maharashtra",
                    help="jurisdiction kept in full, comma separated")
    ap.add_argument("--max-bytes", type=int, default=26_000_000)
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    corpus = data_dir / "corpus.jsonl"
    if not corpus.exists():
        log("corpus missing; run ml/build_corpus.py first")
        return 1

    priority = {j.strip() for j in args.priority.split(",") if j.strip()}
    recs = [json.loads(l) for l in corpus.open(encoding="utf-8")]
    log(f"loaded {len(recs):,} provisions")

    by_act: dict[str, list[dict]] = defaultdict(list)
    for r in recs:
        by_act[r["document_id"]].append(r)

    # Keep the longest provisions: a long section carries more statutory signal
    # than a one-line commencement clause, and scoring is more useful on real
    # operative text.
    kept: list[dict] = []
    acts_kept = 0
    for act_id, rows in by_act.items():
        juris = rows[0]["jurisdiction"]
        rows.sort(key=lambda r: len(r.get("text") or ""), reverse=True)
        cap = len(rows) if juris in priority else min(args.per_act, len(rows))
        for r in rows[:cap]:
            kept.append(r)
        acts_kept += 1
    log(f"acts: {acts_kept:,}  provisions kept: {len(kept):,}")

    out_rows = []
    truncated = 0
    for r in kept:
        body = r.get("text") or ""
        clipped = body[: args.text_chars]
        if len(body) > args.text_chars:
            truncated += 1
        out_rows.append({
            "id": r["provision_id"],
            "act": r["document_id"],
            "title": r["title"],
            "provision_title": r["provision_title"],
            "section": r["section_number"],
            "text": clipped,
            "text_truncated": len(body) > args.text_chars,
            "text_full_chars": len(body),
            "jurisdiction": r["jurisdiction"],
            "status": r["act_status"],
            "year": r["year"],
            "act_number": r["act_number"],
            "effective_date": r["effective_date"],
            "provision_type": r["provision_type"],
            "section_type": r["section_type"],
            "subjects": r["facets"],
            "acts_referenced": (r["acts_referenced"] or [])[:8],
            "has_proviso": r["has_proviso"],
            "source_url": r["source_url"],
            "document_url": r["document_url"],
        })

    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "open-india-law (parsed) + RUDXLABS (metadata); both derived from India Code",
        "provenance_note": "text is the statute body verbatim; source_url is the official "
                           "India Code handle; document_url is the official PDF bitstream",
        "text_cap_chars": args.text_chars,
        "text_truncated_count": truncated,
        "truncation_note": f"{truncated} provisions carry the first {args.text_chars} chars of "
                           f"the section body for scoring. text_full_chars records the true "
                           f"length and document_url opens the complete provision on India Code.",
        "priority_jurisdictions": sorted(priority),
        "counts": {
            "acts": acts_kept,
            "provisions": len(out_rows),
            "jurisdictions": len({r["jurisdiction"] for r in out_rows}),
        },
        "provisions": out_rows,
    }
    dest = data_dir / "evidence_index.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    size = dest.stat().st_size
    log(f"wrote {dest}  ({size / 1e6:.1f} MB)")

    if size > args.max_bytes:
        log(f"WARNING: bundle is {size / 1e6:.1f} MB, over the {args.max_bytes / 1e6:.0f} MB "
            f"budget. Lower --per-act.")
        return 1

    mh = sum(1 for r in out_rows if r["jurisdiction"] == "maharashtra")
    log(f"Maharashtra provisions in bundle: {mh:,}")
    log(f"subject coverage: " + ", ".join(
        f"{s}={sum(1 for r in out_rows if s in r['subjects']):,}"
        for s in sorted({s for r in out_rows for s in r['subjects']})))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
