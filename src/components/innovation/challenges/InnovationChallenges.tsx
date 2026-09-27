import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building, MapPin, Search, Users, X } from "lucide-react";
import { InnovationShell } from "@/components/innovation/InnovationShell";
import { Chip, DemoNote, EmptyState, SectionHead, StatusPill } from "@/components/innovation/parts";
import {
  CHALLENGES,
  CHALLENGE_STAGES,
  CHALLENGE_STATES,
  CHALLENGE_TRACKS,
  type Challenge,
} from "@/data/innovation";

/**
 * Filter state comes from the URL so a filtered view is shareable. Fields are
 * optional because the route validates them as optional; `undefined` and the
 * literal "All" both mean "no filter".
 */
export interface ChallengeFilters {
  q?: string | undefined;
  track?: string | undefined;
  state?: string | undefined;
  status?: string | undefined;
  stage?: string | undefined;
}

const ALL = "All";

function matchesFilters(
  challenge: Challenge,
  f: ChallengeFilters,
  ignore?: keyof ChallengeFilters,
): boolean {
  // `undefined` and the literal "All" both mean "no filter".
  // `ignore` drops one dimension so a facet can count its own options without
  // being constrained by its own current selection.
  if (ignore !== "track" && f.track && f.track !== ALL && challenge.track !== f.track) return false;
  if (
    ignore !== "state" &&
    f.state &&
    f.state !== ALL &&
    !challenge.geography.states.includes(f.state)
  )
    return false;
  if (ignore !== "status" && f.status && f.status !== ALL && challenge.status !== f.status)
    return false;
  if (ignore !== "stage" && f.stage && f.stage !== ALL && challenge.stage !== f.stage) return false;
  const q = (f.q ?? "").trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    challenge.title,
    challenge.summary,
    challenge.problemStatement,
    challenge.organization,
    challenge.department,
    challenge.track,
    challenge.geography.label,
    challenge.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** A challenge card in the discovery grid. */
function ChallengeCard({ challenge }: { challenge: Challenge }) {
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
      <div className="inno-tags">
        {challenge.tags.slice(0, 3).map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <div className="inno-cc-meta">
        <span>
          <Building /> {challenge.organization}
        </span>
        <span>
          <MapPin /> {challenge.geography.label}
        </span>
        <span>
          <Users /> {challenge.participants}
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

export function InnovationChallenges({ search }: { search: ChallengeFilters }) {
  const [query, setQuery] = useState(search.q ?? "");
  const [track, setTrack] = useState(search.track ?? ALL);
  const [state, setState] = useState(search.state ?? ALL);
  const [status, setStatus] = useState(search.status ?? ALL);
  const [stage, setStage] = useState(search.stage ?? ALL);

  const filtered = useMemo(
    () => CHALLENGES.filter((c) => matchesFilters(c, { q: query, track, state, status, stage })),
    [query, track, state, status, stage],
  );

  /**
   * Per-stage facet counts: for each stage, how many challenges would be shown if
   * it were selected, evaluated under the OTHER active filters. Excluding the
   * stage dimension from its own count is what keeps the selected facet visible
   * instead of collapsing to zero.
   */
  const stageCounts = useMemo(() => {
    const others: ChallengeFilters = { q: query, track, state, status };
    return CHALLENGE_STAGES.map((s) => ({
      stage: s,
      count: CHALLENGES.filter((c) => c.stage === s && matchesFilters(c, others, "stage")).length,
    }));
  }, [query, track, state, status]);

  const reset = () => {
    setQuery("");
    setTrack(ALL);
    setState(ALL);
    setStatus(ALL);
    setStage(ALL);
  };

  const isFiltered =
    query.trim() !== "" || track !== ALL || state !== ALL || status !== ALL || stage !== ALL;
  const statuses = Array.from(new Set(CHALLENGES.map((c) => c.status)));

  return (
    <InnovationShell
      query={query}
      onQuery={setQuery}
      subNav={[
        { label: "Home", href: "/innovation" },
        { label: "Challenges", href: "/innovation/challenges", active: true },
        { label: "Submit a Solution", href: "/innovation/submit" },
      ]}
    >
      <div className="dashboard-content inno-page">
        <header className="inno-page-head">
          <div>
            <span className="portal-eyebrow">Challenge discovery</span>
            <h1>Government challenges open for solutions</h1>
            <p>
              Every challenge below carries a problem statement, a geographic scope, an evidence
              panel and published evaluation criteria. Read the brief before you commit a team.
            </p>
          </div>
          <a className="portal-btn-primary" href="/innovation/submit">
            Submit a Solution <ArrowRight />
          </a>
        </header>

        {/*
          Stage facets. The number on each button is the count that WILL be
          shown if you click it — derived from the challenge set under the other
          active filters, excluding this facet's own selection. It is
          deliberately NOT LIFECYCLE_PIPELINE[].count, which describes the wider
          programme and would promise "18" for a list of 10 briefs.
        */}
        <div
          className="inno-stagebar"
          role="group"
          aria-label="Filter challenges by lifecycle stage"
        >
          {stageCounts.map((s) => (
            <button
              key={s.stage}
              className={`${stage === s.stage ? "active" : ""}${s.count === 0 ? " empty" : ""}`}
              onClick={() => setStage((cur) => (cur === s.stage ? ALL : s.stage))}
              aria-pressed={stage === s.stage}
            >
              <strong>{s.count}</strong>
              <span>{s.stage}</span>
            </button>
          ))}
        </div>
        <p className="inno-side-note">
          Counts show how many of these {CHALLENGES.length} challenges sit at each stage.
          Programme-wide pipeline totals are on the{" "}
          <a className="inno-inline-link" href="/innovation">
            Innovation home
          </a>
          .
        </p>

        <div className="inno-filters">
          <label className="inno-search">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problem statements, institutions, tags..."
              aria-label="Search challenges"
            />
          </label>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            aria-label="Filter by evidence domain"
          >
            <option value={ALL}>All domains</option>
            {CHALLENGE_TRACKS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            aria-label="Filter by state"
          >
            <option value={ALL}>All states</option>
            {CHALLENGE_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value={ALL}>All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            aria-label="Filter by lifecycle stage"
          >
            <option value={ALL}>All stages</option>
            {CHALLENGE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {isFiltered && (
            <button className="inno-clear" onClick={reset}>
              <X /> Reset
            </button>
          )}
        </div>

        <SectionHead
          title={`${filtered.length} challenge${filtered.length === 1 ? "" : "s"}`}
          description="Sorted by deadline, soonest first."
        />

        {filtered.length > 0 ? (
          <div className="inno-card-grid">
            {filtered
              .slice()
              .sort((a, b) => a.daysLeft - b.daysLeft)
              .map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
          </div>
        ) : (
          <EmptyState
            title="No challenges match these filters"
            body="Try a broader keyword, a different domain, or clear the filters to see every open call."
            action={
              <button className="portal-btn-ghost" onClick={reset}>
                Reset filters
              </button>
            }
          />
        )}

        <DemoNote>
          Challenges, deadlines and funding figures are demo records for interface development.
        </DemoNote>
      </div>
    </InnovationShell>
  );
}
