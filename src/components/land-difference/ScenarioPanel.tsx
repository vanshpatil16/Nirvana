import { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ArrowDown, ArrowUp, Minus as Flat, RotateCcw } from "lucide-react";
import type { Indicators, RegionOutcome, ScenarioDeltas } from "@/data/land-scenario";
import { ZERO_DELTAS, isZeroScenario } from "@/data/land-scenario";
import { LULC_CLASSES } from "./lulcRaster";

export interface ScenarioSide {
  label: string;
  /** Series colour for this side in charts (categorical slot, validated) */
  color: string;
  outcome: RegionOutcome;
  changedKm2: number | null;
}

// Categorical slots 1 & 2 (validated for CVD and contrast on the light surface)
export const SIDE_COLORS = ["#2a78d6", "#eb6834"] as const;

const DRIVERS: { key: keyof ScenarioDeltas; label: string; color: string }[] = [
  { key: "agri", label: "Agriculture", color: LULC_CLASSES[0].color },
  { key: "forest", label: "Forest", color: LULC_CLASSES[1].color },
  { key: "built", label: "Built-up", color: LULC_CLASSES[2].color },
  { key: "water", label: "Water", color: LULC_CLASSES[3].color },
];

const PRESETS: { label: string; deltas: ScenarioDeltas }[] = [
  { label: "Agriculture +10", deltas: { agri: 10, forest: 0, built: 0, water: 0 } },
  { label: "Urban expansion", deltas: { agri: 0, forest: 0, built: 4, water: 0 } },
  { label: "Deforestation", deltas: { agri: 0, forest: -6, built: 0, water: 0 } },
  { label: "Afforestation + water", deltas: { agri: 0, forest: 5, built: 0, water: 2 } },
];

const RANGE = 15;

type Tone = "worse" | "better" | "neutral";

interface MetricDef {
  key: string;
  label: string;
  unit: "%" | "pts" | "count";
  get: (i: Indicators) => number;
  /** +1 if an increase is bad, -1 if an increase is good, 0 if neutral */
  risk: 1 | -1 | 0;
}

const METRICS: MetricDef[] = [
  { key: "agri", label: "Agriculture", unit: "%", get: (i) => i.shares.agri, risk: 0 },
  { key: "forest", label: "Forest cover", unit: "%", get: (i) => i.shares.forest, risk: -1 },
  { key: "built", label: "Built-up", unit: "%", get: (i) => i.shares.built, risk: 0 },
  { key: "water", label: "Water bodies", unit: "%", get: (i) => i.shares.water, risk: -1 },
  { key: "waterStress", label: "Water stress", unit: "pts", get: (i) => i.waterStress, risk: 1 },
  { key: "climateRisk", label: "Climate risk", unit: "pts", get: (i) => i.climateRisk, risk: 1 },
  { key: "disputes", label: "Land disputes", unit: "count", get: (i) => i.disputes, risk: 1 },
  { key: "socio", label: "Vulnerable households", unit: "%", get: (i) => i.socio, risk: 1 },
];

// Rows for the A-vs-B comparison and Δ chart
const COMPARE: { key: string; label: string; unit: string; delta: (o: RegionOutcome) => number; detail: (o: RegionOutcome) => string }[] = [
  { key: "agri", label: "Agriculture change", unit: "pp", delta: (o) => o.scenario.shares.agri - o.baseline.shares.agri, detail: (o) => `${fmt(o.baseline.shares.agri)}% → ${fmt(o.scenario.shares.agri)}%` },
  { key: "forest", label: "Forest change", unit: "pp", delta: (o) => o.scenario.shares.forest - o.baseline.shares.forest, detail: (o) => `${fmt(o.baseline.shares.forest)}% → ${fmt(o.scenario.shares.forest)}%` },
  { key: "built", label: "Built-up change", unit: "pp", delta: (o) => o.scenario.shares.built - o.baseline.shares.built, detail: (o) => `${fmt(o.baseline.shares.built)}% → ${fmt(o.scenario.shares.built)}%` },
  { key: "disputes", label: "Disputes", unit: "%", delta: (o) => pctChange(o.baseline.disputes, o.scenario.disputes), detail: (o) => `${fmtInt(o.baseline.disputes)} → ${fmtInt(o.scenario.disputes)} cases` },
  { key: "climate", label: "Climate risk", unit: "pts", delta: (o) => o.scenario.climateRisk - o.baseline.climateRisk, detail: (o) => `${fmt(o.baseline.climateRisk)} → ${fmt(o.scenario.climateRisk)} / 100` },
  { key: "waterStress", label: "Water stress", unit: "pts", delta: (o) => o.scenario.waterStress - o.baseline.waterStress, detail: (o) => `${fmt(o.baseline.waterStress)} → ${fmt(o.scenario.waterStress)} / 100` },
  { key: "socio", label: "Socio-economic impact", unit: "pts", delta: (o) => o.scenario.socio - o.baseline.socio, detail: (o) => `${fmt(o.baseline.socio)}% → ${fmt(o.scenario.socio)}% vulnerable households` },
];

const fmt = (v: number) => v.toFixed(1);
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-IN");
const pctChange = (a: number, b: number) => (a === 0 ? 0 : ((b - a) / a) * 100);
const signed = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(digits)}`;

const toneOf = (delta: number, risk: MetricDef["risk"]): Tone => {
  if (Math.abs(delta) < 0.05 || risk === 0) return "neutral";
  return delta * risk > 0 ? "worse" : "better";
};

const TONE_CLASS: Record<Tone, string> = {
  worse: "text-red-700",
  better: "text-green-700",
  neutral: "text-foreground",
};

function DeltaText({ delta, unit, risk }: { delta: number; unit: string; risk: MetricDef["risk"] }) {
  const tone = toneOf(delta, risk);
  const Icon = Math.abs(delta) < 0.05 ? Flat : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono font-semibold ${TONE_CLASS[tone]}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {signed(delta)}
      {unit && <span className="font-sans font-medium text-[10px] ml-0.5">{unit}</span>}
    </span>
  );
}

function DeltaSlider({ value, onChange, color, label }: { value: number; onChange: (v: number) => void; color: string; label: string }) {
  const pct = (v: number) => ((v + RANGE) / (2 * RANGE)) * 100;
  const left = Math.min(pct(0), pct(value));
  const width = Math.abs(pct(value) - pct(0));
  return (
    <SliderPrimitive.Root
      className="relative flex w-full touch-none select-none items-center h-5"
      min={-RANGE}
      max={RANGE}
      step={1}
      value={[value]}
      onValueChange={([v]) => onChange(v ?? 0)}
      aria-label={`${label} change in percentage points`}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-muted">
        {/* fill from zero to the value, so the direction of change is obvious */}
        <div className="absolute h-full rounded-full" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-muted-foreground/60" style={{ left: "50%" }} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: color }} />
    </SliderPrimitive.Root>
  );
}

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
  return (
    <section className="bg-card border border-border/80 rounded-xl p-5 shadow-sm" aria-labelledby="scenario-title">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 id="scenario-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scenario controls</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Simulate a land-use change in percentage points of each state's area. Both map sides update together.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.deltas)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border hover:bg-muted transition-colors"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(ZERO_DELTAS)}
            disabled={isZeroScenario(deltas)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
        {DRIVERS.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: d.color }} />
                {d.label}
              </span>
              <span className="font-mono text-sm font-bold">{signed(deltas[d.key], 0)} pp</span>
            </div>
            <DeltaSlider value={deltas[d.key]} onChange={(v) => onChange({ ...deltas, [d.key]: v })} color={d.color} label={d.label} />
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
              {sides.map((s) => {
                const before = s.outcome.baseline.shares[d.key];
                const after = s.outcome.scenario.shares[d.key];
                return (
                  <span key={s.label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}: <span className="font-mono text-foreground">{fmt(before)}% → {fmt(after)}%</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <label className="mt-4 inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
        <input type="checkbox" checked={showChange} onChange={(e) => onShowChange(e.target.checked)} className="accent-primary" />
        Show "Change detected" layer on the map
      </label>
    </section>
  );
}

export function ImpactCards({ sides }: { sides: ScenarioSide[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {sides.map((s) => (
        <section key={s.label} className="bg-card border border-border/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </h3>
            {s.changedKm2 !== null && (
              <span className="text-[11px] text-muted-foreground">
                Change detected: <span className="font-mono font-semibold text-foreground">{fmtInt(s.changedKm2)} km²</span>
              </span>
            )}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-[10px] uppercase tracking-wider">
                <th className="text-left font-semibold pb-2">Indicator</th>
                <th className="text-right font-semibold pb-2">Baseline</th>
                <th className="text-right font-semibold pb-2">Scenario</th>
                <th className="text-right font-semibold pb-2">Δ Change</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const a = m.get(s.outcome.baseline);
                const b = m.get(s.outcome.scenario);
                const show = (v: number) => (m.unit === "count" ? fmtInt(v) : m.unit === "%" ? `${fmt(v)}%` : fmt(v));
                const delta = m.unit === "count" ? pctChange(a, b) : b - a;
                const unit = m.unit === "%" ? "pp" : m.unit === "count" ? "%" : "pts";
                return (
                  <tr key={m.key} className="border-t border-border/60">
                    <td className="py-1.5 font-medium">{m.label}</td>
                    <td className="py-1.5 text-right font-mono text-muted-foreground">{show(a)}</td>
                    <td className="py-1.5 text-right font-mono">{show(b)}</td>
                    <td className="py-1.5 text-right"><DeltaText delta={delta} unit={unit} risk={m.risk} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export function StateComparison({ sides }: { sides: ScenarioSide[] }) {
  const [hover, setHover] = useState<{ row: string; side: number } | null>(null);
  const [a, b] = sides;
  if (!a || !b) return null;
  const rows = COMPARE.map((r) => ({ ...r, values: [r.delta(a.outcome), r.delta(b.outcome)] as const }));

  return (
    <section className="bg-card border border-border/80 rounded-xl p-5 shadow-sm" aria-labelledby="compare-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 id="compare-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {a.label} vs {b.label} · same scenario
        </h3>
        <div className="flex items-center gap-4 text-xs font-semibold" aria-label="Legend">
          {sides.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Table view */}
        <table className="w-full text-xs self-start">
          <thead>
            <tr className="text-muted-foreground text-[10px] uppercase tracking-wider">
              <th className="text-left font-semibold pb-2">Parameter</th>
              <th className="text-right font-semibold pb-2">{a.label}</th>
              <th className="text-right font-semibold pb-2">{b.label}</th>
              <th className="text-right font-semibold pb-2">Larger response</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [va, vb] = r.values;
              const larger = Math.abs(va - vb) < 0.05 ? "—" : Math.abs(va) > Math.abs(vb) ? a.label : b.label;
              return (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="py-1.5 font-medium">{r.label}</td>
                  <td className="py-1.5 text-right font-mono">{signed(va)} <span className="text-[10px] text-muted-foreground">{r.unit}</span></td>
                  <td className="py-1.5 text-right font-mono">{signed(vb)} <span className="text-[10px] text-muted-foreground">{r.unit}</span></td>
                  <td className="py-1.5 text-right text-muted-foreground">{larger}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Δ chart: diverging bars from zero, scaled per row */}
        <div>
          <div className="space-y-2.5" role="img" aria-label={`Difference chart comparing ${a.label} and ${b.label}`}>
            {rows.map((r) => {
              const scale = Math.max(Math.abs(r.values[0]), Math.abs(r.values[1]), 0.5);
              return (
                <div key={r.key} className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <span className="text-[11px] font-medium text-muted-foreground truncate">{r.label}</span>
                  <div className="relative">
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" aria-hidden="true" />
                    {r.values.map((v, side) => {
                      const s = sides[side]!;
                      const width = (Math.abs(v) / scale) * 50;
                      const active = hover?.row === r.key && hover.side === side;
                      return (
                        <div
                          key={side}
                          className="relative h-3.5 my-0.5 cursor-default"
                          onMouseEnter={() => setHover({ row: r.key, side })}
                          onMouseLeave={() => setHover(null)}
                        >
                          <div
                            className="absolute top-[2px] h-2.5 transition-[width,left] duration-150"
                            style={{
                              backgroundColor: s.color,
                              width: `${width}%`,
                              left: v >= 0 ? "50%" : `${50 - width}%`,
                              // rounded data-end, square at the zero baseline
                              borderRadius: v >= 0 ? "0 4px 4px 0" : "4px 0 0 4px",
                              opacity: hover && !active ? 0.45 : 1,
                            }}
                          />
                          <span
                            className="absolute top-1/2 -translate-y-1/2 text-[10px] font-mono text-foreground whitespace-nowrap"
                            style={v >= 0 ? { left: `calc(${50 + width}% + 4px)` } : { right: `calc(${50 + width}% + 4px)` }}
                          >
                            {signed(v)}
                          </span>
                          {active && (
                            <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded-md bg-gray-900 text-white text-[11px] px-2.5 py-1.5 shadow-lg pointer-events-none">
                              <span className="font-semibold">{s.label}</span> · {r.label}: {signed(v)} {r.unit}
                              <div className="text-white/70">{r.detail(s.outcome)}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Δ from each side's baseline. Bars are scaled per row — compare {a.label} and {b.label} within a row. Hover a bar for details.
          </p>
        </div>
      </div>
    </section>
  );
}
