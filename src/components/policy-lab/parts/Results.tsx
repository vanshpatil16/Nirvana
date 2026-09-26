import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calculator,
  Database,
  Eye,
  FileText,
  Info,
  Layers,
  LineChart,
  Minus,
  ShieldQuestion,
  Table2,
} from "lucide-react";
import { datasetOf, indicatorOf, type SimulationResult } from "@/data/policySimulation";
import {
  TONE_CLASS,
  compact,
  indicatorDecimals,
  indicatorValue,
  listSentence,
  num,
  signed,
  toneOf,
} from "../lab-helpers";
import { DivergingBars, PairedColumns, TrendChart } from "./Charts";
import { ImpactMap, UnitRanking } from "./ImpactMap";
import { Empty, PrototypeTag } from "./States";

const iconForTrend = (t: string) => (t === "flat" ? Minus : t === "up" ? ArrowUp : ArrowDown);

// ---------------------------------------------------------------------------
// 1 — Scenario summary
// ---------------------------------------------------------------------------

export function ScenarioSummary({ result }: { result: SimulationResult }) {
  return (
    <div className="pl-card pl-panel">
      <div className="pl-panel-head">
        <span>Scenario summary</span>
        <PrototypeTag />
      </div>
      <div className="pl-two" style={{ gap: 24 }}>
        <div>
          <h3
            className="pl-display"
            style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.2,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {result.scenarioName}
          </h3>
          <p className="pl-muted" style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6 }}>
            {result.objective}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            <span className="pl-tag">
              {result.kind === "new" ? "New policy" : "Existing policy"}
            </span>
            <span className="pl-tag blue">{result.policyName}</span>
            <span className="pl-tag orange">{result.period.label}</span>
            {result.geographyNames.slice(0, 3).map((n) => (
              <span key={n} className="pl-tag grey">
                {n}
              </span>
            ))}
            {result.geographyNames.length > 3 && (
              <span className="pl-tag grey">+{result.geographyNames.length - 3} more</span>
            )}
          </div>
        </div>
        <div>
          <div className="pl-basis-grid">
            <div className="pl-basis observed">
              <Eye />
              <div>
                <b>Observed / historical</b>
                <small>{result.baselineNote}</small>
              </div>
            </div>
            <div className="pl-basis calculated">
              <Calculator />
              <div>
                <b>Calculated change</b>
                <small>{result.comparedNote}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      {result.kind === "existing" && (
        <div className="pl-basis caution" style={{ marginTop: 10 }}>
          <ShieldQuestion />
          <div>
            <b>A before/after difference is not evidence of causation</b>
            <small>
              This screen compares two windows of observed data around the implementation date. Any
              factor that moved over the same period — urbanisation, commodity prices, rainfall, a
              neighbouring instrument — would produce an identical comparison. Treat the numbers as
              descriptive, not attributed.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2 — KPI cards
// ---------------------------------------------------------------------------

export function KpiCards({ result }: { result: SimulationResult }) {
  const primary = result.kpis.filter((k) => k.role === "primary");
  const pool = primary.length ? primary : result.kpis.slice(0, 4);
  if (!pool.length) {
    return (
      <Empty icon={Table2} title="No indicators available" compact>
        None of the indicators declared by this policy has an observation in the selected units.
      </Empty>
    );
  }
  const firstLabel = result.kind === "new" ? "Current (observed)" : "Baseline (observed)";
  const secondLabel = result.kind === "new" ? "Simulated" : "Post-policy";
  return (
    <div className="pl-kpis">
      {pool.map((k, i) => {
        const tone = toneOf(k.pctChange, k.trend);
        const Icon = iconForTrend(tone);
        const dp = indicatorDecimals(k.indicatorId);
        return (
          <div
            className="pl-card pl-kpi"
            key={k.indicatorId}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <header>
              <b>{k.name}</b>
              <span className="pl-tag grey">{k.role}</span>
            </header>
            <div className="pl-kpi-values">
              <div>
                <small>{firstLabel}</small>
                <strong>{indicatorValue(k.indicatorId, k.current)}</strong>
              </div>
              <i aria-hidden="true">→</i>
              <div className="calc">
                <small>{secondLabel}</small>
                <strong>{indicatorValue(k.indicatorId, k.compared)}</strong>
              </div>
            </div>
            <div className="pl-kpi-foot">
              <span>
                Δ {signed(k.change, dp)} {k.unit}
              </span>
              <em className={TONE_CLASS[tone]}>
                <Icon />
                {signed(k.pctChange, 2)}
              </em>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3 — Comparison charts
// ---------------------------------------------------------------------------

export function ComparisonCharts({ result }: { result: SimulationResult }) {
  const primary = result.kpis.find((k) => k.role === "primary") ?? result.kpis[0];
  const dp = primary ? indicatorDecimals(primary.indicatorId) : 1;
  const fmt = (v: number) => num(v, dp);

  const unitRows = useMemo(
    () =>
      [...result.geographyImpact]
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 12)
        .map((r) => ({
          id: r.geographyId,
          label: r.name,
          sublabel: r.code,
          value: r.changePct,
          unit: "%",
        })),
    [result.geographyImpact],
  );

  const scenarioPairs = useMemo(() => {
    if (!result.variants.length || !primary) return [];
    return result.variants.map((v) => {
      const k = v.kpis.find((x) => x.indicatorId === primary.indicatorId) ?? v.kpis[0];
      return { id: v.id, label: v.name, before: k?.current ?? 0, after: k?.compared ?? 0 };
    });
  }, [result.variants, primary]);

  return (
    <div className="pl-grid-2">
      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>
            <LineChart style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
            Indicator trend
          </span>
          <span
            className="pl-muted"
            style={{ fontSize: 11, letterSpacing: 0, textTransform: "none" }}
          >
            {primary?.name}
          </span>
        </div>
        {result.series.length ? (
          <TrendChart
            series={result.series}
            indicatorId={primary?.indicatorId ?? ""}
            {...(result.kind === "new"
              ? { markerLabel: "Simulation baseline" }
              : { markerYear: Number(String(result.period.from).slice(0, 4)) })}
          />
        ) : (
          <Empty icon={LineChart} title="No series available" compact>
            The selected units have no observation history for this indicator.
          </Empty>
        )}
        <p className="pl-help" style={{ marginTop: 8 }}>
          {result.kind === "new"
            ? "Solid line is the observed record up to the baseline year. The dashed line is projected forward by the engine using the configured parameters — it is a scenario, not a forecast."
            : "The dashed line continues the pre-implementation trend as a descriptive reference. It is not a counterfactual estimate."}
        </p>
      </div>

      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>Geographic distribution</span>
          <span
            className="pl-muted"
            style={{ fontSize: 11, letterSpacing: 0, textTransform: "none" }}
          >
            {primary?.shortName ?? "Primary indicator"}
          </span>
        </div>
        {unitRows.length ? (
          <DivergingBars
            rows={unitRows}
            format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`}
            toneFor={(r) => (r.value > 0.05 ? "up" : r.value < -0.05 ? "down" : "flat")}
          />
        ) : (
          <Empty compact title="No unit-level change">
            Select at least one unit to see a distribution.
          </Empty>
        )}
      </div>

      {scenarioPairs.length > 0 && (
        <div className="pl-card pl-panel" style={{ gridColumn: "1 / -1" }}>
          <div className="pl-panel-head">
            <span>Scenario comparison</span>
            <span
              className="pl-muted"
              style={{ fontSize: 11, letterSpacing: 0, textTransform: "none" }}
            >
              {primary?.name}
            </span>
          </div>
          <PairedColumns
            pairs={scenarioPairs}
            format={fmt}
            beforeLabel={result.kind === "new" ? "Current (observed)" : "Baseline mean"}
            afterLabel="Calculated"
          />
          <p className="pl-help" style={{ marginTop: 10 }}>
            Intensity scales every numeric parameter between its declared minimum and maximum. For
            threshold and ceiling controls a higher value is a weaker constraint, so “increased
            intensity” can relax rather than tighten a policy.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4 — Map
// ---------------------------------------------------------------------------

export function MapSection({ result }: { result: SimulationResult }) {
  const [selected, setSelected] = useState<string | null>(null);
  const primary = result.kpis.find((k) => k.role === "primary") ?? result.kpis[0];
  const moved = result.geographyImpact.filter((i) => i.inTarget);

  return (
    <div className="pl-card" style={{ overflow: "hidden" }}>
      <div className="pl-map-split">
        <ImpactMap
          impact={result.geographyImpact}
          headline={`${primary?.shortName ?? "Impact"} · ${result.period.label}`}
        />
        <aside>
          <b>Units by impact</b>
          <UnitRanking
            impact={result.geographyImpact}
            selected={selected}
            onSelect={(id) => setSelected((p) => (p === id ? null : id))}
          />
        </aside>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          borderTop: "1px solid var(--pl-line)",
          padding: "11px 15px",
        }}
      >
        <Layers style={{ width: 14, height: 14, color: "var(--pl-emerald)" }} />
        <span style={{ fontSize: 12, color: "var(--pl-muted)" }}>
          {moved.length} target unit{moved.length === 1 ? "" : "s"} outlined ·{" "}
          {result.geographyImpact.length - moved.length} shown for context · click a unit for detail
        </span>
        <span className="pl-tag grey" style={{ marginLeft: "auto" }}>
          Geometry from the prototype boundary layer
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5 — Indicator breakdown table
// ---------------------------------------------------------------------------

export function IndicatorTable({ result }: { result: SimulationResult }) {
  const rows = result.indicators;
  if (!rows.length) {
    return (
      <Empty icon={Table2} title="No indicator values">
        None of the indicators declared by this policy has data for the selected units and window.
      </Empty>
    );
  }
  return (
    <div className="pl-scroll">
      <table className="pl-table">
        <thead>
          <tr>
            <th>Indicator</th>
            <th>{result.kind === "new" ? "Current" : "Baseline"}</th>
            <th>{result.kind === "new" ? "Simulated" : "Post-policy"}</th>
            <th>Change</th>
            <th>% diff</th>
            <th>Unit</th>
            <th>Data source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const dp = indicatorDecimals(r.indicatorId);
            const tone = toneOf(r.pctChange, r.trend);
            return (
              <tr key={r.indicatorId}>
                <td className="ind-name">
                  <b>{r.name}</b>
                  <small>{indicatorOf(r.indicatorId)?.description}</small>
                </td>
                <td className="num">{num(r.current, dp)}</td>
                <td className="num">{num(r.compared, dp)}</td>
                <td className={`num ${TONE_CLASS[tone]}`}>{signed(r.change, dp)}</td>
                <td className={`num ${TONE_CLASS[tone]}`}>{signed(r.pctChange, 2)}</td>
                <td>{r.unit}</td>
                <td>
                  <span className="pl-tag grey">
                    {datasetOf(r.datasetId)?.source ?? r.datasetId}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>{rows.length} indicators</td>
            <td className="num" colSpan={2}>
              {result.kind === "new" ? "Simulated horizon" : "Evaluation window"}:{" "}
              {result.period.label}
            </td>
            <td
              colSpan={3}
              style={{ textAlign: "right", color: "var(--pl-muted)", fontWeight: 600 }}
            >
              All values are prototype outputs computed in the browser
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Land mix table
// ---------------------------------------------------------------------------

export function LandMixTable({ result }: { result: SimulationResult }) {
  const rows = result.landMix;
  if (!rows.length) return null;
  return (
    <div className="pl-scroll">
      <table className="pl-table">
        <thead>
          <tr>
            <th>Land class</th>
            <th>{result.kind === "new" ? "Current area" : "Baseline area"}</th>
            <th>{result.kind === "new" ? "Simulated area" : "Post-policy area"}</th>
            <th>Δ km²</th>
            <th>Δ share</th>
            <th>Δ %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category}>
              <td className="ind-name">
                <b style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: r.color,
                      flexShrink: 0,
                    }}
                  />
                  {r.label}
                </b>
                <small>
                  {num(r.currentShare, 2)}% → {num(r.comparedShare, 2)}% of the target area
                </small>
              </td>
              <td className="num">{compact(r.currentArea)} km²</td>
              <td className="num">{compact(r.comparedArea)} km²</td>
              <td
                className={`num ${TONE_CLASS[r.changeShare > 0.01 ? "up" : r.changeShare < -0.01 ? "down" : "flat"]}`}
              >
                {signed(r.changeArea, 1)}
              </td>
              <td className="num">{signed(r.changeShare, 3, " pp")}</td>
              <td className="num">{signed(r.changePct, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6 — Assumptions
// ---------------------------------------------------------------------------

export function AssumptionsPanel({ result }: { result: SimulationResult }) {
  return (
    <div className="pl-grid-2">
      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>Parameters used</span>
        </div>
        <dl className="pl-kv">
          {result.assumptions.parameters.map((p) => (
            <div key={p.id}>
              <dt>{p.label}</dt>
              <dd>{p.value}</dd>
            </div>
          ))}
        </dl>
        <div className="pl-basis calculated" style={{ marginTop: 12 }}>
          <Calculator />
          <div>
            <b>Calculation period</b>
            <small>
              {result.assumptions.period.label} · {result.assumptions.period.from}–
              {result.assumptions.period.to}
            </small>
          </div>
        </div>
      </div>

      <div className="pl-card pl-panel" style={{ gridColumn: "1 / -1" }}>
        <div className="pl-panel-head">
          <span>Limitations</span>
          <span className="pl-tag red">Read before citing</span>
        </div>
        <ul className="pl-list caution">
          {result.assumptions.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7 — Data sources
// ---------------------------------------------------------------------------

export function DataSourcesPanel({ result }: { result: SimulationResult }) {
  const datasets = result.datasetIds.map(datasetOf).filter((d): d is NonNullable<typeof d> => !!d);
  const usedIndicators = result.indicators
    .map((r) => indicatorOf(r.indicatorId))
    .filter((i): i is NonNullable<typeof i> => !!i);
  const sourceNames = [...new Set([...datasets.map((d) => d.publisher), "Policy documents"])];

  return (
    <div className="pl-grid-2">
      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>
            <Database style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
            Datasets behind this result
          </span>
        </div>
        <div className="pl-list" style={{ gap: 10 }}>
          {datasets.map((d) => (
            <div className="pl-source" key={d.id}>
              <span>
                <Database />
              </span>
              <div>
                <b>{d.name}</b>
                <small>{d.description}</small>
                <em>
                  {d.source} · {d.coverage} · {d.timePeriod} · {d.resolution}
                </em>
              </div>
            </div>
          ))}
        </div>
        <div className="pl-basis" style={{ marginTop: 12, borderStyle: "dashed" }}>
          <Info />
          <div>
            <b>Mock metadata only</b>
            <small>
              These entries describe the sources a real run would read. Nothing here is fetched: the
              prototype computes every number from an in-browser dataset, and no live API is
              contacted.
            </small>
          </div>
        </div>
      </div>

      <div>
        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>Source organisations</span>
          </div>
          <ul className="pl-list">
            {sourceNames.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>Policy document</span>
          </div>
          <div className="pl-doc">
            <span>
              <FileText />
            </span>
            <div>
              <b>{result.sourceDocument.title}</b>
              <small>
                {result.sourceDocument.issuer} · {result.sourceDocument.year}
              </small>
              <em>{result.sourceDocument.clause}</em>
            </div>
          </div>
        </div>

        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>Indicators computed</span>
            <span className="pl-muted" style={{ fontSize: 11, letterSpacing: 0 }}>
              {listSentence(
                usedIndicators.map((i) => i.shortName),
                4,
              )}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {usedIndicators.map((i) => (
              <span key={i.id} className="pl-tag grey" title={i.description}>
                {i.shortName}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export function SectionHead({
  icon: Icon,
  eyebrow,
  title,
  children,
  action,
}: {
  icon: typeof ArrowRight;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pl-section-head">
      <div>
        <span className="pl-eyebrow">
          <Icon />
          {eyebrow}
        </span>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
