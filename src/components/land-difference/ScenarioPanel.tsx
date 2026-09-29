import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Layers, Minus as Flat, RotateCcw, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Indicators, RegionOutcome, ScenarioDeltas } from "@/data/land-scenario";
import { LAND_CLASS_ORDER, ZERO_DELTAS, isZeroScenario, regionOutcome } from "@/data/land-scenario";
import type { LandTransition } from "@/data/land-difference";
import { LULC_CLASSES } from "./lulcRaster";
import "./land-difference.css";

export interface ScenarioSide {
  label: string;
  /** Series colour for this side in charts (categorical slot, validated) */
  color: string;
  outcome: RegionOutcome;
  changedKm2: number | null;
}

// Categorical slots 1 & 2 (validated for CVD and contrast on the light surface)
export const SIDE_COLORS = ["#2a78d6", "#eb6834"] as const;

const YEARS = ["2018", "2019", "2020", "2021", "2022", "2023", "2024"];

const DRIVERS: { key: keyof ScenarioDeltas; label: string; color: string }[] = [
  { key: "agri", label: "Agricultural land", color: LULC_CLASSES[0].color },
  { key: "forest", label: "Forest cover", color: LULC_CLASSES[1].color },
  { key: "built", label: "Urban / built-up", color: LULC_CLASSES[2].color },
  { key: "water", label: "Water bodies", color: LULC_CLASSES[3].color },
];

const PRESETS: { label: string; deltas: ScenarioDeltas }[] = [
  { label: "Agriculture +10", deltas: { agri: 10, forest: 0, built: 0, water: 0 } },
  { label: "Urban expansion", deltas: { agri: 0, forest: 0, built: 4, water: 0 } },
  { label: "Deforestation", deltas: { agri: 0, forest: -6, built: 0, water: 0 } },
  { label: "Afforestation + water", deltas: { agri: 0, forest: 5, built: 0, water: 2 } },
];

const RANGE = 15;

// Outcome indicators: how each is read, and whether up is good or bad
interface OutcomeDef {
  key: string;
  label: string;
  unit: string;
  value: (o: RegionOutcome) => number;
  /** true = an increase is bad */
  upIsBad: boolean | null;
  relative?: boolean;
}

const OUTCOMES: OutcomeDef[] = [
  {
    key: "climate",
    label: "Climate risk",
    unit: "pts",
    value: (o) => o.scenario.climateRisk - o.baseline.climateRisk,
    upIsBad: true,
  },
  {
    key: "water",
    label: "Water stress",
    unit: "pts",
    value: (o) => o.scenario.waterStress - o.baseline.waterStress,
    upIsBad: true,
  },
  {
    key: "agri",
    label: "Agricultural land",
    unit: "pp",
    value: (o) => o.scenario.shares.agri - o.baseline.shares.agri,
    upIsBad: null,
  },
  {
    key: "built",
    label: "Built-up expansion",
    unit: "pp",
    value: (o) => o.scenario.shares.built - o.baseline.shares.built,
    upIsBad: null,
  },
  {
    key: "forest",
    label: "Forest cover",
    unit: "pp",
    value: (o) => o.scenario.shares.forest - o.baseline.shares.forest,
    upIsBad: false,
  },
  {
    key: "disputes",
    label: "Land disputes",
    unit: "%",
    value: (o) => pct(o.baseline.disputes, o.scenario.disputes),
    upIsBad: true,
    relative: true,
  },
];

const fmt = (v: number, d = 1) => v.toFixed(d);
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-IN");
const pct = (a: number, b: number) => (a === 0 ? 0 : ((b - a) / a) * 100);
const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`;

type Tone = "good" | "bad" | "neutral";
const toneOf = (v: number, upIsBad: boolean | null): Tone =>
  Math.abs(v) < 0.05 || upIsBad === null ? "neutral" : v > 0 === upIsBad ? "bad" : "good";

function Trend({
  v,
  upIsBad,
  unit,
  big,
}: {
  v: number;
  upIsBad: boolean | null;
  unit: string;
  big?: boolean;
}) {
  const tone = toneOf(v, upIsBad);
  const Icon = Math.abs(v) < 0.05 ? Flat : v > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`ld-trend ${tone}${big ? " big" : ""}`}>
      <Icon aria-hidden="true" />
      {signed(v)}
      <small>{unit}</small>
    </span>
  );
}

const ChartTip = ({
  active,
  payload,
  label,
  unit = "",
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[];
  label?: string | number;
  unit?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ld-tip">
      {label !== undefined && <strong>{label}</strong>}
      {payload.map((p, i) => (
        <span key={i}>
          <i style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}:{" "}
          <b>
            {typeof p.value === "number" ? fmt(p.value) : p.value}
            {unit}
          </b>
        </span>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scenario controls — sliders (Research Hub style) + outcome cards
// ---------------------------------------------------------------------------

export function ScenarioControls({
  deltas,
  onChange,
  sides,
  showChange,
  onShowChange,
}: {
  deltas: ScenarioDeltas;
  onChange: (d: ScenarioDeltas) => void;
  sides: ScenarioSide[];
  showChange: boolean;
  onShowChange: (v: boolean) => void;
}) {
  const active = !isZeroScenario(deltas);
  return (
    <section className="ld ld-exp" aria-labelledby="ld-scn-title">
      <div className="ld-card ld-exp-controls">
        <span className="ld-eyebrow">Scenario · {sides.map((s) => s.label).join(" vs ")}</span>
        <h3 id="ld-scn-title">Land-use scenario</h3>
        <p className="ld-sub">
          Change each class by percentage points of the region&apos;s area. Both map sides update
          together.
        </p>
        {DRIVERS.map((d) => {
          const v = deltas[d.key];
          const fill = ((v + RANGE) / (2 * RANGE)) * 100;
          return (
            <div key={d.key} className="ld-slider">
              <label htmlFor={`ld-${d.key}`}>
                <span>
                  <i style={{ background: d.color }} />
                  {d.label}
                </span>
                <b>
                  {v > 0 ? "+" : ""}
                  {v} pp
                </b>
              </label>
              <input
                id={`ld-${d.key}`}
                type="range"
                min={-RANGE}
                max={RANGE}
                step={1}
                value={v}
                onChange={(e) => onChange({ ...deltas, [d.key]: Number(e.target.value) })}
                style={{ "--fill": `${fill}%` } as CSSProperties}
              />
              <div className="ld-slider-now">
                {sides.map((s) => (
                  <span key={s.label}>
                    <i style={{ background: s.color }} />
                    {s.label}: {fmt(s.outcome.baseline.shares[d.key])}% →{" "}
                    <b>{fmt(s.outcome.scenario.shares[d.key])}%</b>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div className="ld-presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="ld-btn"
              onClick={() => onChange(p.deltas)}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className="ld-btn"
            onClick={() => onChange(ZERO_DELTAS)}
            disabled={!active}
          >
            <RotateCcw /> Reset
          </button>
        </div>
        <label className="ld-toggle">
          <input
            type="checkbox"
            checked={showChange}
            onChange={(e) => onShowChange(e.target.checked)}
          />
          <span /> Show “Change detected” layer on the map
        </label>
      </div>

      <div className="ld-exp-out">
        <div className="ld-out-grid">
          {OUTCOMES.map((o) => (
            <div key={o.key} className="ld-card ld-out">
              <span className="ld-out-label">{o.label}</span>
              {sides.map((s, i) => {
                const v = o.value(s.outcome);
                const tone = toneOf(v, o.upIsBad);
                return (
                  <div key={s.label} className={`ld-out-row${i === 0 ? " first" : ""}`}>
                    <Trend v={v} upIsBad={o.upIsBad} unit={o.unit} big={i === 0} />
                    <small>
                      <i style={{ background: s.color }} />
                      {s.label} ·{" "}
                      {tone === "neutral" ? "no change" : tone === "good" ? "improves" : "worsens"}
                    </small>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="ld-card ld-change-strip">
          <Layers />
          {sides.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}: <b>{s.changedKm2 !== null ? `${fmtInt(s.changedKm2)} km²` : "—"}</b> change
              detected
            </span>
          ))}
        </div>
        <p className="ld-note">
          Scenario outputs are model estimates from Nirvana&apos;s demonstration land-use model,
          not official predictions.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Insights dashboard — charts below the controls
// ---------------------------------------------------------------------------

const KPIS: {
  key: string;
  label: string;
  unit: string;
  get: (i: Indicators) => number;
  upIsBad: boolean;
  format: (v: number) => string;
  relative?: boolean;
}[] = [
  {
    key: "climate",
    label: "Climate risk index",
    unit: "pts",
    get: (i) => i.climateRisk,
    upIsBad: true,
    format: (v) => fmt(v),
  },
  {
    key: "water",
    label: "Water stress index",
    unit: "pts",
    get: (i) => i.waterStress,
    upIsBad: true,
    format: (v) => fmt(v),
  },
  {
    key: "disputes",
    label: "Active land disputes",
    unit: "%",
    get: (i) => i.disputes,
    upIsBad: true,
    format: fmtInt,
    relative: true,
  },
  {
    key: "socio",
    label: "Vulnerable households",
    unit: "pp",
    get: (i) => i.socio,
    upIsBad: true,
    format: (v) => `${fmt(v)}%`,
  },
];

function KpiStrip({ sides }: { sides: ScenarioSide[] }) {
  return (
    <div className="ld-kpis">
      {KPIS.map((k) => (
        <div key={k.key} className="ld-card ld-kpi">
          <span className="ld-out-label">{k.label}</span>
          {sides.map((s, i) => {
            const a = k.get(s.outcome.baseline),
              b = k.get(s.outcome.scenario);
            const d = k.relative ? pct(a, b) : b - a;
            return (
              <div key={s.label} className={`ld-kpi-row${i === 0 ? " first" : ""}`}>
                <div>
                  <small>
                    <i style={{ background: s.color }} />
                    {s.label}
                  </small>
                  <strong>{k.format(b)}</strong>
                  <em>from {k.format(a)}</em>
                </div>
                <Trend v={d} upIsBad={k.upIsBad} unit={k.unit} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const CLASS_META = LAND_CLASS_ORDER.map((c, i) => ({
  key: c,
  label: LULC_CLASSES[i]!.label,
  color: LULC_CLASSES[i]!.color,
}));

function MixDonut({ side }: { side: ScenarioSide }) {
  const base = CLASS_META.map((c) => ({
    name: c.label,
    value: +side.outcome.baseline.shares[c.key].toFixed(2),
    fill: c.color,
  }));
  const scn = CLASS_META.map((c) => ({
    name: c.label,
    value: +side.outcome.scenario.shares[c.key].toFixed(2),
    fill: c.color,
  }));
  const agri = side.outcome.scenario.shares.agri;
  return (
    <div className="ld-donut">
      <div className="ld-donut-chart">
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Tooltip content={<ChartTip unit="%" />} />
            <Pie
              data={base}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={66}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {base.map((d) => (
                <Cell key={d.name} fill={d.fill} fillOpacity={0.45} />
              ))}
            </Pie>
            <Pie
              data={scn}
              dataKey="value"
              nameKey="name"
              innerRadius={72}
              outerRadius={100}
              stroke="#fff"
              strokeWidth={2}
              paddingAngle={1}
              animationDuration={500}
            >
              {scn.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="ld-donut-center">
          <strong>{fmt(agri, 0)}%</strong>
          <small>farmland</small>
        </div>
      </div>
      <div className="ld-donut-title">
        <i style={{ background: side.color }} />
        {side.label}
      </div>
      <p className="ld-donut-key">Outer ring: scenario · inner ring: baseline</p>
    </div>
  );
}

function MixLegend({ sides }: { sides: ScenarioSide[] }) {
  return (
    <table className="ld-mix-table">
      <thead>
        <tr>
          <th>Class</th>
          {sides.map((s) => (
            <th key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CLASS_META.map((c) => (
          <tr key={c.key}>
            <td>
              <i className="sw" style={{ background: c.color }} />
              {c.label}
            </td>
            {sides.map((s) => {
              const a = s.outcome.baseline.shares[c.key],
                b = s.outcome.scenario.shares[c.key];
              return (
                <td key={s.label}>
                  <b>{fmt(b)}%</b>
                  {Math.abs(b - a) >= 0.05 && (
                    <span className={b > a ? "up" : "down"}>{signed(b - a)}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type TrendClass = "agri" | "forest" | "built" | "water";

function TrajectoryChart({ sides, deltas }: { sides: ScenarioSide[]; deltas: ScenarioDeltas }) {
  const [cls, setCls] = useState<TrendClass>("built");
  // Follow the class the scenario moves most, so the projection is visible without extra clicks
  const dominant = (Object.keys(deltas) as TrendClass[]).reduce<TrendClass | null>(
    (best, k) => (Math.abs(deltas[k]) > (best ? Math.abs(deltas[best]) : 0) ? k : best),
    null,
  );
  useEffect(() => {
    if (dominant) setCls(dominant);
  }, [dominant]);
  const regions = Array.from(new Set(sides.map((s) => s.outcome.region)));
  const single = regions.length === 1;
  const series = useMemo(
    () =>
      YEARS.map((y) => {
        const row: Record<string, number | string> = { year: y };
        regions.forEach((r) => {
          row[r] = +regionOutcome(r, y, ZERO_DELTAS).baseline.shares[cls].toFixed(3);
        });
        return row;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [regions.join("|"), cls],
  );
  // Scenario projection: dashed segment from each side's year to its scenario value
  const data = series.map((row) => {
    const out: Record<string, number | string | null> = { ...row };
    sides.forEach((s, i) => {
      out[`scn${i}`] =
        row["year"] === s.outcome.year ? +s.outcome.scenario.shares[cls].toFixed(3) : null;
    });
    return out;
  });
  const meta = CLASS_META.find((c) => c.key === cls)!;
  const lineColor = (r: string, i: number) =>
    single ? (meta.color === "#F6C515" ? "#C99A00" : meta.color) : SIDE_COLORS[i]!;
  const scenarioOn = !isZeroScenario(deltas);
  return (
    <div className="ld-card ld-chart-card">
      <div className="ld-chart-head">
        <div>
          <span className="ld-eyebrow">Trajectory 2018 → 2024</span>
          <h4>{meta.label} share of area</h4>
        </div>
        <div className="ld-seg" role="tablist" aria-label="Land-use class">
          {(["agri", "forest", "built", "water"] as TrendClass[]).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cls === c}
              className={cls === c ? "on" : ""}
              onClick={() => setCls(c)}
            >
              {CLASS_META.find((m) => m.key === c)!.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ld-legend">
        {regions.map((r, i) => (
          <span key={r}>
            <i style={{ background: lineColor(r, i) }} />
            {r} (observed)
          </span>
        ))}
        {scenarioOn && (
          <span>
            <i className="ring" />
            Scenario
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e8ece7" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 13, fill: "#66736c" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 13, fill: "#66736c" }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `${fmt(v)}%`}
            width={58}
          />
          <Tooltip content={<ChartTip unit="%" />} />
          {sides.map((s) => (
            <ReferenceLine
              key={s.label}
              x={s.outcome.year}
              stroke="#cfd9d1"
              strokeDasharray="4 4"
            />
          ))}
          {regions.map((r, i) => (
            <Line
              key={r}
              type="monotone"
              dataKey={r}
              name={r}
              stroke={lineColor(r, i)}
              strokeWidth={2.5}
              dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }}
              activeDot={{ r: 6 }}
              animationDuration={500}
            />
          ))}
          {scenarioOn &&
            sides.map((s, i) => (
              <Line
                key={`scn${i}`}
                dataKey={`scn${i}`}
                name={`${s.label} scenario`}
                stroke="none"
                dot={{
                  r: 8,
                  strokeWidth: 3,
                  stroke: single ? "#17231d" : SIDE_COLORS[i],
                  fill: "#fff",
                }}
                activeDot={{ r: 9 }}
                isAnimationActive={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const COMPARE: { key: string; label: string; unit: string; get: (o: RegionOutcome) => number }[] = [
  {
    key: "agri",
    label: "Agriculture",
    unit: "pp",
    get: (o) => o.scenario.shares.agri - o.baseline.shares.agri,
  },
  {
    key: "forest",
    label: "Forest",
    unit: "pp",
    get: (o) => o.scenario.shares.forest - o.baseline.shares.forest,
  },
  {
    key: "built",
    label: "Built-up",
    unit: "pp",
    get: (o) => o.scenario.shares.built - o.baseline.shares.built,
  },
  {
    key: "climate",
    label: "Climate risk",
    unit: "pts",
    get: (o) => o.scenario.climateRisk - o.baseline.climateRisk,
  },
  {
    key: "water",
    label: "Water stress",
    unit: "pts",
    get: (o) => o.scenario.waterStress - o.baseline.waterStress,
  },
  {
    key: "disputes",
    label: "Disputes",
    unit: "%",
    get: (o) => pct(o.baseline.disputes, o.scenario.disputes),
  },
  {
    key: "socio",
    label: "Vulnerability",
    unit: "pts",
    get: (o) => o.scenario.socio - o.baseline.socio,
  },
];

function DeltaBars({ sides }: { sides: ScenarioSide[] }) {
  const data = COMPARE.map((c) => {
    const row: Record<string, number | string> = { name: c.label, unit: c.unit };
    sides.forEach((s, i) => (row[`s${i}`] = +c.get(s.outcome).toFixed(2)));
    return row;
  });
  const empty = data.every((r) => sides.every((_, i) => Math.abs(Number(r[`s${i}`])) < 0.01));
  return (
    <div className="ld-card ld-chart-card">
      <div className="ld-chart-head">
        <div>
          <span className="ld-eyebrow">Δ Change</span>
          <h4>What moved, and how much</h4>
        </div>
      </div>
      <div className="ld-legend">
        {sides.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {empty ? (
        <div className="ld-empty">
          <Sparkles /> Move a slider or pick a preset to see the change.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 0, left: 8 }}
            barGap={3}
            barCategoryGap="22%"
          >
            <CartesianGrid stroke="#e8ece7" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: "#66736c" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 13, fill: "#17231d" }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <ReferenceLine x={0} stroke="#9aa79f" />
            <Tooltip content={<ChartTip />} cursor={{ fill: "rgb(23 35 29 / 4%)" }} />
            {sides.map((s, i) => (
              <Bar
                key={s.label}
                dataKey={`s${i}`}
                name={s.label}
                fill={s.color}
                radius={4}
                maxBarSize={14}
                animationDuration={400}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function RiskRadar({ sides }: { sides: ScenarioSide[] }) {
  const axes: { label: string; get: (i: Indicators) => number }[] = [
    { label: "Climate risk", get: (i) => i.climateRisk },
    { label: "Water stress", get: (i) => i.waterStress },
    { label: "Vulnerability", get: (i) => Math.min(100, i.socio * 2.5) },
    { label: "Urbanisation", get: (i) => Math.min(100, i.shares.built * 8) },
    { label: "Forest deficit", get: (i) => Math.max(0, 100 - i.shares.forest * 2.5) },
  ];
  const data = axes.map((a) => {
    const row: Record<string, number | string> = { axis: a.label };
    sides.forEach((s, i) => (row[`s${i}`] = +a.get(s.outcome.scenario).toFixed(1)));
    return row;
  });
  return (
    <div className="ld-card ld-chart-card">
      <div className="ld-chart-head">
        <div>
          <span className="ld-eyebrow">Risk profile · scenario</span>
          <h4>Where each side is exposed</h4>
        </div>
      </div>
      <div className="ld-legend">
        {sides.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#dfe6de" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 13, fill: "#17231d" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip content={<ChartTip />} />
          {sides.map((s, i) => (
            <Radar
              key={s.label}
              dataKey={`s${i}`}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={s.color}
              fillOpacity={0.14}
              animationDuration={400}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
      <p className="ld-note">Indices scaled 0–100 (higher = more exposed). Demo model values.</p>
    </div>
  );
}

function TransitionDonut({ transitions }: { transitions: LandTransition[] }) {
  const total = transitions.reduce((s, t) => s + t.area, 0);
  const data = transitions.map((t) => ({ name: t.label, value: t.area, fill: t.color }));
  return (
    <div className="ld-card ld-chart-card">
      <div className="ld-chart-head">
        <div>
          <span className="ld-eyebrow">Statewide transition breakdown</span>
          <h4>{fmtInt(total)} ha changed</h4>
        </div>
      </div>
      <div className="ld-trans">
        <div className="ld-donut-chart small">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Tooltip content={<ChartTip />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                animationDuration={500}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="ld-donut-center">
            <strong>{transitions[0]?.percentage ?? 0}%</strong>
            <small>{transitions[0]?.to ?? ""}</small>
          </div>
        </div>
        <ul className="ld-trans-list">
          {transitions.map((t) => (
            <li key={t.id}>
              <i style={{ background: t.color }} />
              <span>{t.label}</span>
              <b>{t.percentage}%</b>
              <small>{fmtInt(t.area)} ha</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IntensityGauge({
  intensity,
}: {
  intensity: { score: number; label: string; color: string };
}) {
  return (
    <div className="ld-card ld-chart-card ld-gauge">
      <div className="ld-chart-head">
        <div>
          <span className="ld-eyebrow">Change intensity</span>
          <h4>How fast land is transforming</h4>
        </div>
      </div>
      <div className="ld-gauge-chart">
        <ResponsiveContainer width="100%" height={210}>
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            startAngle={210}
            endAngle={-30}
            data={[{ name: "Intensity", value: intensity.score, fill: intensity.color }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              background={{ fill: "#edf1ec" }}
              animationDuration={700}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="ld-gauge-center">
          <strong style={{ color: intensity.color }}>{intensity.score}</strong>
        </div>
      </div>
      <div className="ld-gauge-pill">
        <span style={{ background: `${intensity.color}1f`, color: intensity.color }}>
          {intensity.label} intensity
        </span>
      </div>
      <p className="ld-note">
        Share of high-impact transitions (farmland → built-up, forest loss) in all observed change.
      </p>
    </div>
  );
}

export function ScenarioInsights({
  sides,
  deltas,
  transitions,
  intensity,
}: {
  sides: ScenarioSide[];
  deltas: ScenarioDeltas;
  transitions: LandTransition[];
  intensity: { score: number; label: string; color: string };
}) {
  return (
    <section className="ld ld-insights" aria-label="Scenario insights">
      <KpiStrip sides={sides} />
      <div className="ld-card ld-mix">
        <div className="ld-chart-head">
          <div>
            <span className="ld-eyebrow">Land-use mix</span>
            <h4>Baseline vs scenario</h4>
          </div>
        </div>
        <div className="ld-mix-body">
          {sides.map((s) => (
            <MixDonut key={s.label} side={s} />
          ))}
          <MixLegend sides={sides} />
        </div>
      </div>
      <div className="ld-row">
        <TrajectoryChart sides={sides} deltas={deltas} />
        <DeltaBars sides={sides} />
      </div>
      <div className="ld-row three">
        <RiskRadar sides={sides} />
        <TransitionDonut transitions={transitions} />
        <IntensityGauge intensity={intensity} />
      </div>
    </section>
  );
}
