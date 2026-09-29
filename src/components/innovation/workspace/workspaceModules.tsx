import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Database,
  FileText,
  FlaskConical,
  Landmark,
  Lightbulb,
  MapPin,
  MessageSquare,
  Satellite,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { InnovationPilotMap } from "@/components/innovation/InnovationPilotMap";
import { Avatar, Chip, Citation, DemoNote, SectionHead } from "@/components/innovation/parts";
import {
  getChallenge,
  TASK_COLUMNS,
  TEAM_ROLES,
  getTeamRole,
  type Project,
  type TaskColumn,
} from "@/data/innovation";

/** Per-evidence-kind icon, shared with the challenge evidence panel. */
const EVIDENCE_ICONS = {
  "Research Paper": BookOpen,
  Dataset: Database,
  "GIS Layer": Satellite,
  "Policy Document": Landmark,
  "Field Observation": FileText,
} as const;

const DIRECTION_ICON = { better: TrendingUp, worse: TrendingDown, flat: Circle } as const;

/** Display name for a member id, falling back gracefully. */
function nameOf(project: Project, id: string): string {
  return project.members.find((m) => m.id === id)?.name ?? "Unknown";
}

/** Compact avatar row for the workspace header. */
export function MemberStrip({ project }: { project: Project }) {
  return (
    <div className="inno-member-strip">
      {project.members.map((m) => (
        <Avatar key={m.id} initials={m.initials} title={`${m.name} — ${m.affiliation}`} />
      ))}
    </div>
  );
}

/** Project overview: problem, hypothesis, solution, milestone, next action. */
export function OverviewPanel({ project }: { project: Project }) {
  const challenge = getChallenge(project.challengeId);
  return (
    <div className="inno-mod">
      <section>
        <SectionHead title="The problem" />
        <p className="inno-lead">{challenge?.problemStatement}</p>
        {challenge && (
          <Link
            className="inno-inline-link"
            to="/innovation/challenges/$challengeId"
            params={{ challengeId: challenge.id }}
          >
            Go to the full challenge brief <ArrowUpRight />
          </Link>
        )}
      </section>

      <section>
        <SectionHead title="Hypothesis" />
        <p className="inno-quote">{project.hypothesis}</p>
      </section>

      <section>
        <SectionHead title="Solution summary" />
        <p>{project.solutionSummary}</p>
      </section>

      <div className="inno-two-col">
        <section className="inno-panel">
          <h3>Current milestone</h3>
          <p>{project.currentMilestone}</p>
          <div
            className="inno-progress"
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Project progress"
          >
            <div className="inno-progress-head">
              <span>Overall progress</span>
              <strong>{project.progress}%</strong>
            </div>
            <div className="inno-progress-bar">
              <i style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        </section>
        <section className="inno-panel">
          <h3>Next action</h3>
          <p>{project.nextAction}</p>
        </section>
      </div>

      <section>
        <SectionHead title="Milestones" />
        <ol className="inno-timeline">
          {project.milestones.map((m) => (
            <li
              key={m.id}
              className={m.state === "done" ? "done" : m.state === "active" ? "active" : ""}
            >
              {m.state === "done" ? <CheckCircle2 /> : <Circle />}
              <div>
                <strong>{m.label}</strong>
                <small>{m.due}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Evidence locker: shared papers, datasets, layers, records and caveats. */
export function EvidencePanel({ project }: { project: Project }) {
  const [kind, setKind] = useState<string>("All");
  const kinds = ["All", ...Array.from(new Set(project.evidence.map((e) => e.kind)))];
  const items = kind === "All" ? project.evidence : project.evidence.filter((e) => e.kind === kind);

  return (
    <div className="inno-mod">
      <SectionHead
        title="Evidence Locker"
        description="Everything the team is relying on, with the citation preserved and the caveat kept visible."
        action={
          <div className="inno-layers">
            {kinds.map((k) => (
              <button
                key={k}
                className={kind === k ? "active" : ""}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
              >
                {k}
              </button>
            ))}
          </div>
        }
      />
      <ul className="inno-locker">
        {items.map((item) => {
          const Icon = EVIDENCE_ICONS[item.kind];
          return (
            <li key={item.id}>
              <span className="inno-locker-icon">
                <Icon />
              </span>
              <div>
                <div className="inno-cc-top">
                  <Chip tone={item.kind === "Research Paper" ? "blue" : "neutral"}>
                    {item.kind}
                  </Chip>
                </div>
                <strong>{item.title}</strong>
                <Citation>{item.reference}</Citation>
                <p>{item.usedFor}</p>
                {item.caveat && (
                  <p className="inno-caveat">
                    <AlertTriangle /> {item.caveat}
                  </p>
                )}
                <small>
                  Added by {nameOf(project, item.addedBy)} · {item.addedOn}
                </small>
              </div>
            </li>
          );
        })}
      </ul>
      <DemoNote>
        Demo records. Citations are shown verbatim so a claim can be traced to its source.
      </DemoNote>
    </div>
  );
}

/** Research board: findings, hypotheses and questions with their support. */
export function ResearchPanel({ project }: { project: Project }) {
  const KIND_ICON = {
    Finding: CheckCircle2,
    Hypothesis: Lightbulb,
    Question: AlertTriangle,
  } as const;
  return (
    <div className="inno-mod">
      <SectionHead
        title="Research Board"
        description="Literature notes, findings and open questions — each one attached to the evidence that supports it."
      />
      <ul className="inno-notes">
        {project.researchNotes.map((note) => {
          const Icon = KIND_ICON[note.kind];
          return (
            <li key={note.id}>
              <div className="inno-cc-top">
                <Chip
                  tone={
                    note.kind === "Finding" ? "green" : note.kind === "Hypothesis" ? "gold" : "red"
                  }
                >
                  <Icon /> {note.kind}
                </Chip>
                <small>{note.postedOn}</small>
              </div>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
              <div className="inno-note-foot">
                <div className="inno-tags">
                  {note.supportIds.map((id) => {
                    const ev = project.evidence.find((e) => e.id === id);
                    if (!ev) return null;
                    return <Chip key={id}>{ev.kind}</Chip>;
                  })}
                </div>
                <span>
                  {nameOf(project, note.authorId)} · <MessageSquare /> {note.comments} comments
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** GIS workspace: attached layers, study regions and links out to the GIS tools. */
export function GisPanel({ project }: { project: Project }) {
  const challenge = getChallenge(project.challengeId);
  const layers = challenge?.evidence.gisLayers ?? [];
  return (
    <div className="inno-mod">
      <SectionHead
        title="GIS Workspace"
        description="NIRVANA layers attached to this project, plus the study regions the team has saved."
        action={
          <div className="inno-link-row">
            <a className="portal-btn-ghost" href="/gis-explorer">
              Open GIS Explorer <ArrowUpRight />
            </a>
            <Link className="portal-btn-ghost" to="/landdifference">
              Land Difference <ArrowUpRight />
            </Link>
          </div>
        }
      />
      <div className="inno-map-row">
        <InnovationPilotMap
          stats={project.states.map((s) => ({ state: s, challenges: 1, pilots: 1 }))}
        />
        <div className="inno-map-side">
          <h3>Attached layers</h3>
          <ul className="inno-plain-list">
            {layers.map((l) => (
              <li key={l.name}>
                <Satellite /> {l.name}
                <small>
                  {l.kind} · {l.resolution}
                </small>
              </li>
            ))}
          </ul>
          <h3>Saved study regions</h3>
          <ul className="inno-plain-list">
            <li>
              <MapPin /> {project.pilotGeography}
              <small>Primary pilot region</small>
            </li>
            {project.pilots
              .filter((p) => p.hasComparisonArea)
              .map((p) => (
                <li key={p.id}>
                  <MapPin /> {p.name} — comparison area
                  <small>{p.state}</small>
                </li>
              ))}
          </ul>
        </div>
      </div>
      <DemoNote>
        Layer availability and geometry are demo records. Full interactive mapping lives in GIS
        Explorer.
      </DemoNote>
    </div>
  );
}

/** Kanban task board with owners and due dates. */
export function TaskPanel({ project }: { project: Project }) {
  const [tasks, setTasks] = useState(project.tasks);
  const [dragging, setDragging] = useState<string | null>(null);

  const move = (id: string, column: TaskColumn) =>
    setTasks((t) => t.map((task) => (task.id === id ? { ...task, column } : task)));

  return (
    <div className="inno-mod">
      <SectionHead
        title="Task Board"
        description="Backlog through Done. Drag a card to another column, or use the menu on each card."
      />
      <div className="inno-kanban">
        {TASK_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.column === column);
          return (
            <section
              key={column}
              className={`inno-kanban-col${dragging ? " droppable" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging) move(dragging, column);
                setDragging(null);
              }}
            >
              <header>
                <strong>{column}</strong>
                <span>{columnTasks.length}</span>
              </header>
              <ul>
                {columnTasks.map((task) => {
                  const owner = project.members.find((m) => m.id === task.ownerId);
                  return (
                    <li
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                    >
                      <strong>{task.title}</strong>
                      <div className="inno-task-meta">
                        <Chip>{task.module}</Chip>
                      </div>
                      <footer>
                        {owner && (
                          <Avatar
                            initials={owner.initials}
                            title={`${owner.name} — ${owner.affiliation}`}
                          />
                        )}
                        <span className={task.overdue ? "overdue" : ""}>
                          {task.overdue && <AlertTriangle />} {task.due}
                        </span>
                        <select
                          value={task.column}
                          aria-label={`Move “${task.title}” to another column`}
                          onChange={(e) => move(task.id, e.target.value as TaskColumn)}
                        >
                          {TASK_COLUMNS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </footer>
                    </li>
                  );
                })}
                {columnTasks.length === 0 && <li className="inno-kanban-empty">Nothing here</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Threaded discussion with mentions and links to decision records. */
export function DiscussionPanel({ project }: { project: Project }) {
  return (
    <div className="inno-mod">
      <SectionHead
        title="Discussion"
        description="Threads, mentions and the decision records they produced."
      />
      {project.threads.map((thread) => (
        <section key={thread.id} className="inno-thread">
          <header>
            <h3>{thread.title}</h3>
            <small>Opened {thread.openedOn}</small>
          </header>
          <ul>
            {thread.messages.map((msg) => {
              const decision = msg.decisionId
                ? project.decisions.find((d) => d.id === msg.decisionId)
                : undefined;
              return (
                <li key={msg.id}>
                  <Avatar
                    initials={project.members.find((m) => m.id === msg.authorId)?.initials ?? "?"}
                    title={nameOf(project, msg.authorId)}
                  />
                  <div>
                    <p className="inno-msg-head">
                      <strong>{nameOf(project, msg.authorId)}</strong>
                      <small>{msg.postedOn}</small>
                    </p>
                    <p>{msg.body}</p>
                    {decision && (
                      <p className="inno-msg-decision">
                        <Check /> Recorded as decision: {decision.title}{" "}
                        <Chip tone="green">Decision Log</Chip>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Experiment log: versions, assumptions, metrics. */
export function ExperimentPanel({ project }: { project: Project }) {
  return (
    <div className="inno-mod">
      <SectionHead
        title="Experiment Log"
        description="Every run, with its assumptions written down. A result without its assumptions is not evidence."
      />
      <ul className="inno-experiments">
        {project.experiments.map((exp) => (
          <li key={exp.id}>
            <header>
              <Chip tone="blue">{exp.version}</Chip>
              <small>{exp.recordedOn}</small>
            </header>
            <h3>{exp.summary}</h3>
            <p>{exp.approach}</p>
            <div className="inno-assumptions">
              <strong>Assumptions</strong>
              <ul>
                {exp.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <dl className="inno-metrics">
              {exp.metrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                  {m.note && <small>{m.note}</small>}
                </div>
              ))}
            </dl>
            <small className="inno-recorded">Recorded by {nameOf(project, exp.authorId)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pilot tracker: sites, stages, KPIs against a pre-registered baseline. */
export function PilotPanel({ project }: { project: Project }) {
  return (
    <div className="inno-mod">
      <SectionHead
        title="Pilot Tracker"
        description="Each KPI is shown against the baseline recorded before the intervention began."
      />
      <ul className="inno-pilots">
        {project.pilots.map((pilot) => (
          <li key={pilot.id}>
            <header>
              <div>
                <h3>{pilot.name}</h3>
                <small>
                  <MapPin /> {pilot.state} · {pilot.beneficiaries}
                </small>
              </div>
              <Chip
                tone={
                  pilot.stage === "Evaluation"
                    ? "green"
                    : pilot.stage === "Monitoring"
                      ? "blue"
                      : "gold"
                }
              >
                {pilot.stage}
              </Chip>
            </header>
            <p>{pilot.observations}</p>
            <dl className="inno-kpis">
              {pilot.kpis.map((kpi) => {
                const Icon = DIRECTION_ICON[kpi.direction];
                return (
                  <div key={kpi.label} className={kpi.direction}>
                    <dt>{kpi.label}</dt>
                    <dd>
                      <span className="baseline">{kpi.baseline}</span>
                      <ArrowRight />
                      <strong>{kpi.current}</strong>
                    </dd>
                    <small>
                      <Icon /> from baseline {kpi.baseline}
                    </small>
                  </div>
                );
              })}
            </dl>
            <footer>
              <span>Last updated {pilot.lastUpdated}</span>
              {pilot.hasComparisonArea ? (
                <Chip tone="green">Comparison area available</Chip>
              ) : (
                <Chip tone="gold">No comparison area</Chip>
              )}
            </footer>
          </li>
        ))}
      </ul>
      <DemoNote>
        KPI values are demo records. Where a figure is modelled rather than measured, the project
        says so in its decision log.
      </DemoNote>
    </div>
  );
}

/** Decision log: decisions, rationale, evidence and consequences. */
export function DecisionPanel({ project }: { project: Project }) {
  return (
    <div className="inno-mod">
      <SectionHead
        title="Decision Log"
        description="Why the project went a particular way. This is the record a reviewer reads to understand the work."
      />
      <ol className="inno-decisions">
        {project.decisions.map((d) => (
          <li key={d.id}>
            <div className="inno-cc-top">
              <Chip tone={d.kind === "Policy" ? "gold" : d.kind === "Evidence" ? "blue" : "green"}>
                {d.kind}
              </Chip>
              <small>{d.decidedOn}</small>
            </div>
            <h3>{d.title}</h3>
            <div className="inno-dec-grid">
              <div>
                <strong>Rationale</strong>
                <p>{d.rationale}</p>
              </div>
              <div>
                <strong>Consequence accepted</strong>
                <p>{d.consequence}</p>
              </div>
            </div>
            <footer>
              <div className="inno-tags">
                {d.evidenceIds.map((id) => {
                  const ev = project.evidence.find((e) => e.id === id);
                  const note = project.researchNotes.find((n) => n.id === id);
                  return (
                    <Chip key={id}>{ev?.kind ?? (note ? `${note.kind} note` : "Evidence")}</Chip>
                  );
                })}
              </div>
              <small>Decided by {d.decidedBy}</small>
            </footer>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Review & submission: reviewer scores by rubric dimension and revision state. */
export function ReviewPanel({ project }: { project: Project }) {
  const total = project.reviews.reduce((sum, r) => sum + r.score, 0);
  const max = project.reviews.reduce((sum, r) => sum + r.maxScore, 0);
  return (
    <div className="inno-mod">
      <SectionHead
        title="Review &amp; Submission"
        description="Reviewer feedback scored against the published rubric, with the revision state visible."
      />
      <div className="inno-review-score">
        <div>
          <span>Mean reviewer score</span>
          <strong>
            {(total / Math.max(1, project.reviews.length)).toFixed(1)} <small>/ 10</small>
          </strong>
        </div>
        <div>
          <span>Reviews received</span>
          <strong>
            {project.reviews.length} <small>of {max > 0 ? "requested" : "—"}</small>
          </strong>
        </div>
        <Chip tone="green">
          <BarChart3 /> Evidence package in progress
        </Chip>
      </div>
      <ul className="inno-reviews">
        {project.reviews.map((review) => (
          <li key={review.id}>
            <header>
              <div>
                <strong>{review.reviewer}</strong>
                <small>{review.affiliation}</small>
              </div>
              <Chip
                tone={
                  review.status === "Accepted"
                    ? "green"
                    : review.status === "Revision requested"
                      ? "red"
                      : "gold"
                }
              >
                {review.status}
              </Chip>
            </header>
            <div className="inno-review-dim">
              <span>{review.dimension}</span>
              <span>
                {review.score} / {review.maxScore}
              </span>
            </div>
            <div className="inno-crit-bar" role="presentation">
              <i style={{ width: `${(review.score / review.maxScore) * 100}%` }} />
            </div>
            <p>{review.comment}</p>
          </li>
        ))}
      </ul>
      <div className="inno-link-row">
        <a className="portal-btn-primary" href="/innovation/submit">
          Open the submission wizard <ArrowRight />
        </a>
      </div>
    </div>
  );
}

/** Team & roles module: who is on the project and what each role owns. */
export function TeamPanel({ project }: { project: Project }) {
  return (
    <div className="inno-mod">
      <SectionHead
        title="Team &amp; Roles"
        description="Who is on the project and what each role is accountable for."
      />
      <ul className="inno-team">
        {project.members.map((m) => {
          const role = getTeamRole(m.role);
          const Icon = role?.icon ?? Users;
          return (
            <li key={m.id}>
              <Avatar initials={m.initials} title={m.name} />
              <div>
                <strong>{m.name}</strong>
                <small>{m.affiliation}</small>
                <div className="inno-tags">
                  <Chip tone="green">
                    <Icon /> {role?.title ?? m.role}
                  </Chip>
                  {m.restricted && <Chip tone="red">Restricted access</Chip>}
                </div>
                {role && <p className="inno-role-desc">{role.responsibilities}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <SectionHead
        title="Role definitions"
        description="The eight roles a project workspace supports, including read-only and restricted access."
      />
      <ul className="inno-roles">
        {TEAM_ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <li key={role.id}>
              <span className="inno-role-icon">
                <Icon />
              </span>
              <div>
                <strong>{role.title}</strong>
                <small>Focus: {role.focus}</small>
                <p>{role.responsibilities}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
