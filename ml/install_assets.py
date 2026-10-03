#!/usr/bin/env python3
"""
Install the trained model artefacts into the frontend's asset directory.

`src/server/policies.ts` reads them from `public/data/` at request time rather
than importing them, so a 24 MB evidence index never enters the JS bundle.

Source of truth is `ml/data/`. Missing files are reported, not invented: the API
then serves `available: false` with the reason, which is what the product should
show rather than a blank list.

Usage
-----
    python ml/install_assets.py
    python ml/install_assets.py --check          # verify without copying
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent

ARTEFACTS = ["model_ts.json", "evidence_index.json", "model_report.json", "cv_progress.json"]


def log(m: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def verify(path: Path) -> str:
    """Parse and sanity-check one artefact. Returns a status string."""
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return f"UNREADABLE ({exc})"

    if path.name == "model_ts.json":
        per = obj.get("trees_per_class") or []
        n = int(sum(per)) if per else 0
        if not per:
            return "MISSING trees_per_class: this is a legacy multiclass bundle; " \
                   "the TypeScript scorer expects the one-vs-rest layout. Retrain."
        if n != len(obj.get("trees") or []):
            return f"MISMATCH trees_per_class sums to {n} but trees has {len(obj['trees'])}"
        if len(obj.get("vocabulary") or {}) != int(obj.get("n_features") or -1):
            return f"MISMATCH vocabulary has {len(obj.get('vocabulary') or {})} entries, " \
                   f"n_features says {obj.get('n_features')}"
        return f"OK  {len(per)} boosters, {n} trees, {len(obj.get('vocabulary') or {})} features"

    if path.name == "evidence_index.json":
        rows = obj.get("provisions") or []
        if not rows:
            return "EMPTY: no provisions"
        missing = sum(1 for r in rows if not r.get("source_url"))
        return (f"OK  {len(rows):,} provisions, {obj.get('counts', {}).get('acts', '?')} acts"
                + (f"; WARNING {missing:,} rows lack source_url" if missing else ""))

    if path.name == "model_report.json":
        cv = obj.get("cv") or {}
        return (f"OK  CV AUC {cv.get('auc_mean')} +/- {cv.get('auc_std')}, "
                f"F1 {cv.get('f1_mean')} +/- {cv.get('f1_std')}")

    return "OK"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=str(ROOT / "data"))
    ap.add_argument("--out-dir", default=str(REPO / "public" / "data"))
    ap.add_argument("--check", action="store_true", help="verify only, copy nothing")
    args = ap.parse_args()

    src_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)

    log(f"source: {src_dir}")
    log(f"target: {out_dir}")
    log("")

    problems = 0
    for name in ARTEFACTS:
        src = src_dir / name
        if not src.exists():
            log(f"  {name:22s} MISSING in {src_dir}")
            problems += 1
            continue
        status = verify(src)
        if status.startswith(("UNREADABLE", "MISSING", "MISMATCH", "EMPTY")):
            problems += 1
        mb = src.stat().st_size / 1e6
        if args.check:
            log(f"  {name:22s} {mb:7.1f} MB  {status}")
            continue

        out_dir.mkdir(parents=True, exist_ok=True)
        dst = out_dir / name
        shutil.copyfile(src, dst)
        log(f"  {name:22s} {mb:7.1f} MB  {status}")

    if args.check:
        log("")
        log("check only, nothing copied")
    else:
        log("")
        log(f"installed into {out_dir}")

    if problems:
        log("")
        log(f"{problems} artefact(s) missing or failing verification.")
        log("The API will serve available:false until these pass. That is the intended")
        log("behaviour: an absent model must be reported, never faked.")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
