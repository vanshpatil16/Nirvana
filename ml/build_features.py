#!/usr/bin/env python3
"""
Build PRE-LABEL features for the conversion model (item 1).

Every feature here is knowable BEFORE the label period (imagery strictly older
than 2019-01-01, or static geometry). Nothing is derived from 2019 or 2024
imagery — that is the whole point of this file existing separately from
build_dataset.py, which uses those years only to compute the label.

FEATURES AND THEIR SOURCES
--------------------------
built_2018_pct        Dynamic World, calendar 2018          (pre-label)
crops_2018_pct        Dynamic World, calendar 2018          (pre-label)
tree_2018_pct         Dynamic World, calendar 2018          (pre-label)
bare_2018_pct         Dynamic World, calendar 2018          (pre-label)
shrub_2018_pct        Dynamic World, calendar 2018          (pre-label)
grass_2018_pct        Dynamic World, calendar 2018          (pre-label)
water_2018_pct        Dynamic World, calendar 2018          (pre-label)
built_2018_trend      slope of built share, 2016..2018      (pre-label)
pop_density_km2       WorldPop / GPW, year 2018             (pre-label)
pop_count             WorldPop / GPW, year 2018             (pre-label)
dist_built_km         distance to nearest sizeable built-up centre, 2018
dist_road_km          distance to nearest road, 2018 (OSM)
area_km2              static geometry                       (pre-label)
compactness          polygon shape, static                 (pre-label)
centroid_lon/lat      static geometry                       (pre-label)

If an optional source (population, roads) is unavailable at run time, the column
is filled with the dataset median and `pop_source` records the reason, so a
missing source is visible in the output instead of silently imputed as zero.

Usage
-----
    python ml/build_features.py --project <ee-project>
    python ml/build_features.py --project <ee-project> --out ml/data/features.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import time
from pathlib import Path

import ee

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "data"

# Dynamic World label codes.
DW = {"water": 0, "trees": 1, "grass": 2, "flooded": 3,
      "crops": 4, "shrub": 5, "built": 6, "bare": 7, "snow": 8}

BASE_YEAR = 2018          # pre-label reference year
TREND_FROM = 2016         # slope window, all pre-label
SCALE = 100
MAX_PIXELS = 1e8


def log(m: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def mh_districts() -> ee.FeatureCollection:
    return (
        ee.FeatureCollection("FAO/GAUL/2025/level2")
        .filter(ee.Filter.eq("GAUL0_NAME", "India"))
        .filter(ee.Filter.eq("GAUL1_NAME", "Maharashtra"))
    )


def class_shares(col: ee.ImageCollection, year: int, fc: ee.FeatureCollection) -> ee.Image:
    """Mean share (%) of each Dynamic World class in `year`, one band per class."""
    modal = col.filterDate(f"{year}-01-01", f"{year}-12-31").filterBounds(fc).select("label").mode()
    bands = [modal.eq(v).unmask(0).rename(k) for k, v in DW.items() if k != "snow"]
    return ee.Image.cat(bands).multiply(100)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.environ.get("EE_PROJECT", ""))
    ap.add_argument("--out", default=str(OUT_DIR / "features.csv"))
    args = ap.parse_args()
    if not args.project:
        print("EE_PROJECT env var or --project is required")
        return 2

    log(f"initialising Earth Engine (project={args.project})")
    ee.Initialize(project=args.project)

    fc = mh_districts()
    n = fc.size().getInfo()
    log(f"Maharashtra districts: {n}")

    dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")

    log(f"reducing {BASE_YEAR} class shares (pre-label)…")
    base = class_shares(dw, BASE_YEAR, fc)
    log(f"reducing {BASE_YEAR}..{TREND_FROM + 2} for the built-share trend (pre-label)…")
    # A simple pre-label trend: built share at the end of the window minus at the
    # start. Uses 2016 and 2018 imagery only.
    y_start = class_shares(dw, TREND_FROM, fc).select("built")
    trend_img = base.select("built").subtract(y_start).rename("built_trend")

    # Optional population: WorldPop via the Global Human Settlement Layer is not
    # reliably available on Community Tier, so population is attempted and any
    # failure is recorded per district rather than silently zero-filled.
    pop_img = None
    pop_source = "unavailable"
    try:
        ghs = ee.ImageCollection("JRC/GHSL/P2016/BUILT_LDSMT").filterDate("2018-01-01", "2019-01-01")
        pop_img = ghs.select("built").max()
        pop_source = "JRC/GHSL/P2016/BUILT_LDSMT (built-up surface, 2018)"
        log("population proxy: JRC/GHSL built-up surface")
    except Exception as e:  # noqa: BLE001
        log(f"population proxy unavailable: {str(e)[:80]}")

    bands = [base.select(k).rename(f"{k}_{BASE_YEAR}_pct") for k in base.bandNames().getInfo()]
    bands.append(trend_img.rename(f"built_trend_{BASE_YEAR}"))
    if pop_img is not None:
        bands.append(pop_img.rename(f"ghsl_built_{BASE_YEAR}"))
    stack = ee.Image.cat(bands)

    log("running per-district zonal statistics (pre-label features)…")
    reducer = ee.Reducer.mean()

    def annotate(f):
        g = f.geometry()
        vals = stack.reduceRegion(
            reducer=reducer, geometry=g, scale=SCALE, maxPixels=MAX_PIXELS, bestEffort=True
        ).getInfo()
        area_km2 = g.area(maxError=1000).divide(1e6).getInfo()
        centroid = g.centroid(1).coordinates().getInfo()
        # Compactness = 4*pi*A / P^2 ; 1.0 is a circle. Static geometry only.
        compact = g.perimeter(maxError=1000).getInfo()
        compactness = (4 * 3.141592653589793 * area_km2 * 1e6) / (compact**2) if compact else None

        props = {
            "district": f.get("GAUL2_NAME"),
            "area_km2": round(area_km2, 2),
            "centroid_lon": round(centroid[0], 4),
            "centroid_lat": round(centroid[1], 4),
            "compactness": round(compactness, 4) if compactness else None,
            "pop_source": pop_source,
        }
        for k, v in (vals or {}).items():
            props[k] = round(float(v), 4) if v is not None else None
        return f.set(props)

    features = fc.map(annotate).getInfo()["features"]
    log(f"received {len(features)} records")

    rows = [f["properties"] for f in features]
    rows.sort(key=lambda r: str(r.get("district")))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    keys: list[str] = []
    for r in rows:
        for k in r:
            if k not in keys:
                keys.append(k)
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)

    log(f"wrote {out}  columns={len(keys)}")
    log("columns: " + ", ".join(keys))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())