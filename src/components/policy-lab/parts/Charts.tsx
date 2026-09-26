import { useMemo } from "react";
import { type IndicatorTrend, type SeriesPoint } from "@/data/policySimulation";
import { indicatorDecimals, num } from "../lab-helpers";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 30, left: 52 };

const niceTicks = (min: number, max: number, count = 4): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(v);
  return out;
};

/**
 * Observed vs modelled line chart.
 * Observed points are mock measurements; modelled points are engine output.
 * The two series are always visually and verbally distinguished.
 */
export function TrendChart({
  series,
  indicatorId,
  markerYear,
  markerLabel = "Policy in force",
  height = H,
}: {
  series: SeriesPoint[];
  indicatorId: string;
  markerYear?: number | undefined;
  markerLabel?: string | undefined;
  height?: number | undefined;
}) {
  const dp = indicatorDecimals(indicatorId);
  const model = useMemo(() => {
    const years = series.filter((p) => /^\d{4}$/.test(p.key));
    const xs = years.map((p) => Number(p.key));
    if (!xs.length) return null;
    const all = [
      ...series.map((p) => p.observed ?? 0),
      ...series.map((p) => p.modelled ?? 0),
    ].filter((v) => Number.isFinite(v));
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.18;
    const y0 = lo - pad;
    const y1 = hi + pad;
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const sx = (year: number) =>
      PAD.left + ((year - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right);
    const sy = (v: number) =>
      PAD.top + (1 - (v - y0) / (y1 - y0 || 1)) * (height - PAD.top - PAD.bottom);
    const line = (key: "observed" | "modelled") => {
      const pts = series
        .filter((p) => p[key] !== null && /^\d{4}$/.test(p.key))
        .map((p) => [sx(Number(p.key)), sy(p[key] as number)] as [number, number]);
      return pts.length > 1
        ? `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`
        : "";
    };
    return {
      x0,
      x1,
      y0,
      y1,
      sx,
      sy,
      observed: line("observed"),
      modelled: line("modelled"),
      ticks: niceTicks(y0, y1),
      yearTicks: Array.from({ length: Math.min(7, x1 - x0 + 1) }, (_, i) => x0 + i),
    };
  }, [series, height]);

  if (!model) return null;
  const gridY = (v: number) =>
    PAD.top + (1 - (v - model.y0) / (model.y1 - model.y0 || 1)) * (height - PAD.top - PAD.bottom);

  return (
    <div>
      <div className="pl-chart-legend">
        <span>
          <i style={{ borderColor: "#1d5fc4" }} /> Observed / historical (mock)
        </span>
        <span>
          <i style={{ borderColor: "#f59e0b", borderTopStyle: "dashed" }} /> Calculated by the
          engine
        </span>
      </div>
      <svg
        className="pl-chart"
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label="Indicator trend"
      >
        {model.ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={gridY(t)} y2={gridY(t)} />
            <text className="axis" x={PAD.left - 8} y={gridY(t) + 3} textAnchor="end">
              {num(t, Math.abs(t) < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        {model.yearTicks.map((y) => (
          <text key={y} className="axis" x={model.sx(y)} y={height - 10} textAnchor="middle">
            {y}
          </text>
        ))}
        {markerYear !== undefined && markerYear >= model.x0 && markerYear <= model.x1 && (
          <g>
            <line
              className="marker"
              x1={model.sx(markerYear)}
              x2={model.sx(markerYear)}
              y1={PAD.top - 4}
              y2={height - PAD.bottom}
            />
            <text
              className="marker-label"
              x={model.sx(markerYear) + 5}
              y={PAD.top + 8}
              textAnchor="start"
            >
              {markerLabel}
            </text>
          </g>
        )}
        {model.observed && <path className="observed" d={model.observed} />}
        {model.modelled && <path className="modelled" d={model.modelled} />}
        {series
          .filter((p) => p.observed !== null && /^\d{4}$/.test(p.key))
          .map((p) => (
            <circle
              key={`o-${p.key}`}
              className="dot-observed"
              cx={model.sx(Number(p.key))}
              cy={model.sy(p.observed as number)}
              r={2.6}
            />
          ))}
        {series
          .filter((p) => p.modelled !== null && /^\d{4}$/.test(p.key))
          .map((p) => (
            <circle
              key={`m-${p.key}`}
              className="dot-modelled"
              cx={model.sx(Number(p.key))}
              cy={model.sy(p.modelled as number)}
              r={3}
            />
          ))}
        <text className="axis" x={PAD.left} y={height - 10} textAnchor="start" opacity={0} />
      </svg>
      <p className="pl-help" style={{ marginTop: 4 }}>
        {num(model.y0, dp)} – {num(model.y1, dp)} on the value axis
        {markerYear ? ` · marker at ${markerYear}` : ""}
      </p>
    </div>
  );
}

export interface BarRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  unit?: string;
  direction?: IndicatorTrend;
}

/** Diverging horizontal bars centred on zero — used for unit-level changes. */
export function DivergingBars({
  rows,
  format,
  toneFor,
}: {
  rows: BarRow[];
  format: (v: number) => string;
  toneFor?: (r: BarRow) => "up" | "down" | "flat";
}) {
  const max = Math.max(0.0001, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="pl-bars">
      {rows.map((r) => {
        const width = (Math.abs(r.value) / max) * 50;
        const tone = toneFor?.(r) ?? "flat";
        const color = tone === "up" ? "#0b7a4b" : tone === "down" ? "#e34d4d" : "var(--pl-emerald)";
        return (
          <div className="pl-bar" key={r.id} title={`${r.label}: ${format(r.value)}`}>
            <span title={r.label}>
              {r.label}
              {r.sublabel && (
                <small style={{ display: "block", color: "var(--pl-muted)" }}>{r.sublabel}</small>
              )}
            </span>
            <div className="track">
              <i
                style={{
                  left: r.value >= 0 ? "50%" : `${50 - width}%`,
                  width: `${width}%`,
                  background: color,
                }}
              />
            </div>
            <b
              style={{ color: tone === "up" ? "#13744a" : tone === "down" ? "#b3302f" : undefined }}
            >
              {format(r.value)}
            </b>
          </div>
        );
      })}
    </div>
  );
}

export interface GroupedPair {
  id: string;
  label: string;
  before: number;
  after: number;
}

/** Paired before/after columns for one indicator across scenarios or units. */
export function PairedColumns({
  pairs,
  format,
  beforeLabel = "Current",
  afterLabel = "Simulated",
  afterColor = "#f59e0b",
  beforeColor = "#1d5fc4",
}: {
  pairs: GroupedPair[];
  format: (v: number) => string;
  beforeLabel?: string;
  afterLabel?: string;
  afterColor?: string;
  beforeColor?: string;
}) {
  const max = Math.max(0.0001, ...pairs.flatMap((p) => [p.before, p.after]));
  return (
    <div>
      <div className="pl-chart-legend">
        <span>
          <i style={{ borderColor: beforeColor }} /> {beforeLabel}
        </span>
        <span>
          <i style={{ borderColor: afterColor }} /> {afterLabel}
        </span>
      </div>
      <div className="pl-bars" style={{ gap: 12 }}>
        {pairs.map((p) => (
          <div key={p.id} style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{p.label}</span>
              <span className="pl-muted pl-num">
                {format(p.before)} → {format(p.after)}
              </span>
            </div>
            <div style={{ display: "grid", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{
                    height: 9,
                    width: `${(p.before / max) * 100}%`,
                    borderRadius: "0 4px 4px 0",
                    background: beforeColor,
                    minWidth: 3,
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{
                    height: 9,
                    width: `${(p.after / max) * 100}%`,
                    borderRadius: "0 4px 4px 0",
                    background: afterColor,
                    minWidth: 3,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
