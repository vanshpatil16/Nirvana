import { useMemo, useState } from "react";
import { ArrowRight, Beaker, FlaskConical, MapPin, Users } from "lucide-react";
import { DidChart } from "@/components/innovation/evaluation/DidChart";
import { InnovationPilotMap, type PilotMapStat } from "@/components/innovation/InnovationPilotMap";
import { InnovationShell } from "@/components/innovation/InnovationShell";
import { Chip, DemoNote, EmptyState, SectionHead, Stat } from "@/components/innovation/parts";
import {
  DID_EXPERIMENTS,
  PROJECTS,
  allPilots,
  computeDid,
  getChallenge,
  getProject,
  type PilotSummary,
} from "@/data/innovation";

/**
 * National pilot tracker — the pilot map and experiment tracker promoted out of
 * the workspace so a reviewer can see every running experiment at once, without
 * opening three separate projects.
 */
export function InnovationPilots() {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("All States");
  const [stageFilter, setStageFilter] = useState("All Stages");
  const [selected, setSelected] = useState<string | null>(null);

  const pilots = useMemo(() => allPilots(), []);

  const mapStats: PilotMapStat[] = useMemo(() => {
    const map = new Map<string, PilotMapStat>();
    for (const p of pilots) {
      if (stateFilter !== "All States" && p.state !== stateFilter) continue;
      if (stageFilter !== "All Stages" && p.stage !== stageFilter) continue;
      const entry = map.get(p.state) ?? { state: p.state, pilots: 0, challenges: 0 };
      entry.pilots += 1;
      map.set(p.state, entry);
    }
    return [...map.values()].sort((a, b) => b.pilots - a.pilots);
  }, [pilots, stateFilter, stageFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pilots.filter((p) => {
      if (stateFilter !== "All States" && p.state !== stateFilter) return false;
      if (stageFilter !== "All Stages" && p.stage !== stageFilter) return false;
      if (!q) return true;
      return `${p.name} ${p.state} ${p.projectName} ${p.beneficiaries}`.toLowerCase().includes(q);
    });
  }, [pilots, query, stateFilter, stageFilter]);

  const states = useMemo(
    () => ["All States", ...Array.from(new Set(pilots.map((p) => p.state))).sort()],
    [pilots],
  );
  const stages = useMemo(
    () => ["All Stages", ...Array.from(new Set(pilots.map((p) => p.stage)))],
    [pilots],
  );

  const computable = DID_EXPERIMENTS.filter((d) => computeDid(d).computable).length;
  const comparisonCapable = pilots.filter((p) => p.hasComparisonArea).length;

  return (
    <InnovationShell
      query={query}
      onQuery={setQuery}
      subNav={[
        { label: "Home", href: "/innovation" },
        { label: "Challenges", href: "/innovation/challenges" },
        { label: "Pilots", href: "/innovation/pilots", active: true },
        { label: "Impact", href: "/innovation/impact" },
        { label: "Submit a Solution", href: "/innovation/submit" },
      ]}
    >
      <div className="dashboard-content inno-page">
        <header className="inno-page-head">
          <div>
            <span className="portal-eyebrow">
              <Beaker /> Pilots
            </span>
            <h1>National pilot map &amp; experiment tracker</h1>
            <p>
              Every running pilot across the platform, with the evidence-design questions answered
              in one place: where the work is running, what it is measuring, and whether it can be
              evaluated causally at all.
            </p>
          </div>
        </header>

        <section className="inno-pulse">
          <Stat
            icon={<MapPin />}
            value={pilots.length}
            label="Pilot sites"
            note="Across all workspaces"
          />
          <Stat
            icon={<MapPin />}
            value={new Set(pilots.map((p) => p.state)).size}
            label="States"
            note="Geographic reach"
          />
          <Stat
            icon={<FlaskConical />}
            value={comparisonCapable}
            label="With a comparison area"
            note="Required for causal claims"
          />
          <Stat
            icon={<FlaskConical />}
            value={`${computable} / ${DID_EXPERIMENTS.length}`}
            label="Experiments evaluable"
            note="Rest are blocked for missing data"
          />
        </section>
        <DemoNote>
          Pilot sites, KPIs and experiment results are demo records for interface development.
        </DemoNote>

        <section aria-label="Pilot map and list">
          <SectionHead
            title="Where pilots are running"
            description="Shaded by number of pilot sites. Select a state to filter the list."
            action={
              stateFilter !== "All States" ? (
                <button className="inno-link" onClick={() => setStateFilter("All States")}>
                  Clear {stateFilter} <span aria-hidden="true">×</span>
                </button>
              ) : null
            }
          />

          <div className="inno-filters">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              aria-label="Filter pilots by state"
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              aria-label="Filter pilots by stage"
            >
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="inno-map-row">
            <InnovationPilotMap stats={mapStats} activeState={selected} onSelect={setSelected} />
            <div className="inno-map-side">
              <h3>
                {filtered.length} pilot site{filtered.length === 1 ? "" : "s"}
              </h3>
              {filtered.length > 0 ? (
                <ul className="inno-pilot-list">
                  {filtered.map((p) => (
                    <PilotRow key={p.pilotId} pilot={p} />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No pilots match these filters"
                  body="Try a different state or stage."
                />
              )}
            </div>
          </div>
        </section>

        <section aria-label="Policy experiments">
          <SectionHead
            title="Policy experiments"
            description="Difference-in-differences estimates with the method, assumptions and threats to validity shown. A blocked experiment is reported as blocked."
          />
          {DID_EXPERIMENTS.map((did) => {
            const project = getProject(did.projectId);
            const challenge = project ? getChallenge(project.challengeId) : undefined;
            return (
              <div key={did.id} className="inno-exp-block">
                <div className="inno-exp-head">
                  <div>
                    <h3>{project?.name ?? did.projectId}</h3>
                    <small>
                      {challenge?.title} · {did.treatedLabel}
                    </small>
                  </div>
                  {project && (
                    <a
                      className="inno-link"
                      href={`/innovation/workspace/${project.id}?module=evaluation`}
                    >
                      Open in workspace <ArrowRight />
                    </a>
                  )}
                </div>
                <DidChart did={did} />
              </div>
            );
          })}
        </section>
      </div>
    </InnovationShell>
  );
}

/** One pilot site row, with its project link and headline KPI. */
function PilotRow({ pilot }: { pilot: PilotSummary }) {
  return (
    <li className="inno-pilot-row">
      <div className="inno-cc-top">
        <Chip
          tone={
            pilot.stage === "Evaluation" ? "green" : pilot.stage === "Monitoring" ? "blue" : "gold"
          }
        >
          {pilot.stage}
        </Chip>
        {pilot.hasComparisonArea ? <Chip tone="blue">Comparison area</Chip> : null}
      </div>
      <strong>{pilot.name}</strong>
      <small>
        <MapPin /> {pilot.state} · <Users /> {pilot.beneficiaries}
      </small>
      <dl className="inno-pilot-kpi">
        <dt>{pilot.headline.label}</dt>
        <dd>
          <span>{pilot.headline.baseline}</span>
          <ArrowRight />
          <strong className={pilot.headline.direction}>{pilot.headline.current}</strong>
        </dd>
      </dl>
      <a className="inno-link" href={`/innovation/workspace/${pilot.projectId}?module=pilots`}>
        {pilot.projectName} <ArrowRight />
      </a>
    </li>
  );
}
