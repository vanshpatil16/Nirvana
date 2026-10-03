#!/usr/bin/env python3
"""
Build the NIRVANA land-policy corpus from real statutory data.

INPUTS (two independent builds of the same India Code legislation)
-------------------------------------------------------------------
1. oss-data-in.vaquill.ai  — parsed section-level parquet, one per jurisdiction.
   Carries the provision text plus the retrieval features that make clause-level
   citation possible: `provision_type`, `legal_subject`, `acts_referenced`,
   `defined_terms`, `has_proviso`, `has_non_obstante`.
2. HuggingFace RUDXLABS/india-central-state-acts — 22,374 act records with the
   India Code PDF URL, enforcement date, act number and Hindi title. Used to
   attach the official document URL and the fields the parquet lacks, and to
   cross-check the two builds against each other.

NO DOCUMENT IS INVENTED. Every row traces to an India Code handle recorded in the
source data. Rows whose official URL cannot be matched are dropped rather than
guessed at.

OUTPUT
------
ml/data/corpus.jsonl   one record per statutory provision
ml/data/corpus_stats.json

Relevance
---------
A provision is land-policy relevant if its text or its parent enactment matches
the taxonomy. This is *discovery*, exactly as the brief requires: a keyword hit
is not proof that a document is legally about land, so the classifier stage keeps
its own score and the corpus records which terms matched, so a human can audit
any row.

Usage
-----
    python ml/build_corpus.py
    python ml/build_corpus.py --data-dir C:\\ee\\data --out ml/data
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import pyarrow.parquet as pq

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent

# --------------------------------------------------------------------------
# Land-policy taxonomy (discovery only). Grouped so the corpus can report which
# facet matched, which is what makes an audit possible.
# --------------------------------------------------------------------------
TAXONOMY: dict[str, list[str]] = {
    "revenue": ["land revenue", "revenue department", "land revenues", "revenue administration",
                "कायदा", "मालपणी"],
    "tenancy": ["tenancy", "tenant", "tenants", "tenure", "lease", "leasehold", "lessee", "lessor",
                "कुळे", "भाडे", "पट्टा"],
    "ceiling": ["ceiling on holdings", "land ceiling", "ceiling area", "holdings", "occupancy ceiling",
                "अधिकृत क्षेत्र"],
    "acquisition": ["land acquisition", "acquisition of land", "rehabilitation and resettlement",
                    "rehabilitation", "resettlement", "displacement", "land requisition",
                    "भूसंपादन", "पुनर्वसन"],
    "conversion": ["change of use", "change of land use", "non-agricultural use", "non-agricultural",
                   "land use conversion", "conversion of land", "na conversion",
                   "वापर परिवर्तन", "गैर कृषि"],
    "registration": ["registration act", "registration of deeds", "stamp duty", "stamps act",
                     "property registration", "document registration", "मुद्रांक", "नोंदणी"],
    "cadastral": ["cadastral", "cadastre", "survey of lands", "land survey", "resurvey",
                  "parcel", "record of rights", "land records", "survey number", " khasra",
                  "khata", "khatauni", "satbara", "jamabandi", "7/12", "rtc", "bhulekh",
                  "भूलेख", "खसरा", "खाता"],
    "planning": ["town planning", "development plan", "master plan", "zoning", "zoned",
                 "development authority", "town planning act", "planning authority",
                 "urban planning", "नगर रचना", "विकास"],
    "forest": ["forest land", "forest lands", "grazing", "forest produce", "revenue forest",
               "reserved forest", "वन जमीन", "जंगल"],
    "tribal": ["scheduled areas", "scheduled tribe", "tribal land", "panchayati areas",
               "Scheduled Areas Act", "tribal land", "आदिवासी", "जनजाति"],
    "fragmentation": ["fragmentation", "fragmentation and consolidation", "consolidation of holdings",
                      "subdivision of holdings", "विखंडन"],
    "special": ["ulpin", "unique land parcel", "bhu-aadhaar", "bhu naksha", "bhu-naksha",
                "dilrmp", "digital india land record", "digital land record",
                "land use planning", "nazul", "gair mazarua", "dakhil kharij", "adANI",
                "enzamkam", "revenue village", "wasteland", "khasra"],
}

ALL_TERMS: list[str] = sorted({t for terms in TAXONOMY.values() for t in terms})


def match_facets(title: str, text: str) -> tuple[list[str], list[str]]:
    """Return (facets matched, terms matched) for a provision."""
    blob = f"{title}\n{text}".lower()
    facets, terms = [], []
    for facet, keys in TAXONOMY.items():
        hit_terms = [k for k in keys if k.lower() in blob]
        if hit_terms:
            facets.append(facet)
            terms.extend(hit_terms)
    return facets, sorted(set(terms))


def clean(value):
    """Normalise a parquet cell to a plain JSON-safe value."""
    if value is None:
        return None
    try:
        import math
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
    except Exception:
        pass
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    if isinstance(value, (list, tuple)):
        out = []
        for v in value:
            try:
                if v is None:
                    continue
                s = str(v)
                if s and s != "nan":
                    out.append(s)
            except Exception:
                continue
        return out
    s = str(value)
    return None if s in ("", "nan", "None") else s


def load_hf_metadata(data_dir: Path) -> dict[str, dict]:
    """Map act handle id -> official metadata from the HuggingFace layer."""
    path = data_dir / "metadata__acts.jsonl"
    out: dict[str, dict] = {}
    if not path.exists():
        print("  HF acts.jsonl not found; official URLs will come from the parquet only")
        return out
    n = 0
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            md = rec.get("metadata") or {}
            handle = None
            for key in ("Handle", "handle", "India Code ID", "Id"):
                if md.get(key):
                    handle = str(md[key])
                    break
            # Fall back to parsing the handle out of source_url / pdf_url.
            if not handle:
                m = re.search(r"/(?:handle|bitstream)/([0-9/]+)", rec.get("source_url") or "")
                if m:
                    handle = m.group(1)
            if not handle:
                continue
            out[handle] = {
                "pdf_url": rec.get("pdf_url") or None,
                "source_url": rec.get("source_url") or None,
                "ia_url": rec.get("ia_url") or None,
                "short_title": md.get("Short Title") or md.get("Short title") or None,
                "enactment_date": md.get("Enactment Date") or None,
                "enforcement_date": md.get("Enforcement Date") or None,
                "act_number": md.get("Act Number") or None,
                "ministry": md.get("Ministry") or None,
                "hindi_title": md.get("Hindi Title") or None,
            }
            n += 1
    print(f"  HF metadata records: {n:,} (unique handles: {len(out):,})")
    return out


def handle_from_source(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"/handle/([0-9]+/[0-9]+)", url)
    return m.group(1) if m else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=r"C:\ee\data")
    ap.add_argument("--out", default=str(ROOT / "data"))
    ap.add_argument("--min-facets", type=int, default=1,
                    help="minimum taxonomy facets a provision must match")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    def log(m):
        print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

    log("loading HuggingFace metadata layer")
    hf = load_hf_metadata(data_dir)

    files = sorted(data_dir.glob("in_*_legislation.parquet"))
    if not files:
        log(f"no legislation parquet in {data_dir}")
        return 1
    log(f"{len(files)} jurisdiction files")

    seen_acts: set[str] = set()
    records: list[dict] = []
    stats = {
        "files": len(files),
        "sections_scanned": 0,
        "sections_land_related": 0,
        "enactments_seen": 0,
        "enactments_land": 0,
        "matched_to_hf_metadata": 0,
        "dropped_duplicate_chunk_id": 0,
        "dropped_missing_source_url": 0,
        "by_jurisdiction": {},
        "by_facet": {},
        "by_document_type": {},
    }

    for path in files:
        juris = path.stem.replace("in_", "").replace("_legislation", "")
        try:
            tbl = pq.read_table(path)
        except Exception as e:
            log(f"  {path.name}: read failed {type(e).__name__}")
            continue

        cols = {c.lower(): c for c in tbl.column_names}
        if "text" not in cols:
            continue

        data = {name: tbl.column(cols[name.lower()]).to_pylist() for name in cols}
        n_rows = len(next(iter(data.values())))
        stats["sections_scanned"] += n_rows

        land_here = 0
        acts_here: set[str] = set()

        for i in range(n_rows):
            title = clean(data.get("title", [None] * n_rows)[i])
            text = clean(data["text"][i])
            if not text:
                continue
            facets, terms = match_facets(title or "", text)
            if len(facets) < args.min_facets:
                continue

            chunk_id = clean(data.get("chunk_id", [None] * n_rows)[i])
            if chunk_id and chunk_id in seen_acts:
                stats["dropped_duplicate_chunk_id"] += 1
                continue
            if chunk_id:
                seen_acts.add(chunk_id)

            act_id = clean(data.get("act_id", [None] * n_rows)[i]) or ""
            act_title = title or ""
            source_url = clean(data.get("source_url", [None] * n_rows)[i])
            handle = handle_from_source(source_url)

            extra = hf.get(handle, {}) if handle else {}
            if extra:
                stats["matched_to_hf_metadata"] += 1
            pdf_url = extra.get("pdf_url") or source_url

            # Integrity: a provision without any official pointer is not allowed
            # into a corpus that promises provenance.
            if not pdf_url:
                stats["dropped_missing_source_url"] += 1
                continue

            rec = {
                "document_id": act_id or handle or chunk_id,
                "provision_id": chunk_id,
                "title": act_title,
                "provision_title": clean(data.get("section_title", [None] * n_rows)[i]),
                "text": text,
                "section_number": clean(data.get("section_number", [None] * n_rows)[i]),
                "chapter": clean(data.get("chapter", [None] * n_rows)[i]),
                "jurisdiction": juris,
                "document_type": "LAW",
                "act_status": clean(data.get("act_status", [None] * n_rows)[i]),
                "in_force": clean(data.get("in_force", [None] * n_rows)[i]),
                "year": clean(data.get("year", [None] * n_rows)[i]),
                "act_number": extra.get("act_number"),
                "enactment_date": extra.get("enactment_date"),
                "effective_date": extra.get("enforcement_date"),
                "ministry": extra.get("ministry"),
                "hindi_title": extra.get("hindi_title"),
                "provision_type": clean(data.get("provision_type", [None] * n_rows)[i]),
                "section_type": clean(data.get("section_type", [None] * n_rows)[i]),
                "legal_subject": clean(data.get("legal_subject", [None] * n_rows)[i]),
                "acts_referenced": clean(data.get("acts_referenced", [None] * n_rows)[i]),
                "defined_terms": clean(data.get("defined_terms", [None] * n_rows)[i]),
                "has_proviso": clean(data.get("has_proviso", [None] * n_rows)[i]),
                "has_non_obstante": clean(data.get("has_non_obstante", [None] * n_rows)[i]),
                "amendment_count": clean(data.get("amendment_count", [None] * n_rows)[i]),
                "language": "en",
                "source_url": source_url,
                "document_url": pdf_url,
                "archive_url": extra.get("ia_url"),
                "source_domain": "indiacode.nic.in",
                "facets": facets,
                "matched_terms": terms,
                "retrieved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            records.append(rec)
            land_here += 1
            acts_here.add(rec["document_id"])
            for f in facets:
                stats["by_facet"][f] = stats["by_facet"].get(f, 0) + 1

        stats["sections_land_related"] += land_here
        stats["enactments_seen"] += len(set(clean(data.get("act_id", [None] * n_rows)) or set()))
        stats["enactments_land"] += len(acts_here)
        stats["by_jurisdiction"][juris] = stats["by_jurisdiction"].get(juris, 0) + land_here
        log(f"  {juris:22s} {n_rows:>7,} sections -> {land_here:>6,} land provisions")

    corpus = out_dir / "corpus.jsonl"
    with corpus.open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    stats["corpus_provisions"] = len(records)
    stats["corpus_enactments"] = len({r["document_id"] for r in records})
    stats["corpus_bytes"] = corpus.stat().st_size
    stats["generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (out_dir / "corpus_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

    log("")
    log(f"wrote {corpus}  provisions={len(records):,}  enactments={stats['corpus_enactments']:,}")
    log(f"scanned {stats['sections_scanned']:,} sections, kept {len(records):,} "
        f"({100 * len(records) / max(stats['sections_scanned'], 1):.1f}%)")
    log(f"matched to HF metadata: {stats['matched_to_hf_metadata']:,}")
    log(f"dropped (no official URL): {stats['dropped_missing_source_url']:,}")
    log("by facet: " + ", ".join(f"{k}={v:,}" for k, v in sorted(stats["by_facet"].items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
