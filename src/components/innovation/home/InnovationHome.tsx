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
  Plus,
  CheckCircle2,
  Award,
  Code2,
  Target,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { LimitedAccessBanner } from "@/components/auth/LimitedAccessBanner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HonestyBadge } from "@/mock/badges";
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

const INNO_GRANTS = [
  { id: "g1", title: "National Land Records Tech Innovation Grant 2026", amount: "₹50 Lakhs", org: "Ministry of Rural Development (DoLR)", deadline: "30 Nov 2026", track: "AI & GeoSpatial", status: "Open" },
  { id: "g2", title: "Forest Rights Mapping & Tenurial Equity Fellowship", amount: "₹25 Lakhs", org: "Tribal Affairs & UNDP", deadline: "15 Dec 2026", track: "Social Impact", status: "Open" },
  { id: "g3", title: "High-Resolution Satellite Cadastre Open Source Fund", amount: "₹40 Lakhs", org: "IN-SPACe & Nirvana Consortium", deadline: "10 Jan 2027", track: "Earth Observation", status: "Review" },
];

const INNO_HACKATHONS = [
  { id: "h1", title: "Smart India Hackathon 2026 — Land AI Challenge (SIH26019)", prize: "₹10 Lakhs", teamSize: "4-6 Members", org: "DoLR & MoE Innovation Cell", dates: "Oct 2026 – Dec 2026", status: "Active Registrations", tags: ["SIH26019", "AI Anomaly", "Cadastre"] },
  { id: "h2", title: "National GeoAI & Cadastral Sprint 2026", prize: "₹5 Lakhs", teamSize: "2-4 Members", org: "Bhuvan & Survey of India", dates: "15-18 Nov 2026", status: "Upcoming", tags: ["Bhuvan", "OpenCV", "Drone"] },
];

const DEMAND_BOARD_PROBLEMS = [
  { id: "db1", title: "Algorithmic Partition Deed Discrepancy & Share Over-Allocation Detection", issuedBy: "Maharashtra Revenue Dept", bounty: "₹8 Lakhs Pilot", difficulty: "High", claimedBy: null as string | null, tags: ["NLP", "Legal Text", "Deeds"] },
  { id: "db2", title: "Automated Identification of Clouded Titles via Court Cause Lists Integration", issuedBy: "DoLR Policy Lab", bounty: "₹12 Lakhs Pilot", difficulty: "Medium", claimedBy: "IISc Bangalore" as string | null, tags: ["e-Courts", "KG", "OCR"] },
  { id: "db3", title: "Edge-Device Offline Verification App for Remote Forest Fringe Revenue Staff", issuedBy: "Odisha Land Records Cell", bounty: "₹6 Lakhs Pilot", difficulty: "Medium", claimedBy: null as string | null, tags: ["Mobile GIS", "Offline-First", "GPS"] },
];

export function InnovationHome() {
  const { role, roleId, getAccess } = useRole();
  const access = getAccess("/innovation");
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState<string>("All Layers");
  const [mapState, setMapState] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"challenges" | "grants" | "pilots" | "hackathons" | "demand_board">("challenges");
  const [claimedProblems, setClaimedProblems] = useState<Record<string, string>>({ db2: "IISc Bangalore" });

  const stateStats = useStateStats(CHALLENGES, layer);
  const matches = (challenge: Challenge) =>
    layer === "All Layers" || TRACK_TO_LAYER[challenge.track] === layer;
  const topPilots = Math.max(1, ...stateStats.map((s) => s.pilots));
  const latest = CHALLENGES.filter((c) => !c.featured).slice(0, 3);
  const openChallenges = CHALLENGES.filter(
    (c) => c.status === "Open" || c.status === "Applications open",
  );

  const handleClaim = (id: string) => {
    setClaimedProblems((prev) => ({ ...prev, [id]: "Claimed into your Workspace" }));
    toast.success("Problem Claimed on Demand Board", {
      description: `Task added to your researcher workspace for pre-registered empirical study.`,
    });
  };

  const handleApply = (title: string) => {
    toast.success(`Application Initiated`, {
      description: `Opening pilot proposal draft for "${title}".`,
    });
  };

  const handlePostChallenge = () => {
    toast.info("Post New Policy Challenge", {
      description: "DoLR Challenge Creation Wizard: specify problem statement, evaluation criteria, and grant budget.",
    });
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
        {access === "limited" && (
          <LimitedAccessBanner scopeNote="Innovation portal access is scoped for your role." />
        )}

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
              {roleId === "policymaker" ? (
                <button
                  className="portal-btn-ghost flex items-center gap-1.5"
                  onClick={handlePostChallenge}
                >
                  <Plus className="h-4 w-4" /> Post a Challenge
                </button>
              ) : (
                <a className="portal-btn-ghost" href="/innovation/submit">
                  Launch an Innovation Call
                </a>
              )}
            </div>
          </div>

          {/* Lifecycle flow */}
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

        {/* ROLE-AWARE INNOVATION TABS BAR */}
        <div className="my-6 rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: "challenges", label: "Challenges", icon: Beaker },
                { id: "grants", label: "Grants", icon: Landmark },
                { id: "pilots", label: "Pilots", icon: FlaskConical },
                { id: "hackathons", label: "Hackathons", icon: Code2 },
                { id: "demand_board", label: "Demand Board", icon: Target },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {roleId === "policymaker" && (
              <Button size="sm" onClick={handlePostChallenge} className="text-xs gap-1.5 font-semibold">
                <Plus className="h-3.5 w-3.5" /> Post a Challenge
              </Button>
            )}
          </div>

          {/* GRANTS TAB CONTENT */}
          {activeTab === "grants" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {INNO_GRANTS.map((g) => (
                <div key={g.id} className="rounded-xl border border-border/60 bg-background p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {g.track}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">{g.amount}</span>
                    </div>
                    <h3 className="font-bold text-sm text-foreground mt-2">{g.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{g.org}</p>
                    <p className="text-[11px] text-muted-foreground mt-2">Deadline: <strong>{g.deadline}</strong></p>
                  </div>
                  {roleId === "innovator" && (
                    <Button size="sm" onClick={() => handleApply(g.title)} className="w-full text-xs font-semibold">
                      Apply for Grant
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* HACKATHONS TAB CONTENT */}
          {activeTab === "hackathons" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INNO_HACKATHONS.map((h) => (
                <div key={h.id} className="rounded-xl border border-border/60 bg-background p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded">
                        {h.status}
                      </span>
                      <span className="text-xs font-bold text-primary">Prize: {h.prize}</span>
                    </div>
                    <h3 className="font-bold text-sm text-foreground mt-2">{h.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{h.org} · Teams: {h.teamSize}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {h.tags.map((t) => (
                        <span key={t} className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  {roleId === "innovator" && (
                    <Button size="sm" onClick={() => handleApply(h.title)} className="w-full text-xs font-semibold">
                      Register Team
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* DEMAND BOARD TAB CONTENT */}
          {activeTab === "demand_board" && (
            <div className="space-y-3">
              {DEMAND_BOARD_PROBLEMS.map((db) => {
                const isClaimed = claimedProblems[db.id];
                return (
                  <div key={db.id} className="rounded-xl border border-border/60 bg-background p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-500/10 px-2 py-0.5 rounded">
                          Bounty: {db.bounty}
                        </span>
                        <span className="text-[10px] text-muted-foreground">· Issued by: {db.issuedBy}</span>
                      </div>
                      <h4 className="font-bold text-sm text-foreground">{db.title}</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {db.tags.map((t) => (
                          <span key={t} className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isClaimed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Claimed: {isClaimed}
                        </span>
                      ) : roleId === "researcher" ? (
                        <Button size="sm" onClick={() => handleClaim(db.id)} className="text-xs font-semibold gap-1">
                          <Target className="h-3.5 w-3.5" /> Claim Problem
                        </Button>
                      ) : roleId === "innovator" ? (
                        <Button size="sm" onClick={() => handleApply(db.title)} className="text-xs font-semibold gap-1">
                          Submit a Pilot
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Open Problem</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
