#!/usr/bin/env python3
"""
Generate plain-English summaries for every provision in the statutory corpus
using a local summarization model (no external API). Output is a JSON map of
provision id -> summary, written to ml/data/provision_summaries.json and copied
to public/data/ for the policy API to serve.

Usage:
    python ml/summarize_corpus.py [--limit N] [--offset N] [--batch 8]
Resumable: already-summarized ids are skipped, so long runs can be chunked.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent
INDEX_PATH = ROOT / "data" / "evidence_index.json"
OUT_PATH = ROOT / "data" / "provision_summaries.json"

MODEL_ID = "sshleifer/distilbart-cnn-12-6"


def log(m: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="0 = all")
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--batch", type=int, default=4)
    args = ap.parse_args()

    index = json.loads(INDEX_PATH.read_text(encoding="utf-8", errors="replace"))
    provisions = index["provisions"]
    done = {}
    if OUT_PATH.exists():
        done = json.loads(OUT_PATH.read_text(encoding="utf-8", errors="replace"))
    log(f"{len(provisions)} provisions, {len(done)} already summarized")

    pending = [p for p in provisions if p["id"] not in done]
    pending = pending[args.offset : (args.offset + args.limit) if args.limit else None]
    log(f"this run: {len(pending)}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID)
    model.eval()

    for i in range(0, len(pending), args.batch):
        chunk = pending[i : i + args.batch]
        texts = []
        for p in chunk:
            t = (p.get("title") or "").strip()
            body = " ".join((p.get("text") or "").split())[:700]
            texts.append(f"{t}. {body}" if t else body)
        enc = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=768)
        with torch.no_grad():
            out = model.generate(
                **enc,
                max_new_tokens=40,
                min_new_tokens=10,
                num_beams=1,
                do_sample=False,
            )
        sums = tokenizer.batch_decode(out, skip_special_tokens=True)
        for p, s in zip(chunk, sums):
            done[p["id"]] = " ".join(s.split()).strip()
        if (i // args.batch) % 20 == 0:
            OUT_PATH.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
            log(f"{i + len(chunk)}/{len(pending)} ({len(done)} total)")

    OUT_PATH.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    log(f"wrote {len(done)} summaries to {OUT_PATH}")


if __name__ == "__main__":
    main()
