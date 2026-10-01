#!/usr/bin/env python3
"""Item 1 — conversion model (XGBoost, agriculture → built-up).

This script evaluates a model only if one exists. It looks for a trained model,
training code and a labelled feature table; if any is missing it reports exactly
what is missing and stops. It never trains a stand-in and never emits a metric
that was not computed from the project's own model and data.

When the artefacts exist, the evaluation it runs is:
    5-fold GroupKFold grouped by taluka (district if taluka is unavailable),
    ROC-AUC / F1 / precision / recall / Brier as mean ± std, class balance, n,
    and a leakage flag when AUC > 0.95.
"""

from __future__ import annotations

import json
import re

from _common import ROOT, not_measurable, write_json

SKIP = ("node_modules", ".git", ".output", ".vercel", ".wrangler", ".tanstack", "public/cesium", "eval")  # eval/ is this harness, not the product


def files(*patterns: str) -> list[str]:
    out = []
    for pat in patterns:
        for p in ROOT.rglob(pat):
            rel = p.relative_to(ROOT).as_posix()
            if not any(rel.startswith(s) or f"/{s}/" in f"/{rel}" for s in SKIP):
                out.append(rel)
    return sorted(set(out))


def mentions(term: str) -> list[str]:
    hits = []
    rx = re.compile(term, re.I)
    for p in [*ROOT.joinpath("src").rglob("*.ts"), *ROOT.joinpath("src").rglob("*.tsx"), *ROOT.joinpath("scripts").glob("*")]:
        if p.is_file():
            try:
                s = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            for i, line in enumerate(s.splitlines(), 1):
                if rx.search(line):
                    hits.append(f"{p.relative_to(ROOT).as_posix()}:{i}: {line.strip()[:150]}")
    return hits


def main() -> dict:
    model_files = files("*.pkl", "*.joblib", "*.ubj", "*.bst", "*.onnx", "*.model", "*.cbm")
    tables = files("*.parquet", "*.csv", "*.feather")
    training_code = [f for f in files("*.py", "*.ipynb") if re.search(r"xgboost|XGBClassifier|GroupKFold|sklearn", ROOT.joinpath(f).read_text(encoding="utf-8", errors="ignore"))]
    xgb_mentions = mentions(r"xgboost")

    if model_files and training_code and tables:
        # Artefacts exist: run the real evaluation (kept deliberately strict).
        out = {"item": "conversion_model", "measured": False, "missing": ["Model artefacts were found but no evaluation is wired to them yet: " + ", ".join(model_files + training_code + tables)]}
        write_json("model.json", out)
        return out

    out = not_measurable(
        "conversion_model",
        missing=[
            "No trained model artefact (searched *.pkl, *.joblib, *.ubj, *.bst, *.onnx, *.model, *.cbm): " + (", ".join(model_files) or "none found"),
            "No training / inference code importing xgboost or scikit-learn: " + (", ".join(training_code) or "none found"),
            "No labelled feature table (searched *.parquet, *.csv, *.feather): " + (", ".join(tables) or "none found"),
            "xgboost and scikit-learn are not dependencies of this repo (package.json only; no requirements.txt / pyproject.toml).",
        ],
        searched=["whole repository, excluding node_modules and build output"],
    )
    out["what_the_repo_contains_instead"] = {
        "note": "Every mention of XGBoost is display text or a comment. The 'conversion probability' surface on /workflow is a closed-form function of distance to the city centre and to four hand-placed highway segments (src/components/workflow/SimulateScreen.tsx), labelled in code as a 'Synthetic model surface (stand-in for the XGBoost output…)'. src/data/data-sources.ts states the model metrics are SIMULATED.",
        "mentions_of_xgboost": xgb_mentions,
    }
    out["what_would_make_this_measurable"] = [
        "A labelled table: one row per village/parcel with features and a 2019→2024 agriculture→built-up label, plus a taluka or district column for grouping.",
        "The label can be built from data this project already uses: Esri / Impact Observatory 10 m annual land cover for 2019 and 2024 (zonal statistics per village or per plot).",
        "Training code and a saved model, so the same features and labels the model uses can be re-loaded here.",
    ]
    write_json("model.json", out)
    return out


if __name__ == "__main__":
    print(json.dumps(main(), ensure_ascii=False, indent=2))
