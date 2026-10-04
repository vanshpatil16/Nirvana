import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Download,
  FileCheck2,
  FlaskConical,
  Hash,
  Landmark,
  Layers,
  Lock,
  Network,
  Scale,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { POLICYMAKER_MOCK_DATA } from "@/mock/dashboardData";

export function PolicymakerDashboard() {
  const { headlineOutput, activeScenarios, kpiLedgerSummary, latestCausalResult } = POLICYMAKER_MOCK_DATA;
  const [chainVerified, setChainVerified] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-background to-background p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">
                <Landmark className="h-3 w-3" />
                Policymaker Portal
              </span>
              <HonestyBadge type="MODELLED" />
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {headlineOutput}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Evidence-based evaluation & pre-registered policy simulation for land administration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/policy-lab"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Open Policy Lab
            </a>
          </div>
        </div>
      </div>

      {/* Top KPI Ledger & Proof Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Pre-Registered KPIs</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{kpiLedgerSummary.lockedKpis}</span>
            <span className="text-xs text-muted-foreground">/ {kpiLedgerSummary.totalTracked} locked</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Immutable targets on ledger</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Ledger Cryptographic Status</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>{kpiLedgerSummary.chainStatus}</span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate" title={kpiLedgerSummary.chainHash}>
            {kpiLedgerSummary.chainHash}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Active Policy Cohorts</span>
            <HonestyBadge type="MODELLED" />
          </div>
          <div className="mt-2 text-2xl font-bold text-primary">{activeScenarios.length} cohorts</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Simulating 13 test districts</p>
        </div>
      </div>

      {/* Main Grid: Latest Causal Result + Active Scenarios */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Latest Causal Result Card (DiD Proof) */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">
                  Pre-Registered DiD Evaluation
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400">
                  Grade: {latestCausalResult.evidenceGrade}
                </span>
                <HonestyBadge type="MODELLED" />
              </div>
              <h2 className="mt-2 text-base font-bold text-foreground">
                {latestCausalResult.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Intervention: {latestCausalResult.intervention}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3.5 mb-4 border border-border/50 text-xs">
            <div>
              <span className="text-muted-foreground font-medium">Treated Group</span>
              <div className="font-semibold text-foreground mt-0.5">{latestCausalResult.treatedUnits}</div>
              <div className="font-mono text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                {latestCausalResult.treatedBeforeAfter}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground font-medium">Synthetic Control</span>
              <div className="font-semibold text-foreground mt-0.5">{latestCausalResult.controlUnits}</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                {latestCausalResult.controlBeforeAfter}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 mb-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                True Causal Effect (Difference-in-Differences):
              </span>
              <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                {latestCausalResult.trueEffect}
              </span>
            </div>
            <div className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1 flex items-center justify-between">
              <span>95% Confidence Interval: {latestCausalResult.ci95}</span>
              <span className="font-medium">Statistically Significant (p &lt; 0.01)</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border/40 pt-3">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Parallel trends assumption: {latestCausalResult.parallelTrends}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Falsification test: {latestCausalResult.placeboCheck}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border/40">
            <a
              href="/policy-lab"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Inspect Simulation <ArrowRight className="h-3 w-3" />
            </a>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => alert("Evidence Capsule exported as RO-Crate package (ark:/9281/mord-dilrmp-did-2026.zip)")}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export Evidence Capsule
            </Button>
          </div>
        </div>

        {/* Right: Active Policy Scenarios & KPI Ledger Card */}
        <div className="space-y-6 lg:col-span-5">
          {/* Active Scenarios */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-primary" />
                <span>Active Pre-Registered Scenarios</span>
              </h3>
              <HonestyBadge type="MODELLED" />
            </div>

            <div className="space-y-3">
              {activeScenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{sc.title}</span>
                    <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {sc.state}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Cohort: {sc.districts} districts · Status: {sc.status}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs pt-1.5 border-t border-border/30">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {sc.modelledImpact}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{sc.confidence}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 text-center">
              <a
                href="/policy-lab?mode=new"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                Configure New Scenario <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* KPI Ledger Summary & Verify Chain */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-600" />
                <span>KPI Ledger Integrity</span>
              </h3>
              <HonestyBadge type="LIVE" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Policy KPIs are locked against retroactive modification.
            </p>

            <div className="rounded-lg bg-muted/50 p-3 border border-border/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Block #1048:</span>
                <span className="font-mono text-foreground font-semibold">{kpiLedgerSummary.chainHash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Committed:</span>
                <span className="text-foreground">{kpiLedgerSummary.lastBlockTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Immutable KPIs:</span>
                <span className="text-foreground font-semibold">{kpiLedgerSummary.lockedKpis} targets locked</span>
              </div>
            </div>

            <div className="mt-3">
              {chainVerified ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Chain intact: 384 ledger commitments verified against SHA-256 tree.</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setChainVerified(true)}
                >
                  <Hash className="h-3.5 w-3.5 mr-1" />
                  Verify Cryptographic Chain
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AiDisclaimerFooter />
    </div>
  );
}
