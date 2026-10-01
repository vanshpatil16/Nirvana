#!/usr/bin/env python3
"""Item 3 — Title Integrity rules.

The planned evaluation: 200 synthetic parcels with ownership chains, exactly 10
planted defects for each of 6 rules (orphaned deed, partition area mismatch,
share over-allocation, ghost transfer, temporal inversion, dormant succession),
run through the REAL rule engine, reporting per-rule recall, false positives on
clean parcels and precision.

That requires a rule engine to run. This script looks for one — functions that
take an ownership chain / parcel record and return rule violations. If none
exists it says so and stops. It does NOT implement the rules itself: grading an
engine written inside the evaluation would measure the evaluation, not the product.
"""

from __future__ import annotations

import json
import re

from _common import ROOT, not_measurable, write_json

RULES = ["orphaned deed", "partition", "share over-allocation", "ghost transfer", "temporal inversion", "dormant succession"]


def main() -> dict:
    src = [p for ext in ("*.ts", "*.tsx", "*.py") for p in [*ROOT.joinpath("src").rglob(ext), *ROOT.joinpath("scripts").glob(ext)]]
    hits: dict[str, list[str]] = {r: [] for r in RULES}
    engine_like: list[str] = []
    for p in src:
        s = p.read_text(encoding="utf-8", errors="ignore")
        rel = p.relative_to(ROOT).as_posix()
        for r in RULES:
            for i, line in enumerate(s.splitlines(), 1):
                if re.search(re.escape(r), line, re.I):
                    hits[r].append(f"{rel}:{i}: {line.strip()[:120]}")
        # anything that looks like executable rule logic over deeds / mutations / shares
        if re.search(
            r"(function|const|def)\s+\w*(orphan(ed)?_?deed|ghost_?transfer|temporal_?inversion|dormant_?succession|over_?allocat|partition_?(area|mismatch)|title_?(risk|integrity)|integrity_?(rule|check|score)|check_?title)\w*\s*(=|\()",
            s,
            re.I,
        ):
            engine_like.append(rel)

    out = not_measurable(
        "title_integrity_rules",
        missing=[
            "No rule engine: no function in the repo takes an ownership chain, deed list, mutation register or share table and returns rule violations (files with rule-like functions: " + (", ".join(engine_like) or "none") + ").",
            "No ownership-chain data model: there is no deed / mutation / succession / share record type to run rules over, and no Neo4j or other graph store (the only 'Neo4j' in the repo is a label on a UI chip).",
            "The 8 'integrity checks' and the Title Risk Score shown on /workflow are hard-coded per parcel in src/components/workflow/data.ts (`failed: [\"Orphaned deed\", \"Ghost transfer\", …]`, `score: 82`). They are not computed.",
        ],
        searched=["src/**/*.ts(x), scripts/*.py for the six rule names and for rule-like function definitions"],
    )
    out["where_the_rule_names_appear"] = {r: v[:6] for r, v in hits.items()}
    out["what_would_make_this_measurable"] = [
        "A typed ownership-chain model (deeds, mutations, successions, shares with dates and areas) and one pure function per rule returning violations.",
        "Then this script generates 200 seeded parcels, plants 10 defects per rule, and reports recall / false positives / precision against saved ground truth.",
    ]
    write_json("rules.json", out)
    return out


if __name__ == "__main__":
    print(json.dumps(main(), ensure_ascii=False, indent=2))
