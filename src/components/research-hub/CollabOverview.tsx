import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  GitBranch,
  ListChecks,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react";
import {
  RESEARCHERS,
  researcher,
  seedComments,
  seedTasks,
  seedVersions,
  type Comment,
  type Task,
} from "@/data/research-hub";
import { useHub } from "./hub-context";
import { Avatar, WorkspaceCard } from "./ResearchSections";
import { LiveManuscript } from "./LiveManuscript";

// Workspace state is saved per browser by the workspace view; fall back to seed data
function stored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Landing view for /collaborativehub — who is working on what, right now. */
export function CollabOverview({ onCreate }: { onCreate: () => void }) {
  const hub = useHub();
  const [live, setLive] = useState<{
    tasks: Record<string, Task[]>;
    comments: Record<string, Comment[]>;
  } | null>(null);

  // Read saved tasks/comments after mount so server and client markup match
  useEffect(() => {
    setLive({
      tasks: Object.fromEntries(
        hub.workspaces.map((w) => [w.id, stored(`rh:${w.id}:tasks`, seedTasks(w))]),
      ),
      comments: Object.fromEntries(
        hub.workspaces.map((w) => [w.id, stored(`rh:${w.id}:comments`, seedComments(w))]),
      ),
    });
  }, [hub.workspaces]);

  const tasksOf = (id: string) =>
    live?.tasks[id] ?? seedTasks(hub.workspaces.find((w) => w.id === id)!);
  const commentsOf = (id: string) =>
    live?.comments[id] ?? seedComments(hub.workspaces.find((w) => w.id === id)!);

  const members = useMemo(
    () => Array.from(new Set(hub.workspaces.flatMap((w) => w.members))),
    [hub.workspaces],
  );
  const online = members.filter((m) => researcher(m)?.online);
  const openTasks = hub.workspaces.reduce(
    (n, w) => n + tasksOf(w.id).filter((t) => t.column !== "Completed").length,
    0,
  );
  const threads = hub.workspaces.reduce((n, w) => n + commentsOf(w.id).length, 0);
  const institutions = new Set(hub.workspaces.flatMap((w) => w.institutions)).size;

  // Activity: latest versions + comments across workspaces
  const activity = hub.workspaces
    .flatMap((w) => [
      ...seedVersions(w)
        .slice(0, 2)
        .map((v) => ({
          who: v.author,
          what: v.note,
          where: w,
          when: v.time,
          kind: "version" as const,
        })),
      ...commentsOf(w.id)
        .slice(0, 1)
        .map((c) => ({
          who: c.author,
          what: c.text,
          where: w,
          when: c.time,
          kind: "comment" as const,
        })),
    ])
    .slice(0, 7);

  // Upcoming tasks assigned across workspaces
  const upcoming = hub.workspaces
    .flatMap((w) =>
      tasksOf(w.id)
        .filter((t) => t.column !== "Completed")
        .map((t) => ({ ...t, ws: w })),
    )
    .slice(0, 5);

  const stats = [
    { icon: GitBranch, value: hub.workspaces.length, label: "Active workspaces" },
    { icon: Users, value: members.length, label: `Researchers · ${institutions} institutions` },
    { icon: CheckCircle2, value: online.length, label: "Online now" },
    { icon: ListChecks, value: openTasks, label: "Open tasks" },
    { icon: MessageSquare, value: threads, label: "Discussion threads" },
  ];

  return (
    <>
      <section className="rh-collab-hero" aria-label="Collaborative Hub">
        <div>
          <span className="rh-eyebrow">
            <Users /> Collaborative Hub
          </span>
          <h1>Build land-governance research together.</h1>
          <p>
            Shared workspaces where researchers, officials and GIS analysts from different
            institutions co-write, analyse and review evidence — in one place.
          </p>
          <div className="rh-hero-ctas">
            <button className="rh-btn primary" onClick={onCreate}>
              <Plus /> Start a workspace
            </button>
            <button className="rh-btn" onClick={() => hub.go("manuscript")}>
              <FileText /> Open live manuscript
            </button>
          </div>
        </div>
        <div className="rh-collab-online" aria-label="Researchers online now">
          <span className="rh-collab-online-title">
            <span className="rh-live-dot" /> {online.length} researchers online
          </span>
          <div className="rh-avatars" style={{ marginTop: 10 }}>
            {online.map((m) => (
              <Avatar key={m} id={m} online />
            ))}
          </div>
          <small>{online.map((m) => researcher(m)?.name.split(" ")[0]).join(", ")}</small>
        </div>
      </section>

      <div className="rh-collab-stats">
        {stats.map((s) => (
          <div key={s.label} className="rh-card rh-collab-stat">
            <s.icon />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="rh-collab-grid">
        <section>
          <div className="rh-section-head" style={{ marginBottom: 12 }}>
            <div>
              <span className="rh-eyebrow">
                <GitBranch /> Workspaces
              </span>
              <h2>Your shared research</h2>
            </div>
            <button className="rh-btn" onClick={() => hub.go("workspaces")}>
              All workspaces <ArrowRight />
            </button>
          </div>
          <div className="rh-ws-grid">
            {hub.workspaces.slice(0, 4).map((w) => (
              <WorkspaceCard key={w.id} ws={w} />
            ))}
          </div>
        </section>

        <aside className="rh-collab-side">
          <div className="rh-card rh-panel">
            <h4>Recent activity</h4>
            <div className="rh-collab-feed">
              {activity.map((a, i) => (
                <button
                  key={i}
                  className="rh-collab-act"
                  onClick={() => hub.openWorkspace(a.where.id)}
                >
                  <Avatar id={a.who} />
                  <span>
                    <b>{researcher(a.who)?.name.split(" ")[0]}</b>{" "}
                    {a.kind === "comment" ? "commented" : "updated"} <em>{a.where.title}</em>
                    <small>
                      {a.what.length > 90 ? `${a.what.slice(0, 90)}…` : a.what} · {a.when}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="rh-card rh-panel">
            <h4>Open tasks</h4>
            <ul className="rh-collab-tasks">
              {upcoming.map((t) => (
                <li key={`${t.ws.id}-${t.id}`}>
                  <button onClick={() => hub.openWorkspace(t.ws.id)}>
                    <span className="rh-tag">{t.column}</span>
                    <strong>{t.title}</strong>
                    <small>
                      <Avatar id={t.assignee} online={false} />{" "}
                      {researcher(t.assignee)?.name.split(" ")[0]} · due {t.due}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rh-card rh-panel">
            <h4>People you work with</h4>
            <div className="rh-people">
              {members.slice(0, 6).map((m) => {
                const r = researcher(m);
                return r ? (
                  <div key={m} className="rh-person">
                    <Avatar id={m} />
                    <div>
                      <strong>{r.name}</strong>
                      <small>
                        {r.role} · {r.institution}
                      </small>
                    </div>
                    <span className={`rh-dot${r.online ? "" : " off"}`} />
                  </div>
                ) : null;
              })}
            </div>
            <button
              className="rh-btn sm"
              style={{ marginTop: 12 }}
              onClick={() => hub.go("network")}
            >
              Find collaborators ({RESEARCHERS.length}) <ArrowRight />
            </button>
          </div>
        </aside>
      </div>

      <section className="rh-section">
        <div className="rh-section-head">
          <div>
            <span className="rh-eyebrow">
              <FileText /> Live now
            </span>
            <h2>Manuscript being co-written</h2>
            <p>Tracked changes, comments and live cursors from four institutions.</p>
          </div>
        </div>
        <LiveManuscript />
      </section>
    </>
  );
}
