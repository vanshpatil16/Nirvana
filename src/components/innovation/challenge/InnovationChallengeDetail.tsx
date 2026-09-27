import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Building,
  CalendarDays,
  CheckCircle2,
  Circle,
  Database,
  FileText,
  Landmark,
  MapPin,
  Notebook,
  Rocket,
  Satellite,
  Scale,
  Users,
} from "lucide-react";
import { InnovationShell } from "@/components/innovation/InnovationShell";
import { InnovationPilotMap } from "@/components/innovation/InnovationPilotMap";
import {
  Chip,
  Citation,
  DemoNote,
  Fact,
  SectionHead,
  StatusPill,
} from "@/components/innovation/parts";
import {
  CHALLENGE_STAGES,
  projectsForChallenge,
  type Challenge,
  type EvidencePanel,
} from "@/data/innovation";

/** Icon per evidence kind, so the evidence panel reads as one system. */
const EVIDENCE_ICONS = {
  "Research Paper": BookOpen,
  Dataset: Database,
  "GIS Layer": Satellite,
  "Policy Document": Landmark,
  "Field Observation": Notebook,
} as const;

/** The challenge's evidence panel, grouped by evidence kind (§4). */
function EvidencePanelView({ evidence }: { evidence: EvidencePanel }) {
  return (
    <div className="inno-evidence">
      <section>
        <h3>
          <BookOpen /> Research
        </h3>
        <ul>
          {evidence.papers.map((paper) => (
            <li key={paper.ref}>
              <strong>{paper.title}</strong>
              <span>
                {paper.authors} · {paper.venue} · {paper.year}
              </span>
              <Citation>[{paper.ref}]</Citation>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>
          <Database /> Datasets
        </h3>
        <ul>
          {evidence.datasets.map((d) => (
            <li key={d.name}>
              <strong>{d.name}</strong>
              <span>
                {d.provider} · {d.coverage} · updated {d.updated}
              </span>
              <span>
                <b>Variables:</b> {d.variables}
              </span>
              <span className="caveat">
                <b>Limitations:</b> {d.limitations}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>
          <Satellite /> Satellite &amp; GIS layers
        </h3>
        <ul>
          {evidence.gisLayers.map((layer) => (
            <li key={layer.name}>
              <strong>{layer.name}</strong>
              <span>
                {layer.kind} · {layer.resolution}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>
          <FileText /> Land records
        </h3>
        <ul className="plain">
          {evidence.landRecords.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>
          <Landmark /> Policy documents
        </h3>
        <ul>
          {evidence.policyDocs.map((doc) => (
            <li key={doc.ref}>
              <strong>{doc.title}</strong>
              <span>
                {doc.issuer} · {doc.year}
              </span>
              <Citation>[{doc.ref}]</Citation>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function InnovationChallengeDetail({ challenge }: { challenge: Challenge }) {
  const workspaces = projectsForChallenge(challenge.id);
  const stageIndex = CHALLENGE_STAGES.indexOf(challenge.stage);

  return (
    <InnovationShell
      query=""
      onQuery={() => {}}
      subNav={[
        { label: "Home", href: "/innovation" },
        { label: "Challenges", href: "/innovation/challenges", active: true },
        { label: "Submit a Solution", href: "/innovation/submit" },
      ]}
    >
      <div className="dashboard-content inno-page">
        {/* HEADER — spec §4 */}
        <header className="inno-brief-head">
          <div className="inno-cc-top">
            <Chip tone="blue">{challenge.track}</Chip>
            <StatusPill status={challenge.status} daysLeft={challenge.daysLeft} />
            {challenge.featured && <Chip tone="gold">Featured Challenge</Chip>}
          </div>
          <h1>{challenge.title}</h1>
          <p className="inno-brief-org">
            <Building /> {challenge.organization}
            <small>{challenge.department}</small>
          </p>
          <div className="inno-tags">
            {challenge.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
          <div className="inno-brief-ctas">
            <Link
              className="portal-btn-primary"
              to="/innovation/submit"
              search={{ challenge: challenge.id }}
            >
              Build a Solution <ArrowRight />
            </Link>
            <a className="portal-btn-ghost" href="#collaborators">
              <Users /> Find Collaborators
            </a>
          </div>
        </header>

        {/* Lifecycle position */}
        <ol className="inno-stage-track" aria-label="Position in the innovation lifecycle">
          {CHALLENGE_STAGES.map((stage, i) => (
            <li
              key={stage}
              className={i < stageIndex ? "done" : i === stageIndex ? "current" : ""}
              aria-current={i === stageIndex ? "step" : undefined}
            >
              {i < stageIndex ? <CheckCircle2 /> : <Circle />}
              {stage}
            </li>
          ))}
        </ol>

        <div className="inno-brief-grid">
          <div className="inno-brief-main">
            {/* PROBLEM STATEMENT — spec §4 */}
            <section>
              <SectionHead title="Problem statement" />
              <p className="inno-lead">{challenge.problemStatement}</p>
            </section>

            <section>
              <SectionHead title="Why this governance problem matters" />
              <p>{challenge.whyItMatters}</p>
            </section>

            {/* GEOGRAPHIC SCOPE — spec §4 */}
            <section>
              <SectionHead
                title="Geographic scope"
                description={`${challenge.geography.scope} — ${challenge.geography.label}`}
              />
              <p>{challenge.geography.detail}</p>
              <div className="inno-map-row">
                <InnovationPilotMap
                  stats={challenge.geography.states.map((state) => ({
                    state,
                    challenges: 1,
                    pilots: 1,
                  }))}
                />
                <div className="inno-map-side">
                  <h3>Pilot areas</h3>
                  <ul className="inno-plain-list">
                    {challenge.geography.states.map((s) => (
                      <li key={s}>
                        <MapPin /> {s}
                      </li>
                    ))}
                  </ul>
                  <p className="inno-side-note">
                    Every project built on this challenge can save study regions inside its
                    workspace, and pilots appear on the national innovation map.
                  </p>
                </div>
              </div>
            </section>

            {/* EVIDENCE PANEL — spec §4 */}
            <section>
              <SectionHead
                title="Evidence panel"
                description="Every factual claim on this page traces to one of these sources."
              />
              <EvidencePanelView evidence={challenge.evidence} />
            </section>

            {/* EXPECTED OUTPUTS — spec §4 */}
            <section>
              <SectionHead title="Expected outputs" />
              <ul className="inno-checklist">
                {challenge.expectedOutputs.map((o) => (
                  <li key={o}>
                    <CheckCircle2 /> {o}
                  </li>
                ))}
              </ul>
            </section>

            {/* EVALUATION CRITERIA — spec §4 */}
            <section>
              <SectionHead
                title="Evaluation criteria"
                description="Published in advance. Every submission is scored against exactly these six dimensions."
              />
              <ul className="inno-criteria">
                {challenge.evaluationCriteria.map((criterion) => (
                  <li key={criterion.name}>
                    <div className="inno-crit-head">
                      <strong>{criterion.name}</strong>
                      <span>{criterion.weight}%</span>
                    </div>
                    <div className="inno-crit-bar" role="presentation">
                      <i style={{ width: `${criterion.weight}%` }} />
                    </div>
                    <p>{criterion.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* RESOURCES — spec §4 */}
            <section>
              <SectionHead
                title="Resources"
                description="Data dictionaries, APIs, sample data and reference documents."
              />
              <ul className="inno-resources">
                {challenge.resources.map((r) => (
                  <li key={r.label}>
                    <span className="inno-res-type">{r.type}</span>
                    <div>
                      <strong>{r.label}</strong>
                      <p>{r.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* RAIL */}
          <aside className="inno-brief-rail">
            <section className="inno-panel">
              <h3>At a glance</h3>
              <dl className="inno-facts">
                <Fact
                  label="Funding"
                  value={`${challenge.funding} ${challenge.fundingLabel.toLowerCase()}`}
                />
                <Fact label="Deadline" value={challenge.deadline} />
                <Fact label="Time remaining" value={`${challenge.daysLeft} days`} />
                <Fact
                  label="Submissions"
                  value={`${challenge.submissions} of ${challenge.participants}`}
                />
                <Fact label="Current stage" value={challenge.stage} />
              </dl>
              <DemoNote>Figures are demo records for interface development.</DemoNote>
            </section>

            <section className="inno-panel">
              <h3>
                <Scale /> Eligibility
              </h3>
              <p>{challenge.eligibility}</p>
            </section>

            <section className="inno-panel">
              <h3>
                <Users /> Team requirements
              </h3>
              <ul className="inno-plain-list">
                {challenge.teamRequirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>

            <section className="inno-panel">
              <h3>
                <CalendarDays /> Timeline
              </h3>
              <ol className="inno-timeline">
                {challenge.timeline.map((m) => (
                  <li key={m.label} className={m.done ? "done" : ""}>
                    {m.done ? <CheckCircle2 /> : <Circle />}
                    <div>
                      <strong>{m.label}</strong>
                      <small>{m.date}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {workspaces.length > 0 && (
              <section className="inno-panel" id="collaborators">
                <h3>
                  <Rocket /> Teams already working on this
                </h3>
                <ul className="inno-plain-list">
                  {workspaces.map((p) => (
                    <li key={p.id}>
                      <a href={`/innovation/workspace/${p.id}`} className="inno-inline-link">
                        {p.name}
                      </a>
                      <small>
                        {p.institution} · {p.progress}% complete
                      </small>
                    </li>
                  ))}
                </ul>
                <a className="portal-btn-ghost" href="#collaborators">
                  <Users /> Find Collaborators
                </a>
              </section>
            )}
          </aside>
        </div>
      </div>
    </InnovationShell>
  );
}
