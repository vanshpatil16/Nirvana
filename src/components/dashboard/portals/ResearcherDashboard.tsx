import React from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  GraduationCap,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { RESEARCHER_MOCK_DATA } from "@/mock/dashboardData";

export function ResearcherDashboard() {
  const { headlineOutput, evidencePapers, gapMapStats, myCapsules, demandBoardQuestions } = RESEARCHER_MOCK_DATA;

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className="rounded-xl border border-blue-500/25 bg-gradient-to-r from-blue-500/10 via-background to-background p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded">
                <GraduationCap className="h-3 w-3" />
                Researcher Portal
              </span>
              <HonestyBadge type="LIVE" />
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {headlineOutput}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Empirical repository, Evidence Gap Maps, reproducible capsules & research demand board.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/research-hub"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Open Research Hub
            </a>
          </div>
        </div>
      </div>

      {/* Top Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Graded Studies</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">148 papers</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Rigorous land governance trials</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Evidence Gap Matrix</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {gapMapStats.strongEvidenceCount} Strong
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{gapMapStats.criticalGapsCount} identified critical gaps</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Reproducible Capsules</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {myCapsules.length} Active
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">RO-Crate standardized</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">DoLR Demand Board</span>
            <HonestyBadge type="LIVE" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {demandBoardQuestions.length} Open
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Funded research questions</p>
        </div>
      </div>

      {/* Main Grid: Graded Evidence Papers + Capsules & Gap Map */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Graded Evidence Papers */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Recent Graded Land Research</span>
                <HonestyBadge type="LIVE" />
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every study is graded for causal rigor: Strong (RCT/DiD) · Moderate (IV/Matching) · Limited.
              </p>
            </div>
            <a
              href="/research-hub?view=publications"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Browse all <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="space-y-3">
            {evidencePapers.map((paper, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/60 bg-background/50 p-3.5 hover:border-blue-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-foreground leading-snug">{paper.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">{paper.authors}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                      paper.grade === "Strong"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : paper.grade === "Moderate"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    Grade: {paper.grade}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/30 text-[11px]">
                  <span className="text-muted-foreground">{paper.citations} citations · {paper.date}</span>
                  <div className="flex items-center gap-2">
                    {paper.roCrateAvailable && (
                      <span className="text-[10px] font-mono font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        RO-Crate ✓
                      </span>
                    )}
                    <a
                      href="/research-hub?view=discover"
                      className="font-semibold text-primary hover:underline flex items-center gap-0.5"
                    >
                      Read Brief <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Reproducible Capsules & Demand Board Questions */}
        <div className="space-y-6 lg:col-span-5">
          {/* Reproducible Capsules */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4 text-primary" />
                <span>My Reproducible Capsules</span>
              </h3>
              <HonestyBadge type="LIVE" />
            </div>

            <div className="space-y-2.5">
              {myCapsules.map((cap) => (
                <div
                  key={cap.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3 hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{cap.title}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{cap.roCrate}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/30 text-xs">
                    <span className="text-[11px] text-muted-foreground">{cap.runs} executions logged</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => alert(`Re-running reproducible pipeline for ${cap.title}...`)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Re-run
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Research Demand Board */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Research Demand Board</span>
              </h3>
              <HonestyBadge type="LIVE" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Open empirical questions commissioned directly by government agencies.
            </p>

            <div className="space-y-2.5">
              {demandBoardQuestions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-1.5 text-xs"
                >
                  <div className="font-semibold text-foreground leading-snug">{q.question}</div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span>Sponsor: {q.sponsor}</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{q.reward}</span>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant={q.status === "Open" ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => alert(`Research proposal registered for: ${q.question}`)}
                    >
                      {q.status === "Open" ? "Claim Question" : "View Claims"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AiDisclaimerFooter />
    </div>
  );
}
