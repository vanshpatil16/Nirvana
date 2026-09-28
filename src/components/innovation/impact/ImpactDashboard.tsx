import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Circle,
  FlaskConical,
  MapPin,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { InnovationPilotMap } from "@/components/innovation/InnovationPilotMap";
import { InnovationShell } from "@/components/innovation/InnovationShell";
import { Chip, DemoNote, SectionHead } from "@/components/innovation/parts";
import { DidChart } from "@/components/innovation/evaluation/DidChart";
import {
  COMPLETED_PILOT_OUTCOMES,
  CONVERSION_FUNNEL,
  IMPACT_METRICS,
  PILOT_DURATIONS,
  experimentCards,
  pilotStateStats,
  type ImpactMetric,
} from "@/data/innovation";

/**
 * Impact and outcome dashboard (§10).
 *
 * The specification pairs each metric with a required visualisation, so the
 * cards below dispatch on `ImpactMetric.viz` rather than hand-laying out eight
 * bespoke blocks. Everything is derived from the data layer where possible —
 * conversion rate, evidence-link rate and the DiD results are computed, not
 * typed in, so this page cannot quietly disagree with the rest of the portal.
 */
export function InnovationImpact() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const stateStats = useMemo(() => pilotStateStats(), []);
  const cards = useMemo(() => experimentCards(), []);

  const counters = IMPACT_METRICS.filter((m) => m.viz === "counter" || m.viz === "percentage");
  // The remaining metrics each have a bespoke section below, so they are looked
  // up by id rather than rendered as generic cards.
  const durationMetric = IMPACT_METRICS.find((m) => m.viz === "duration");
  const funnelTop = CONVERSION_FUNNEL[0]?.count ?? 1;

  return (
    <InnovationShell
      query=""
      onQuery={() => {}}
      subNav={[
        { label: "Home", href: "/innovation" },
        { label: "Challenges", href: "/innovation/challenges" },
        { label: "Pilots", href: "/innovation/pilots" },
        { label: "Impact", href: "/innovation/impact", active: true },
        { label: "Submit a Solution", href: "/innovation/submit" },
      ]}
    >
      <div className="dashboard-content inno-page">
        <header className="inno-page-head">
          <div>
            <span className="portal-eyebrow">
              <BarChart3 /> Impact
            </span>
            <h1>Impact &amp; outcomes</h1>
            <p>
              What the platform has actually produced: how far evidence travels, how quickly work
              reaches the field, and how much of it can be defended as a measured result rather than
              a claim.
            </p>
          </div>
        </header>

        {/* HEADLINE COUNTERS */}
        <section aria-label="Headline impact metrics">
          <div className="inno-impact-counters">
            {counters.map((m) => (
              <ImpactCard key={m.id} metric={m} />
            ))}
          </div>
        </section>

        {/* PILOTS BY STATE — India map */}
        <section aria-label="Pilots by state">
          <SectionHead
            title="Pilots by state"
            description={`${stateStats.length} states hosting at least one pilot site.`}
            action={
              selectedState ? (
                <button className="inno-link" onClick={() => setSelectedState(null)}>
                  Clear {selectedState} <span aria-hidden="true">×</span>
                </button>
              ) : null
            }
          />
          <div className="inno-map-row">
            <InnovationPilotMap
              stats={stateStats}
              activeState={selectedState}
              onSelect={setSelectedState}
            />
            <div className="inno-map-side">
              <ul className="inno-state-list">
                {stateStats.map((s) => (
                  <li key={s.state} className={selectedState === s.state ? "active" : ""}>
                    <button
                      onClick={() => setSelectedState((c) => (c === s.state ? null : s.state))}
                    >
                      <span className="inno-bar" aria-hidden="true">
                        <i
                          style={{
                            width: `${(s.pilots / Math.max(1, stateStats[0]?.pilots ?? 1)) * 100}%`,
                          }}
                        />
                      </span>
                      <strong>{s.state}</strong>
                      <small>
                        {s.pilots} pilot{s.pilots === 1 ? "" : "s"} · {s.challenges} challenge
                        {s.challenges === 1 ? "" : "s"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* RESEARCH → PILOT FUNNEL */}
        <section aria-label="Research to pilot conversion">
          <SectionHead
            title="Research → Pilot conversion"
            description="How many items sit at each lifecycle stage. The funnel is derived from the same pipeline shown on the home page."
          />
          <ol className="inno-funnel">
            {CONVERSION_FUNNEL.map((stage) => {
              const width = Math.max(8, (stage.count / funnelTop) * 100);
              return (
                <li key={stage.stage}>
                  <span className="inno-funnel-label">{stage.stage}</span>
                  <span className="inno-funnel-bar" aria-hidden="true">
                    <i style={{ width: `${width}%` }} />
                  </span>
                  <span className="inno-funnel-count">{stage.count}</span>
                  <small>{stage.description}</small>
                </li>
              );
            })}
          </ol>
        </section>

        {/* AVERAGE PILOT DURATION */}
        <section aria-label="Average pilot duration">
          <SectionHead
            title={durationMetric?.label ?? "Average pilot duration"}
            description={`${durationMetric?.purpose ?? "Implementation speed"} — ${durationMetric?.note ?? ""}`}
            action={
              durationMetric && (
                <span className="inno-live">
                  Mean <strong>{durationMetric.value}</strong>
                </span>
              )
            }
          />
          <div className="inno-duration">
            {PILOT_DURATIONS.map((d) => {
              const max = Math.max(...PILOT_DURATIONS.map((x) => x.pilots));
              return (
                <div key={d.bucket}>
                  <span className="inno-bar tall" aria-hidden="true">
                    <i style={{ width: `${(d.pilots / max) * 100}%` }} />
                  </span>
                  <strong>{d.pilots}</strong>
                  <small>{d.bucket}</small>
                </div>
              );
            })}
          </div>
        </section>

        {/* POLICY EXPERIMENTS — timeline / cards */}
        <section aria-label="Policy experiments">
          <SectionHead
            title="Policy experiments"
            description="Each experiment is shown with its computed effect, or marked blocked when the comparison data does not support one."
          />
          {cards.map(({ did, result }) => (
            <div key={did.id} className="inno-exp-block">
              <div className="inno-exp-head">
                <div>
                  <h3>{did.outcome}</h3>
                  <small>
                    {did.treatedLabel} vs {did.controlLabel}
                  </small>
                </div>
                <Chip
                  tone={
                    result.computable
                      ? result.direction === "favourable"
                        ? "green"
                        : "red"
                      : "gold"
                  }
                >
                  <FlaskConical />
                  {result.computable ? `${result.effect} ${result.unit}` : "Not computable"}
                </Chip>
              </div>
              <DidChart did={did} />
            </div>
          ))}
        </section>

        {/* COMPLETED PILOTS — outcome cards */}
        <section aria-label="Completed pilots">
          <SectionHead
            title="Completed pilots"
            description="Pilots that reached evaluation. Results are labelled measured or modelled."
          />
          <div className="inno-stories">
            {COMPLETED_PILOT_OUTCOMES.map((o) => (
              <article key={o.id} className="inno-story">
                <header>
                  <Chip tone="green">{o.state}</Chip>
                  <Chip tone={o.measured ? "blue" : "gold"}>
                    {o.measured ? "Measured" : "Modelled — not yet measured"}
                  </Chip>
                </header>
                <h3>{o.title}</h3>
                <p>{o.problem}</p>
                <dl className="inno-outcome-kpis">
                  {o.kpi.map((k) => (
                    <div key={k.label} className={k.direction}>
                      <dt>{k.label}</dt>
                      <dd>
                        <span>{k.baseline}</span>
                        <ArrowRight />
                        <strong>{k.result}</strong>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>{o.summary}</p>
                <a
                  className="inno-link"
                  href={`/innovation/workspace/${o.projectId}?module=pilots`}
                >
                  Open the workspace <ArrowRight />
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* DOCUMENTED OUTCOMES — KPI charts */}
        <section aria-label="Documented outcomes">
          <SectionHead
            title="Documented outcomes"
            description="Every KPI reported against a pre-registered baseline, as measured."
          />
          <KpiCharts />
        </section>

        <DemoNote>
          All figures on this page are demo records for interface development, not official
          programme statistics. Modelled results are labelled and are not presented as measured.
        </DemoNote>
      </div>
    </InnovationShell>
  );
}

/** A single headline metric card with its trend. */
function ImpactCard({ metric }: { metric: ImpactMetric }) {
  const Icon = metric.change === null ? Circle : metric.change >= 0 ? TrendingUp : TrendingDown;
  const good =
    metric.change === null || metric.upIsGood === null
      ? null
      : metric.upIsGood
        ? metric.change >= 0
        : metric.change < 0;
  return (
    <div className="inno-impact-card">
      <span className="inno-impact-icon">
        <BarChart3 />
      </span>
      <strong>{metric.value}</strong>
      <small>{metric.label}</small>
      {metric.change !== null && (
        <span className={`inno-impact-trend ${good === null ? "neutral" : good ? "good" : "bad"}`}>
          <Icon /> {metric.change > 0 ? "+" : ""}
          {metric.change}%
        </span>
      )}
      <em>{metric.purpose}</em>
      <p>{metric.note}</p>
    </div>
  );
}

/** All measured KPI movements, as a bar per KPI relative to its baseline. */
function KpiCharts() {
  const rows = COMPLETED_PILOT_OUTCOMES.flatMap((o) =>
    o.kpi.map((k) => ({ ...k, title: o.title, state: o.state, measured: o.measured })),
  );
  return (
    <ul className="inno-kpi-bars">
      {rows.map((r) => {
        const base = Number.parseFloat(r.baseline);
        const now = Number.parseFloat(r.result);
        const measurable = Number.isFinite(base) && Number.isFinite(now) && base !== 0;
        // Show change relative to baseline where both are numeric; otherwise
        // fall back to the raw pair so a non-numeric result is not dropped.
        const ratio = measurable ? Math.abs((now - base) / base) * 100 : null;
        return (
          <li key={`${r.title}-${r.label}`}>
            <div className="inno-kpi-bar-head">
              <strong>{r.label}</strong>
              <small>
                {r.state} · {r.measured ? "measured" : "modelled"}
              </small>
            </div>
            <div className="inno-kpi-bar-row">
              <span className="inno-bar tall" aria-hidden="true">
                <i
                  className={r.direction}
                  style={{ width: `${Math.min(100, Math.max(6, ratio ?? 45))}%` }}
                />
              </span>
              <span className="inno-kpi-bar-value">
                {r.baseline} <ArrowRight /> <strong className={r.direction}>{r.result}</strong>
              </span>
            </div>
            <p>
              {ratio !== null
                ? `${ratio.toFixed(0)}% change against the pre-registered baseline.`
                : "Result is not a numeric change from the baseline."}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
