import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Filter,
  ListTodo,
  MapPin,
  Search,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { OFFICER_TASKS, type OfficerTask } from "@/mock/officerData";
import { toast } from "sonner";

export function MyTasks() {
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<OfficerTask[]>(OFFICER_TASKS);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "Pending" && t.status !== "Pending") return false;
    if (filter === "In Progress" && t.status !== "In Progress") return false;
    if (filter === "Completed" && t.status !== "Completed") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.surveyNo.toLowerCase().includes(q) ||
        t.village.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleMarkComplete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "Completed" as const } : t))
    );
    toast.success(`Task ${id} marked as completed`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              <ListTodo className="h-3 w-3" />
              Task Inbox
            </span>
            <HonestyBadge type="LIVE" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            My Operational Tasks &amp; Verification Inbox
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Field visits, party hearings, RoR reconciliation checks, and data-access authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/verification-queue"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Verification Queue
          </a>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border/70 bg-card">
          {["All", "Pending", "In Progress", "Completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                filter === tab
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks, survey no, village…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Tasks Table / List */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
        <div className="divide-y divide-border/40">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No tasks match your current filter.
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{task.id}</span>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        task.priority === "High"
                          ? "bg-red-500/15 text-red-700 dark:text-red-400"
                          : task.priority === "Medium"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {task.priority} Priority
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Type: {task.taskType}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-foreground">{task.title}</h3>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>
                      Survey: <strong className="text-foreground">{task.surveyNo}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      {task.village} ({task.taluka})
                    </span>
                    <span>·</span>
                    <span>Assigned to: {task.assignedTo}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Due: {task.dueDate}</span>
                    </div>
                    <span
                      className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded ${
                        task.status === "Completed"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : task.status === "In Progress"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {task.parcelId.startsWith("MH-") ? (
                      <a
                        href={`/parcel?id=${task.parcelId}`}
                        className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Inspect <ArrowRight className="h-3 w-3" />
                      </a>
                    ) : (
                      <a
                        href="/federation-console"
                        className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Review <ArrowRight className="h-3 w-3" />
                      </a>
                    )}

                    {task.status !== "Completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleMarkComplete(task.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                        Done
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AiDisclaimerFooter />
    </div>
  );
}
