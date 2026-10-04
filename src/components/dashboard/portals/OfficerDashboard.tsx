import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileCheck2,
  Layers,
  MapPin,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, ScreeningSignalLabel, AiDisclaimerFooter } from "@/mock/badges";
import { OFFICER_MOCK_DATA, type VillageIntegrity } from "@/mock/dashboardData";

export function OfficerDashboard() {
  const { summaryStats, topVillages, highRiskParcels, miniSplitPreview, headlineOutput } = OFFICER_MOCK_DATA;

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className="rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-background to-background p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">
                <UserCheck className="h-3 w-3" />
                Officer Portal
              </span>
              <HonestyBadge type="DEMO" />
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {headlineOutput}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ranked prioritization for field inspections across Nashik Division.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/verification-queue"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Open Verification Queue
            </a>
          </div>
        </div>
      </div>

      <ScreeningSignalLabel />

      {/* KPI Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Open Field Tasks</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{summaryStats.totalOpenTasks}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Across 10 priority villages</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Assigned to Me</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{summaryStats.assignedToMe}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Due within 7 working days</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">High Risk (≥ 70)</span>
            <HonestyBadge type="MODELLED" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{summaryStats.highRiskParcels}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Immediate check recommended</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Avg Resolution</span>
            <HonestyBadge type="DEMO" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summaryStats.avgResolutionDays}d</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Down from 18.2d benchmark</p>
        </div>
      </div>

      {/* Main Grid: Top 10 Villages + High-Risk Parcels & Split Map Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Top 10 Villages Ranked by Integrity Index */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Top-10 Priority Villages by Integrity Index</span>
                <HonestyBadge type="MODELLED" />
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lowest index indicates highest density of record-versus-satellite mismatches.
              </p>
            </div>
            <a
              href="/verification-queue"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                  <th className="pb-2 pl-2">#</th>
                  <th className="pb-2">Village</th>
                  <th className="pb-2">Integrity Score</th>
                  <th className="pb-2">Top Discrepancy</th>
                  <th className="pb-2">Flagged</th>
                  <th className="pb-2 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {topVillages.map((v) => (
                  <tr key={v.village} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 pl-2 font-mono text-muted-foreground">{v.rank}</td>
                    <td className="py-2.5 font-medium text-foreground">
                      <div>{v.village}</div>
                      <div className="text-[10px] text-muted-foreground">{v.district}</div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              v.integrityIndex < 65
                                ? "bg-red-500"
                                : v.integrityIndex < 75
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${v.integrityIndex}%` }}
                          />
                        </div>
                        <span className="font-mono font-semibold">{v.integrityIndex}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      <span className="inline-block truncate max-w-[130px]" title={v.topDefect}>
                        {v.topDefect}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          v.riskBadge === "HIGH"
                            ? "bg-red-500/15 text-red-700 dark:text-red-400"
                            : v.riskBadge === "MEDIUM"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {v.parcelsFlagged}
                      </span>
                    </td>
                    <td className="py-2.5 text-right pr-2">
                      <a
                        href={`/verification-queue?village=${encodeURIComponent(v.village)}`}
                        className="inline-flex items-center justify-center rounded px-2 py-1 text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        Assign
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: High-Risk Parcels & Mini Split Map Preview */}
        <div className="space-y-6 lg:col-span-5">
          {/* High-Risk Parcels Widget */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <span>High-Risk Parcels (Score ≥ 70)</span>
                </h3>
                <p className="text-[11px] text-muted-foreground">Screened from latest Sentinel-2 pass</p>
              </div>
              <HonestyBadge type="MODELLED" />
            </div>

            <div className="space-y-2.5">
              {highRiskParcels.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-foreground">
                        Survey No. {p.surveyNo}
                      </span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{p.village}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-extrabold text-red-600 dark:text-red-400">
                        {p.riskScore}
                      </span>
                      <span className="text-[9px] font-bold uppercase bg-red-500/15 text-red-700 dark:text-red-400 px-1 py-0.5 rounded">
                        HIGH
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    <span className="text-foreground/80 font-medium">Record:</span> {p.recordUse}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate" title={p.satelliteReality}>
                    <span className="text-foreground/80 font-medium">Satellite:</span> {p.satelliteReality}
                  </div>
                  <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground font-mono">{p.topDefect}</span>
                    <a
                      href={`/verification-queue?parcel=${p.id}`}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      Inspect parcel <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Split Map Preview */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                <span>Mini Split Map: {miniSplitPreview.village}</span>
              </h3>
              <HonestyBadge type="DEMO" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">{miniSplitPreview.comparison}</p>

            <div className="relative rounded-lg overflow-hidden border border-border/80 bg-muted aspect-video flex items-center justify-center text-center p-4">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/40 via-amber-950/40 to-slate-950/60" />
              <div className="relative z-10 text-white p-3">
                <span className="text-[10px] uppercase font-bold tracking-wider bg-black/60 px-2 py-0.5 rounded">
                  Spatial Change Detected
                </span>
                <p className="mt-2 text-xs font-semibold text-amber-200">
                  {miniSplitPreview.mismatchFound}
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <a
                    href="/landdifference"
                    className="inline-flex items-center gap-1 rounded bg-white/20 hover:bg-white/30 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-white transition-colors"
                  >
                    Open Temporal Split <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AiDisclaimerFooter />
    </div>
  );
}
