/**
 * Shared temporal model for the dashboard.
 *
 * Data contract:
 * - Multi-period REAL data = the annual Sentinel-2 cloudless mosaics
 *   (2018–2024). Scrubbing years genuinely changes imagery.
 * - Thematic choropleths ride a deterministic demo year series anchored on
 *   the observed state snapshots (see `yearAdjustedLevel` in IndiaMap.tsx),
 *   so every tab visibly responds to the timeline while `dataPeriod` keeps
 *   the real observed base label.
 * - The Climate Risk heat layer is live IMD weather (current observations,
 *   see src/server/weather-india.ts) and deliberately ignores the timeline —
 *   only the state fills on that tab follow the year series.
 * When a historical metrics API lands, swap the demo series for real
 * per-year values — no UI rewrite needed.
 */

import type { ThemeId } from "@/data/state-intelligence";
import { SATELLITE_MOSAICS } from "@/services/sentinelService";

export const MOSAIC_YEARS: readonly string[] = SATELLITE_MOSAICS;

export type PeriodStatus = "Observed" | "Unavailable";

export interface ThemeTimeline {
  theme: ThemeId;
  title: string;
  /** Big-descriptor under the year, changes per tab. */
  descriptor: string;
  /** Real period of the underlying thematic snapshot. */
  dataPeriod: string;
  status: PeriodStatus;
  statusNote: string;
}

export const THEME_TIMELINES: Record<ThemeId, ThemeTimeline> = {
  "land-use-change": {
    theme: "land-use-change",
    title: "Land Use Change",
    descriptor: "Land-use intensity by year",
    dataPeriod: "2015–2024",
    status: "Observed",
    statusNote: "Demo year series · annual mosaic",
  },
  disputes: {
    theme: "disputes",
    title: "Disputes",
    descriptor: "Dispute load by year",
    dataPeriod: "2024",
    status: "Observed",
    statusNote: "Demo year series · annual mosaic",
  },
  "climate-risk": {
    theme: "climate-risk",
    title: "Climate Risk",
    descriptor: "Climate vulnerability by year",
    dataPeriod: "2024",
    status: "Observed",
    statusNote: "Live IMD weather heat · demo risk series",
  },
  "socio-economic": {
    theme: "socio-economic",
    title: "Socio-Economic",
    descriptor: "Household vulnerability by year",
    dataPeriod: "2024",
    status: "Observed",
    statusNote: "Demo year series · annual mosaic",
  },
};

/** Period → data cache key pattern (§19): year-keyed entries, theme snapshots shared. */
export function cacheKey(theme: ThemeId, year: string): string {
  return `${theme}-${year}`;
}

export function previousMosaicYear(year: string): string | null {
  const idx = MOSAIC_YEARS.indexOf(year);
  return idx > 0 ? (MOSAIC_YEARS[idx - 1] as string) : null;
}
