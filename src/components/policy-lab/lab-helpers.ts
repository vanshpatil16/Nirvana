/** Non-component helpers for the Policy Lab. Kept apart so Fast Refresh works. */
import { INDICATORS, type IndicatorResult } from "@/data/policySimulation";

// ---------------------------------------------------------------------------
// Number & sign formatting
// ---------------------------------------------------------------------------

export const num = (v: number | null | undefined, decimals = 1): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const compact = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e7) return `${(v / 1e7).toFixed(2)} cr`;
  if (a >= 1e5) return `${(v / 1e5).toFixed(2)} lakh`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return num(v, a < 10 ? 1 : 0);
};

export const signed = (v: number | null | undefined, decimals = 1, suffix = "%"): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), decimals)}${suffix}`;
};

export type Tone = "up" | "down" | "flat";

/** Resolves a change into a tone, taking the indicator's good direction into account. */
export const toneOf = (
  change: number | null | undefined,
  direction: IndicatorResult["trend"] = "neutral",
  deadband = 0.05,
): Tone => {
  if (change === null || change === undefined || !Number.isFinite(change)) return "flat";
  if (Math.abs(change) < deadband) return "flat";
  const worse =
    direction === "up-good" ? change < 0 : direction === "down-good" ? change > 0 : false;
  if (direction === "neutral") return "flat";
  return worse ? "down" : "up";
};

export const TONE_CLASS: Record<Tone, string> = {
  up: "pl-up",
  down: "pl-down",
  flat: "pl-flat",
};

/** Value formatted for an indicator, using its own precision. */
export const indicatorValue = (id: string, v: number | null | undefined): string => {
  const ind = INDICATORS.find((i) => i.id === id);
  const decimals = ind?.decimals ?? 1;
  if (v === null || v === undefined) return "—";
  if (Math.abs(v) >= 100000) return compact(v);
  if (ind && (ind.unit === "km² / year" || ind.unit === "families / year")) return num(v, 1);
  return num(v, decimals);
};

export const indicatorDecimals = (id: string): number =>
  INDICATORS.find((i) => i.id === id)?.decimals ?? 1;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const pluralise = (n: number, one: string, many?: string): string => {
  if (n === 1) return `${n} ${one}`;
  // policy -> policies, class -> classes, day -> days
  const fallback = /[^aeiou]y$/i.test(one) ? `${one.slice(0, -1)}ies` : `${one}s`;
  return `${n} ${many ?? fallback}`;
};

export const listSentence = (items: string[], max = 3): string => {
  if (!items.length) return "—";
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max} more`;
};

export const dateLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
