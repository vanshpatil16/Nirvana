import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Building, ChevronRight, MapPin, Rocket, Users } from "lucide-react";
import { AssistantPanel } from "@/components/innovation/workspace/AssistantPanel";
import { DidChart } from "@/components/innovation/evaluation/DidChart";
import { InnovationShell } from "@/components/innovation/InnovationShell";
import { Chip, DemoNote } from "@/components/innovation/parts";
import {
  DecisionPanel,
  DiscussionPanel,
  EvidencePanel,
  ExperimentPanel,
  GisPanel,
  MemberStrip,
  OverviewPanel,
  PilotPanel,
  ResearchPanel,
  ReviewPanel,
  TaskPanel,
  TeamPanel,
} from "@/components/innovation/workspace/workspaceModules";
import {
  PROJECTS,
  WORKSPACE_MODULES,
  didForProject,
  getChallenge,
  type Project,
} from "@/data/innovation";

/**
 * The collaborative workspace. This is the screen that makes BHUMI-NITI a
 * research platform rather than a competition page: the accepted submission
 * keeps its evidence, tasks, experiments, pilot results and decisions in one
 * place, and the module lives in the URL so a reviewer can be sent straight to
 * the evidence locker or the decision log.
 */
export function InnovationWorkspace({
  project,
  module,
  onModuleChange,
}: {
  project: Project;
  module: string | undefined;
  onModuleChange: (module: string) => void;
}) {
  const [query, setQuery] = useState("");

  const challenge = getChallenge(project.challengeId);
  const active = WORKSPACE_MODULES.find((m) => m.id === module) ?? WORKSPACE_MODULES[0]!;

  const panel = () => {
    switch (active.id) {
      case "evidence":
        return <EvidencePanel project={project} />;
      case "research":
        return <ResearchPanel project={project} />;
      case "gis":
        return <GisPanel project={project} />;
      case "tasks":
        return <TaskPanel project={project} />;
      case "discussion":
        return <DiscussionPanel project={project} />;
      case "experiments":
        return <ExperimentPanel project={project} />;
      case "pilots":
        return <PilotPanel project={project} />;
      case "decisions":
        return <DecisionPanel project={project} />;
      case "review":
        return <ReviewPanel project={project} />;
      case "team":
        return <TeamPanel project={project} />;
      case "assistant":
        return <AssistantPanel project={project} />;
      case "evaluation": {
        const experiments = didForProject(project.id);
        return (
          <div className="inno-mod">
            <div className="inno-mod-head">
              <h2>Policy Experiment</h2>
              <p>
                Causal evaluation of this project&rsquo;s intervention, with methodology and
                assumptions visible. An experiment whose comparison data is incomplete is reported
                as blocked rather than estimated.
              </p>
            </div>
            {experiments.length > 0 ? (
              experiments.map((did) => <DidChart key={did.id} did={did} />)
            ) : (
              <p className="inno-side-note">
                This project has no policy experiment with a comparison group yet, so no
                difference-in-differences estimate can be made.
              </p>
            )}
          </div>
        );
      }
      default:
        return <OverviewPanel project={project} />;
    }
  };

  const openTaskCount = project.tasks.filter((t) => t.column !== "Done").length;
  const otherProjects = PROJECTS.filter((p) => p.id !== project.id);

  return (
    <InnovationShell
      query={query}
      onQuery={setQuery}
      subNav={[
        { label: "Home", href: "/innovation" },
        { label: "Challenges", href: "/innovation/challenges" },
        { label: "Submit a Solution", href: "/innovation/submit" },
      ]}
    >
      {/* WORKSPACE HEADER — spec §6 */}
      <header className="inno-ws-head">
        <div className="inno-ws-crumbs">
          <Link to="/innovation" className="inno-inline-link">
            <ArrowLeft /> Innovation Portal
          </Link>
          <ChevronRight />
          {challenge && (
            <Link
              to="/innovation/challenges/$challengeId"
              params={{ challengeId: challenge.id }}
              className="inno-inline-link"
            >
              {challenge.title}
            </Link>
          )}
        </div>

        <div className="inno-ws-title">
          <div>
            <div className="inno-cc-top">
              <Chip tone="green">{project.status}</Chip>
              <Chip tone="blue">{project.stage}</Chip>
            </div>
            <h1>{project.name}</h1>
            <p className="inno-ws-meta">
              <span>
                <Building /> {project.institution}
              </span>
              <span>
                <MapPin /> {project.pilotGeography}
              </span>
              <span>
                <Users /> {project.members.length} members
              </span>
              <span>
                <Rocket /> Started {project.startedOn}
              </span>
            </p>
          </div>
          <div className="inno-ws-side">
            <MemberStrip project={project} />
            <div className="inno-progress">
              <div className="inno-progress-head">
                <span>Progress</span>
                <strong>{project.progress}%</strong>
              </div>
              <div
                className="inno-progress-bar"
                role="progressbar"
                aria-valuenow={project.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Project progress"
              >
                <i style={{ width: `${project.progress}%` }} />
              </div>
              <small>{openTaskCount} open tasks</small>
            </div>
          </div>
        </div>
      </header>

      <div className="inno-ws">
        {/* LEFT PROJECT NAVIGATION */}
        <nav className="inno-ws-nav" aria-label="Workspace modules">
          {WORKSPACE_MODULES.map((m) => (
            <button
              key={m.id}
              className={m.id === active.id ? "active" : ""}
              onClick={() => onModuleChange(m.id)}
              aria-current={m.id === active.id ? "page" : undefined}
            >
              <strong>{m.label}</strong>
              <small>{m.description}</small>
            </button>
          ))}
        </nav>

        {/* MODULE PANEL */}
        <section className="inno-ws-panel">
          {panel()}
          <DemoNote>
            This workspace is a demo record. Project members, decisions, KPI values and reviewer
            scores are illustrative.
          </DemoNote>
        </section>
      </div>

      {/* Other workspaces, so a reviewer can move between projects. */}
      <div className="inno-ws-foot">
        <h2>Other active workspaces</h2>
        <div className="inno-card-grid">
          {otherProjects.map((p) => {
            const pChallenge = getChallenge(p.challengeId);
            return (
              <a key={p.id} href={`/innovation/workspace/${p.id}`} className="inno-mini-card">
                <div className="inno-cc-top">
                  <Chip tone="green">{p.status}</Chip>
                </div>
                <strong>{p.name}</strong>
                <small>{pChallenge?.title}</small>
                <div className="inno-progress-bar" role="presentation">
                  <i style={{ width: `${p.progress}%` }} />
                </div>
                <span className="inno-cc-link">{p.progress}% complete</span>
              </a>
            );
          })}
        </div>
      </div>
    </InnovationShell>
  );
}
