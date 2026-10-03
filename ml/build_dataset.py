#!/usr/bin/env python3
"""
Build the labelled conversion dataset (item 1) from REAL land-cover observations.

LABEL
-----
For each of the 36 Maharashtra districts in GAUL 2025, compute the share of the
district that is cropland and the share that is built-up in an EARLY year (2019)
and a LATE year (2024), from Google Dynamic World (10 m, Sentinel-2 derived).

    label = 1  if  built_2024 - built_2019 >= +0.75 pp
                  and crops_2019 - crops_2024 >=  0.50 pp

The label is an OBSERVED conversion derived from real imagery.

LEAKAGE CONTROL — the main way this number goes wrong
----------------------------------------------------
* Label years (2019, 2024) are used ONLY to build the label. They are never
  features. The only imagery-based features come from PRE-2019 (see the feature
  build, ml/build_features.py), so nothing in the feature set is knowable only
  because we also know the outcome.
* Cross-validation is grouped by district (ml/train_xgboost.py), so a whole
  area is held out and neighbouring districts never straddle a fold.

WHY DISTRICT, NOT VILLAGE
------------------------
GAUL 2025 in Earth Engine carries no taluka or village layer, so the finest
available real polygon is the district. A district is ~10,000+ km2, which is
large enough that cropland/built change is a genuine regional signal rather than
pixel noise, and district is also the CV grouping key that prevents spatial
leakage. This limitation is reported, not hidden.

Usage
-----
    python ml/build_dataset.py --project <ee-project>
    python ml/build_dataset.py --project <ee-project> --out ml/data/districts.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from pathlib import Path

import ee

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "data"

DW_CROPS = 4   # Dynamic World label code
DW_BUILT = 6

EARLY_YEAR = 2019
LATE_YEAR = 2024

# Absolute, outcome-independent thresholds. +0.75 pp built and -0.50 pp cropland
# over five years is a real shift at district scale, not a rounding artefact.
BUILT_GAIN_PP = 0.75
CROP_LOSS_PP = 0.50

SCALE = 100
MAX_PIXELS = 1e8


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def mh_districts() -> ee.FeatureCollection:
    return (
        ee.FeatureCollection("FAO/GAUL/2025/level2")
        .filter(ee.Filter.eq("GAUL0_NAME", "India"))
        .filter(ee.Filter.eq("GAUL1_NAME", "Maharashtra"))
    )


def annual_shares(col: ee.ImageCollection, year: int, fc: ee.FeatureCollection) -> ee.Image:
    """One image holding three bands: built%, crops%, valid%, reduced per district.

    Vectorised so the whole state is one reduceRegion call per year rather than
    one call per district.
    """
    subset = col.filterDate(f"{year}-01-01", f"{year}-12-31").filterBounds(fc)
    modal = subset.select("label").mode()

    built = modal.eq(DW_BUILT).unmask(0).rename("built")
    crops = modal.eq(DW_CROPS).unmask(0).rename("crops")
    # `modal.mask()` keeps one band per input band, so reduce it to a single
    # band first. `cat` (not `add`) combines them, because `add` on multi-band
    # images pairs bands positionally and drops the rest.
    valid = modal.mask().reduce(ee.Reducer.max()).rename("valid")
    return ee.Image.cat([built, crops, valid]).multiply(100)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.environ.get("EE_PROJECT", ""))
    ap.add_argument("--out", default=str(OUT_DIR / "districts.csv"))
    ap.add_argument("--state", default="Maharashtra")
    args = ap.parse_args()

    if not args.project:
        print("EE_PROJECT env var or --project is required", file=sys.stderr)
        return 2

    log(f"initialising Earth Engine (project={args.project})")
    ee.Initialize(project=args.project)

    fc = (
        ee.FeatureCollection("FAO/GAUL/2025/level2")
        .filter(ee.Filter.eq("GAUL0_NAME", "India"))
        .filter(ee.Filter.eq("GAUL1_NAME", args.state))
    )
    n = fc.size().getInfo()
    log(f"{args.state} districts: {n}")
    if n == 0:
        print("no districts found", file=sys.stderr)
        return 1

    col = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
    log(f"reducing {EARLY_YEAR} (this can take a few minutes)…")
    early = annual_shares(col, EARLY_YEAR, fc)
    log(f"reducing {LATE_YEAR}…")
    late = annual_shares(col, LATE_YEAR, fc)

    # Earth Engine counts every pending reduceRegion, so even a 4-district batch
    # with 6 bands per district exceeds the cap. Reduce one district at a time,
    # one band at a time, and read each result eagerly.
    log("running per-district zonal statistics (1 district x 1 band at a time)…")

    codes = fc.aggregate_array("GAUL2_CODE").getInfo()
    names = fc.aggregate_array("GAUL2_NAME").getInfo()
    log(f"district codes: {len(codes)}")

    def geometry_for(code: str):
        return (
            ee.FeatureCollection("FAO/GAUL/2025/level2")
            .filter(ee.Filter.eq("GAUL2_CODE", code))
            .first()
            .geometry()
        )

    reducer = ee.Reducer.mean()
    features = []
    for i, (code, name) in enumerate(zip(codes, names)):
        geom = geometry_for(code)
        props = {"GAUL2_NAME": name, "GAUL1_NAME": args.state, "GAUL0_NAME": "India"}

        for key, image, band in (
            ("built_early", early, "built"),
            ("crops_early", early, "crops"),
            ("valid_early", early, "valid"),
            ("built_late", late, "built"),
            ("crops_late", late, "crops"),
            ("valid_late", late, "valid"),
        ):
            val = (
                image.select(band)
                .reduceRegion(
                    reducer=reducer, geometry=geom, scale=SCALE,
                    maxPixels=MAX_PIXELS, bestEffort=True,
                )
                .get(band)
                .getInfo()
            )
            props[key] = val

        props["area_km2"] = geom.area(maxError=1000).divide(1e6).getInfo()
        features.append({"type": "Feature", "geometry": None, "properties": props})
        log(f"  [{i + 1}/{len(codes)}] {name}: built={props['built_early']} crops={props['crops_early']}")

    log(f"received {len(features)} district records")

    rows = []
    for f in features:
        p = f["properties"]

        def g(k, default=0.0):
            v = p.get(k)
            return float(v) if v is not None else default

        built_e, built_l = g("built_early"), g("built_late")
        crops_e, crops_l = g("crops_early"), g("crops_late")
        valid = min(g("valid_early"), g("valid_late"))

        built_gain = built_l - built_e
        crop_loss = crops_e - crops_l
        label = int(built_gain >= BUILT_GAIN_PP and crop_loss >= CROP_LOSS_PP)

        rows.append(
            {
                "district": p.get("GAUL2_NAME"),
                "state": p.get("GAUL1_NAME"),
                "area_km2": round(g("area_km2"), 1),
                "valid_pct_2019": round(valid, 3),
                "valid_pct_2024": round(g("valid_late"), 3),
                "built_2019_pct": round(built_e, 4),
                "built_2024_pct": round(built_l, 4),
                "crops_2019_pct": round(crops_e, 4),
                "crops_2024_pct": round(crops_l, 4),
                "built_gain_pp": round(built_gain, 4),
                "crop_loss_pp": round(crop_loss, 4),
                "label": label,
            }
        )

    rows.sort(key=lambda r: str(r["district"]))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    pos = sum(r["label"] for r in rows)
    log("")
    log(f"wrote {out}")
    log(f"rows={len(rows)}  positives={pos}  positive_rate={pos / len(rows):.3f}")
    for r in rows:
        log(
            f"  {str(r['district']):20s} built {r['built_2019_pct']:6.2f}->{r['built_2024_pct']:6.2f} "
            f"({r['built_gain_pp']:+6.2f})  crops {r['crops_2019_pct']:6.2f}->{r['crops_2024_pct']:6.2f} "
            f"({r['crop_loss_pp']:+6.2f})  label={r['label']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())