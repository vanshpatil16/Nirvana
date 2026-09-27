import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Beaker,
  Building,
  Database,
  FileText,
  FlaskConical,
  GraduationCap,
  Landmark,
  MapPin,
  Rocket,
  Satellite,
  TrendingUp,
  Users,
} from "lucide-react";
import { InnovationShell } from "@/components/innovation/InnovationShell";
import { InnovationPilotMap, type PilotMapStat } from "@/components/innovation/InnovationPilotMap";
import { Chip, DemoNote, SectionHead, Stat, StatusPill } from "@/components/innovation/parts";
import {
  CHALLENGES,
  FEATURED_CHALLENGE,
  IMPACT_STORIES,
  INNOVATION_PULSE,
  LIFECYCLE_PIPELINE,
  PROJECTS,
  RESEARCH_BRIDGE,
  type BridgeResource,
  type Challenge,
} from "@/data/innovation";
import innovationLandscape from "@/assets/innovation-landscape.png";
import featuredChallenge from "@/assets/featured_challenge.png";

/** Resource-kind icon for the research-to-innovation bridge. */
const BRIDGE_ICONS: Record<BridgeResource["kind"], typeof FileText> = {
  "Research Paper": GraduationCap,
  Dataset: Database,
  "GIS Layer": Satellite,
  "Policy Document": Landmark,
  "Case Study": FileText,
};

/** Challenge sectors offered by the pilot map filter row. */
const MAP_FILTERS = [
  "All Layers",
  "Land Use",
  "Climate",
  "Disputes",
  "Urbanization",
  "Digital Records",
  "Agriculture",
  "Infrastructure",
] as const;

/** Maps a challenge track onto the pilot map's layer filter vocabulary. */
const TRACK_TO_LAYER: Record<string, string> = {
  "Climate Risk": "Climate",
  Disputes: "Disputes",
  "Digital Records": "Digital Records",
  "Remote Sensing": "Land Use",
  Infrastructure: "Infrastructure",
  "Land Governance": "Land Use",
  "AI / ML": "Land Use",
};

const PULSE_ICONS: Record<string, typeof Users> = {
  challenges: Beaker,
  grants: Landmark,
  pilots: FlaskConical,
  institutions: Building,
  submissions: FileText,
  completed: Rocket,
};

/** Aggregate challenges and pilots per state for the national map. */
function useStateStats(challenges: Challenge[], activeLayer: string): PilotMapStat[] {
  return useMemo(() => {
    const map = new Map<string, PilotMapStat>();
    for (const challenge of challenges) {
      if (activeLayer !== "All Layers" && TRACK_TO_LAYER[challenge.track] !== activeLayer) continue;
      for (const state of challenge.geography.states) {
        const entry = map.get(state) ?? { state, challenges: 0, pilots: 0 };
        entry.challenges += 1;
        entry.pilots += 1;
        map.set(state, entry);
      }
    }
    return [...map.values()].sort((a, b) => b.pilots - a.pilots);
  }, [challenges, activeLayer]);
}

/** A compact challenge card used in the featured and latest strips. */
function HomeChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <Link
      to="/innovation/challenges/$challengeId"
      params={{ challengeId: challenge.id }}
      className="inno-challenge-card"
    >
      <div className="inno-cc-top">
        <Chip tone="blue">{challenge.track}</Chip>
        <StatusPill status={challenge.status} daysLeft={challenge.daysLeft} />
      </div>
      <h3>{challenge.title}</h3>
      <p>{challenge.summary}</p>
      <div className="inno-cc-meta">
        <span>
          <Building /> {challenge.organization}
        </span>
        <span>
          <MapPin /> {challenge.geography.label}
        </span>
      </div>
      <div className="inno-cc-foot">
        <strong>{challenge.funding}</strong>
        <small>{challenge.fundingLabel}</small>
        <span className="inno-cc-link">
          Read the brief <ArrowRight />
        </span>
      </div>
    </Link>
  );
}

export function InnovationHome() {
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState<string>("All Layers");
  const [mapState, setMapState] = useState<string | null>(null);

  const stateStats = useStateStats(CHALLENGES, layer);
  // Scale for the state bars: the busiest state's pilot count, so the longest
  // bar is always full width.
  const topPilots = Math.max(1, ...stateStats.map((s) => s.pilots));
  const latest = CHALLENGES.filter((c) => !c.featured).slice(0, 3);
  const openChallenges = CHALLENGES.filter(
    (c) => c.status === "Open" || c.status === "Applications open",
  );

  // The header search narrows the visible challenge strips on this screen.
  const matches = (challenge: Challenge) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${challenge.title} ${challenge.summary} ${challenge.organization} ${challenge.tags.join(" ")}`
      .toLowerCase()
      .includes(q);
  };

  return (
    <InnovationShell
      query={query}
      onQuery={setQuery}
      subNav={[
        { label: "Home", href: "/innovation", active: true },
        { label: "Challenges", href: "/innovation/challenges" },
        { label: "Submit a Solution", href: "/innovation/submit" },
        { label: "Workspaces", href: "/innovation/workspace/proj-illegal-change" },
      ]}
    >
      <div className="dashboard-content inno-page">
        {/* HERO — spec §3 */}
        <section className="inno-hero" style={{ backgroundImage: `url(${innovationLandscape})` }}>
          <div className="inno-hero-copy">
            <span className="portal-eyebrow">
              <Rocket /> Innovation Portal
            </span>
            <h1>Where land-governance ideas become tested solutions.</h1>
            <p>Discover challenges. Build with evidence. Pilot in the real world.</p>
            <div className="portal-hero-ctas">
              <a className="portal-btn-primary" href="/innovation/challenges">
                Explore Challenges <ArrowRight />
              </a>
              <a className="portal-btn-ghost" href="/innovation/submit">
                Launch an Innovation Call
              </a>
            </div>
          </div>

          {/* Lifecycle flow: Challenge → Research → Dataset → Prototype → Pilot → Policy */}
          <ol className="inno-lifecycle" aria-label="Innovation lifecycle">
            {LIFECYCLE_PIPELINE.map((stage, i) => (
              <li key={stage.stage}>
                <span className="inno-lc-node" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="inno-lc-label">{stage.stage}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* LIVE INNOVATION PULSE — spec §3 */}
        <section aria-label="Live innovation pulse">
          <SectionHead
            title="Live Innovation Pulse"
            description="Activity across the portal right now."
            action={
              <span className="inno-live">
                <i /> Live
              </span>
            }
          />
          <div className="inno-pulse">
            {INNOVATION_PULSE.map((metric) => {
              const Icon = PULSE_ICONS[metric.id] ?? TrendingUp;
              return (
                <Stat
                  key={metric.id}
                  icon={<Icon />}
                  value={
                    <>
                      {metric.value.toLocaleString("en-IN")}
                      {metric.suffix ? <em>{metric.suffix}</em> : null}
                    </>
                  }
                  label={metric.label}
                  note={metric.note}
                />
              );
            })}
          </div>
          <DemoNote>
            Counts are illustrative demo figures for interface development, not official programme
            statistics.
          </DemoNote>
        </section>

        {/* STATUS PIPELINE — spec §13 P0 */}
        <section aria-label="Innovation pipeline">
          <SectionHead
            title="Where projects are right now"
            description="The connected lifecycle from a stated problem to policy learning."
          />
          <ol className="inno-pipeline">
            {LIFECYCLE_PIPELINE.map((stage) => (
              <li key={stage.stage}>
                <div className="inno-pl-count">{stage.count}</div>
                <div className="inno-pl-body">
                  <strong>{stage.stage}</strong>
                  <p>{stage.description}</p>
                  <small>Move on: {stage.exit}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* FEATURED CHALLENGE — spec §3 */}
        <section aria-label="Featured challenge">
          <article className="inno-featured">
            <div className="inno-featured-media">
              <img src={featuredChallenge} alt={FEATURED_CHALLENGE.title} loading="lazy" />
              <span className="portal-badge">Featured Challenge</span>
            </div>
            <div className="inno-featured-body">
              <div className="inno-cc-top">
                <Chip tone="blue">{FEATURED_CHALLENGE.track}</Chip>
                <StatusPill
                  status={FEATURED_CHALLENGE.status}
                  daysLeft={FEATURED_CHALLENGE.daysLeft}
                />
              </div>
              <h2>{FEATURED_CHALLENGE.title}</h2>
              <p>{FEATURED_CHALLENGE.problemStatement}</p>
              <div className="inno-tags">
                {FEATURED_CHALLENGE.tags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
              <dl className="inno-facts">
                <div>
                  <dt>Issuing institution</dt>
                  <dd>
                    {FEATURED_CHALLENGE.organization}
                    <small>{FEATURED_CHALLENGE.department}</small>
                  </dd>
                </div>
                <div>
                  <dt>Geography</dt>
                  <dd>
                    {FEATURED_CHALLENGE.geography.label}
                    <small>{FEATURED_CHALLENGE.geography.scope}</small>
                  </dd>
                </div>
                <div>
                  <dt>Funding</dt>
                  <dd>
                    {FEATURED_CHALLENGE.funding}
                    <small>{FEATURED_CHALLENGE.fundingLabel}</small>
                  </dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>
                    {FEATURED_CHALLENGE.deadline}
                    <small>
                      {FEATURED_CHALLENGE.submissions} submissions of{" "}
                      {FEATURED_CHALLENGE.participants}
                    </small>
                  </dd>
                </div>
              </dl>
              <div className="inno-featured-ctas">
                <Link
                  className="portal-btn-primary"
                  to="/innovation/challenges/$challengeId"
                  params={{ challengeId: FEATURED_CHALLENGE.id }}
                >
                  Read the full brief <ArrowRight />
                </Link>
                <a
                  className="portal-btn-ghost"
                  href={`/innovation/submit?challenge=${FEATURED_CHALLENGE.id}`}
                >
                  Build a Solution
                </a>
              </div>
            </div>
          </article>
        </section>

        {/* OPEN CALLS — spec §3 */}
        <section aria-label="Open calls">
          <SectionHead
            title="Open calls for solutions"
            description={`${openChallenges.length} calls currently accepting solutions.`}
            action={
              <a className="inno-link" href="/innovation/challenges">
                View all challenges <ArrowRight />
              </a>
            }
          />
          {latest.length > 0 ? (
            <div className="inno-card-grid">
              {latest.filter(matches).map((challenge) => (
                <HomeChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          ) : (
            <p className="inno-empty-inline">No challenges match “{query}”.</p>
          )}
        </section>

        {/* RESEARCH-TO-INNOVATION BRIDGE — spec §3 */}
        <section aria-label="Research to innovation bridge">
          <SectionHead
            title="Research-to-Innovation Bridge"
            description="Papers, datasets, GIS layers and policy documents already connected to active challenges."
          />
          <div className="inno-bridge">
            {RESEARCH_BRIDGE.map((resource) => {
              const Icon = BRIDGE_ICONS[resource.kind];
              return (
                <article key={resource.id} className="inno-bridge-card">
                  <header>
                    <span className="inno-bridge-icon">
                      <Icon />
                    </span>
                    <Chip tone={resource.kind === "Research Paper" ? "blue" : "neutral"}>
                      {resource.kind}
                    </Chip>
                    <span className="inno-bridge-year">{resource.year}</span>
                  </header>
                  <h3>{resource.title}</h3>
                  <p className="inno-bridge-source">{resource.source}</p>
                  <p>{resource.contribution}</p>
                  <footer>
                    <small>Connected to</small>
                    <div className="inno-tags">
                      {resource.linkedTo.map((id) => {
                        const challenge = CHALLENGES.find((c) => c.id === id);
                        if (!challenge) return null;
                        return (
                          <Link
                            key={id}
                            to="/innovation/challenges/$challengeId"
                            params={{ challengeId: id }}
                            className="inno-inline-link"
                          >
                            {challenge.title.length > 34
                              ? `${challenge.title.slice(0, 34)}…`
                              : challenge.title}
                          </Link>
                        );
                      })}
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>

        {/* INDIA PILOT MAP — spec §3 */}
        <section aria-label="India pilot map">
          <SectionHead
            title="India Pilot Map"
            description="Where innovation work is running right now, by evidence domain."
            action={
              mapState ? (
                <button className="inno-link" onClick={() => setMapState(null)}>
                  Clear {mapState} <span aria-hidden="true">×</span>
                </button>
              ) : null
            }
          />
          <div
            className="inno-layers"
            role="group"
            aria-label="Filter the pilot map by evidence domain"
          >
            {MAP_FILTERS.map((f) => (
              <button
                key={f}
                className={layer === f ? "active" : ""}
                onClick={() => setLayer(f)}
                aria-pressed={layer === f}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="inno-map-row">
            <InnovationPilotMap
              stats={stateStats}
              activeState={mapState}
              onSelect={(s) => setMapState((current) => (current === s ? null : s))}
            />
            <div className="inno-map-side">
              <h3>
                {layer === "All Layers"
                  ? "States with active innovation work"
                  : `${layer}: states with challenges`}
              </h3>
              <ul className="inno-state-list">
                {stateStats.slice(0, 9).map((s) => (
                  <li key={s.state} className={mapState === s.state ? "active" : ""}>
                    <button
                      onClick={() =>
                        setMapState((current) => (current === s.state ? null : s.state))
                      }
                    >
                      <span className="inno-bar" aria-hidden="true">
                        <i style={{ width: `${(s.pilots / Math.max(1, topPilots)) * 100}%` }} />
                      </span>
                      <strong>{s.state}</strong>
                      <small>
                        {s.challenges} challenge{s.challenges === 1 ? "" : "s"} · {s.pilots} pilot
                        {s.pilots === 1 ? "" : "s"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
              <DemoNote>
                Pilot locations and counts are demo records for interface development.
              </DemoNote>
            </div>
          </div>
        </section>

        {/* IMPACT STORIES — spec §3 */}
        <section aria-label="Impact stories">
          <SectionHead
            title="Impact Stories"
            description="Problem, intervention, KPI and outcome — with prototype results marked clearly."
          />
          <div className="inno-stories">
            {IMPACT_STORIES.map((story) => {
              const project = PROJECTS.find((p) => p.id === story.projectId);
              return (
                <article key={story.id} className="inno-story">
                  <header>
                    <Chip tone="green">{story.state}</Chip>
                    {story.prototype && <Chip tone="gold">Modelled — not yet measured</Chip>}
                  </header>
                  <h3>{story.title}</h3>
                  <dl>
                    <div>
                      <dt>Problem</dt>
                      <dd>{story.problem}</dd>
                    </div>
                    <div>
                      <dt>Intervention</dt>
                      <dd>{story.intervention}</dd>
                    </div>
                    <div>
                      <dt>KPI</dt>
                      <dd>{story.kpi}</dd>
                    </div>
                    <div>
                      <dt>Outcome</dt>
                      <dd>{story.outcome}</dd>
                    </div>
                  </dl>
                  {project && (
                    <a className="inno-link" href={`/innovation/workspace/${project.id}`}>
                      Open the workspace <ArrowRight />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </InnovationShell>
  );
}
