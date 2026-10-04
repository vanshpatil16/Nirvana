import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Lock,
  Server,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { STATE_OWNER_MOCK_DATA } from "@/mock/dashboardData";

export function StateOwnerDashboard() {
  const { headlineOutput, nodes, privacyStats, pendingAccessRequests, auditLogPreview } = STATE_OWNER_MOCK_DATA;
  const [requests, setRequests] = useState(pendingAccessRequests);

  const handleAction = (id: string, action: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    alert(`Access request ${id} ${action} successfully. State audit log updated.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className="rounded-xl border border-purple-500/25 bg-gradient-to-r from-purple-500/10 via-background to-background p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded">
                <Server className="h-3 w-3" />
                State Data Owner Portal
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/20">
                <ShieldCheck className="h-3 w-3" />
                Raw Data Stays On-Premise
              </span>
              <HonestyBadge type="LIVE" />
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {headlineOutput}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Federated node management, differential privacy budget & purpose-bound query auditing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/federation-console"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <Server className="h-3.5 w-3.5" />
              Open Privacy Console
            </a>
          </div>
        </div>
      </div>

      {/* Node Status Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" />
            <span>Federated Authority Nodes</span>
          </h2>
          <HonestyBadge type="LIVE" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {nodes.map((node) => (
            <div
              key={node.name}
              className={`rounded-xl border p-4 shadow-2xs ${
                node.status === "ONLINE"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border/70 bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground truncate max-w-[170px]" title={node.name}>
                  {node.name}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    node.status === "ONLINE"
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {node.status}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground font-mono">{node.recordsCount}</div>
              <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                <span>Latency: {node.latency}</span>
                <span>Uptime: {node.uptime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Budget & Query Protection Meter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Queries Served Today</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {privacyStats.queriesServedToday.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Federated zero-copy execution</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Privacy Suppressed (k &lt; 5)</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {privacyStats.suppressedResultsK}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">k-anonymity privacy violations blocked</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Privacy Budget (ε)</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {privacyStats.privacyBudgetEpsilonUsed}
            </span>
            <span className="text-xs text-muted-foreground">/ {privacyStats.privacyBudgetLimit} ε consumed</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-purple-600 h-full rounded-full"
              style={{
                width: `${(privacyStats.privacyBudgetEpsilonUsed / privacyStats.privacyBudgetLimit) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Access Requests + Audit Log Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Pending Requests for Row-level Aggregates */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-500" />
                <span>Pending Data-Access Requests</span>
              </h3>
              <p className="text-xs text-muted-foreground">Purpose-bound research query approval</p>
            </div>
            <HonestyBadge type="LIVE" />
          </div>

          {requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No pending requests. All queries within permitted k-anonymity bounds.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="rounded-lg border border-border/60 bg-background/50 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{r.requester}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{r.institution}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">{r.purpose}</p>
                  <div className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                    Scope: {r.requestedRows}
                  </div>
                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-600 hover:text-red-700"
                      onClick={() => handleAction(r.id, "Rejected")}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleAction(r.id, "Time-limited (30d)")}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Time-Limit (30d)
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleAction(r.id, "Approved")}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Log Preview */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Cryptographic Audit Trail</span>
              </h3>
              <p className="text-xs text-muted-foreground">Immutable query hash verification</p>
            </div>
            <HonestyBadge type="LIVE" />
          </div>

          <div className="space-y-2.5">
            {auditLogPreview.map((log, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{log.user}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{log.time}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground truncate" title={log.query}>
                  <code>{log.query}</code>
                </div>
                <div className="flex items-center justify-between pt-1 text-[10px]">
                  <span className="text-muted-foreground">{log.rowsReturned} rows returned</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {log.privacyCheck}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 text-center">
            <a
              href="/federation-console"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              Open Full Audit Log Console &rarr;
            </a>
          </div>
        </div>
      </div>

      <AiDisclaimerFooter />
    </div>
  );
}
