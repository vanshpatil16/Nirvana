import React from "react";
import {
  ArrowRight,
  Code2,
  Cpu,
  Key,
  Lightbulb,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { INNOVATOR_MOCK_DATA } from "@/mock/dashboardData";

export function InnovatorDashboard() {
  const { headlineOutput, openChallenges, apiUsage, hackathons, demandBoardProblems } = INNOVATOR_MOCK_DATA;

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className="rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 via-background to-background p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded">
                <Lightbulb className="h-3 w-3" />
                Industry & Startup Portal
              </span>
              <HonestyBadge type="DEMO" />
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {headlineOutput}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              GovTech challenge briefs, pilot sandbox keys, grant funding & procurement pathways.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/innovation/challenges"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 transition-colors"
            >
              <Target className="h-3.5 w-3.5" />
              Explore Challenges
            </a>
          </div>
        </div>
      </div>

      {/* Top Strip Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Open Challenges</span>
            <HonestyBadge type="DEMO" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{openChallenges.length} Active</div>
          <p className="mt-1 text-[11px] text-muted-foreground">₹60 Lakhs total prize pool</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">API Calls Used</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {apiUsage.usedThisMonth.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Of 50,000 monthly sandbox quota</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Pilot Deployment</span>
            <HonestyBadge type="DEMO" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">Fast-Track</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Direct MoRD procurement track</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">State Problems</span>
            <HonestyBadge type="DEMO" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {demandBoardProblems.length} High-Value
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Looking for tech partners</p>
        </div>
      </div>

      {/* Main Grid: Open Challenges + API Sandbox & Hackathon */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Open Challenges */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Government Innovation Challenges</span>
                <HonestyBadge type="DEMO" />
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Funded algorithmic challenges to solve nationwide land governance bottlenecks.
              </p>
            </div>
            <a
              href="/innovation/challenges"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-3.5">
            {openChallenges.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-2 hover:border-orange-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                      {c.category}
                    </span>
                    <h3 className="text-xs font-bold text-foreground mt-1.5">{c.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-foreground">{c.prize}</span>
                    <div className="text-[10px] text-muted-foreground">{c.deadline}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <span className="text-[11px] text-muted-foreground">{c.applicants} teams applied</span>
                  <a
                    href={`/innovation/challenges?id=${c.id}`}
                    className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Apply Now <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: API Quota Sandbox & Hackathons */}
        <div className="space-y-6 lg:col-span-5">
          {/* API Key Usage Widget */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Key className="h-4 w-4 text-orange-500" />
                <span>Developer Sandbox Keys</span>
              </h3>
              <HonestyBadge type="LIVE" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">{apiUsage.plan}</p>

            <div className="rounded-lg bg-muted/40 p-3.5 border border-border/60 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Monthly Requests:</span>
                <span className="font-mono font-bold text-foreground">
                  {apiUsage.usedThisMonth.toLocaleString()} / {apiUsage.monthlyQuota.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-orange-600 h-full rounded-full"
                  style={{ width: `${(apiUsage.usedThisMonth / apiUsage.monthlyQuota) * 100}%` }}
                />
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-muted-foreground">
                <span>Active API Keys: {apiUsage.activeKeys}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Status: {apiUsage.status}</span>
              </div>
            </div>

            <div className="mt-3 flex justify-between items-center text-xs">
              <a href="/data-apis" className="text-primary font-semibold hover:underline">
                View API Docs & Endpoints &rarr;
              </a>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => alert("New test API key generated: nrv_live_sandbox_9941a82f")}
              >
                Generate Key
              </Button>
            </div>
          </div>

          {/* Hackathons & State Demand Problems */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>GovTech Buildathon 2026</span>
              </h3>
              <HonestyBadge type="DEMO" />
            </div>

            {hackathons.map((h, idx) => (
              <div key={idx} className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-1.5 text-xs">
                <div className="font-bold text-foreground">{h.title}</div>
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  {h.prizePool}
                </div>
                <p className="text-[11px] text-muted-foreground">{h.focus}</p>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground font-mono">{h.date}</span>
                  <a
                    href="/innovation"
                    className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                  >
                    Register Team &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AiDisclaimerFooter />
    </div>
  );
}
