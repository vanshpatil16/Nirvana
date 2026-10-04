import React from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  HelpCircle,
  MapPin,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { CITIZEN_MOCK_DATA } from "@/mock/dashboardData";

export function CitizenDashboard() {
  const { headlineOutput, myReports, openConsultations, plainSummaries } = CITIZEN_MOCK_DATA;

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-background to-background p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">
                <UserRound className="h-3 w-3" />
                Citizen Portal
              </span>
              <HonestyBadge type="LIVE" />
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {headlineOutput}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check public land records, report ground discrepancies, and submit public consultation feedback.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/report-mismatch"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <Flag className="h-3.5 w-3.5" />
              Report a Mismatch
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: My Reports Status & Public Consultations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: My Reported Mismatches (Status Tracker) */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>My Submitted Reports & Status</span>
                <HonestyBadge type="LIVE" />
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track verification progress conducted by the local Talathi / Tehsildar.
              </p>
            </div>
            <a
              href="/report-status"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-4">
            {myReports.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-semibold text-primary">{r.id}</span>
                    <h3 className="text-xs font-bold text-foreground mt-0.5">{r.title}</h3>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Survey No: <span className="font-semibold">{r.surveyNo}</span> · {r.village}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">{r.date}</span>
                </div>

                {/* Progress Stepper */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mb-1">
                    <span className="text-emerald-600 font-bold">1. Submitted</span>
                    <span className={r.statusStep >= 2 ? "text-emerald-600 font-bold" : ""}>2. Assigned</span>
                    <span className={r.statusStep >= 3 ? "text-emerald-600 font-bold" : ""}>3. Visited</span>
                    <span className={r.statusStep >= 4 ? "text-emerald-600 font-bold" : ""}>4. Resolved</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{ width: `${(r.statusStep / 4) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                  <span className="text-muted-foreground">Office: {r.officerAssigned}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{r.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Notice a discrepancy on your plot?</span>
            <a
              href="/report-mismatch"
              className="text-xs font-semibold text-primary hover:underline"
            >
              File a new report &rarr;
            </a>
          </div>
        </div>

        {/* Right: Public Consultations & Plain Language Summaries */}
        <div className="space-y-6 lg:col-span-5">
          {/* Public Consultations */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <span>Open Public Consultations</span>
              </h3>
              <HonestyBadge type="LIVE" />
            </div>

            <div className="space-y-3">
              {openConsultations.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-1.5 text-xs"
                >
                  <div className="font-semibold text-foreground leading-snug">{c.title}</div>
                  <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                    <span>Deadline: {c.deadline}</span>
                    <span>{c.responses} citizen responses</span>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <a
                      href={`/consultations?id=${c.id}`}
                      className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 text-xs font-semibold transition-colors"
                    >
                      Give Feedback <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plain Summaries */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Plain Language Land Guides</span>
              </h3>
              <HonestyBadge type="DEMO" />
            </div>

            <div className="space-y-2.5">
              {plainSummaries.map((s, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{s.title}</span>
                    <span className="text-[10px] text-muted-foreground">{s.readingTime}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.summary}</p>
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
