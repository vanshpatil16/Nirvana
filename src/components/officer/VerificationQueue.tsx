import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileCheck2,
  GitBranch,
  Layers,
  MapPin,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, ScreeningSignalLabel, AiDisclaimerFooter } from "@/mock/badges";
import { OFFICER_MOCK_DATA, type VillageIntegrity } from "@/mock/dashboardData";
import { QUEUE_PARCELS, type ParcelVerificationDetail } from "@/mock/officerData";
import { toast } from "sonner";

export function VerificationQueue() {
  const { topVillages } = OFFICER_MOCK_DATA;
  const [selectedVillage, setSelectedVillage] = useState<string>("Vadner Bhairav");
  const [selectedParcel, setSelectedParcel] = useState<ParcelVerificationDetail>(QUEUE_PARCELS[0]!);
  const [ownershipModalOpen, setOwnershipModalOpen] = useState(false);
  const [assignedStatus, setAssignedStatus] = useState<string | null>(null);

  const handleAssignCheck = () => {
    setAssignedStatus("Assigned to field staff (Talathi S. Deshmukh)");
    toast.success("Field check assigned", {
      description: `Task dispatched to Talathi for Survey No. ${selectedParcel.surveyNo}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">
              <ShieldAlert className="h-3 w-3" />
              Officer Priority Queue
            </span>
            <HonestyBadge type="LIVE" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            Verification Queue &amp; Defect Screening
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ranked villages by Integrity Index paired with parcel-level rule evaluation &amp; ground check assignments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/my-tasks"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            My Active Tasks
          </a>
        </div>
      </div>

      <ScreeningSignalLabel />

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Panel: Ranked Villages & Parcel Selector (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ranked Villages (Integrity Index)
              </h2>
              <span className="text-[10px] text-muted-foreground">Nashik Division</span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {topVillages.map((v) => {
                const isSelected = selectedVillage === v.village;
                return (
                  <button
                    key={v.village}
                    onClick={() => {
                      setSelectedVillage(v.village);
                      const matchingParcel = QUEUE_PARCELS.find((p) => p.village === v.village) || QUEUE_PARCELS[0]!;
                      setSelectedParcel(matchingParcel);
                    }}
                    className={`w-full text-left rounded-lg p-2.5 transition-all border flex items-center justify-between ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border/50 bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                        <span className="font-mono text-muted-foreground">#{v.rank}</span>
                        <span>{v.village}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Top defect: <span className="text-foreground/80">{v.topDefect}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="font-mono font-bold text-xs">{v.integrityIndex}</span>
                        <span
                          className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                            v.riskBadge === "HIGH"
                              ? "bg-red-500/15 text-red-700 dark:text-red-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {v.riskBadge}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{v.parcelsFlagged} flagged</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Parcel Selector for Selected Village */}
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              Parcels in {selectedVillage}
            </h3>
            <div className="space-y-2">
              {QUEUE_PARCELS.map((p) => {
                const isSelected = selectedParcel.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedParcel(p);
                      setAssignedStatus(null);
                    }}
                    className={`w-full text-left rounded-lg p-3 transition-all border ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 shadow-xs"
                        : "border-border/50 bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-foreground">
                        Survey No. {p.surveyNo}
                      </span>
                      <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                        Risk {p.titleRiskScore}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {p.satelliteFinding}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Selected Parcel Inspector & 6-Rule Checklist (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
            {/* Parcel Header & Title Risk Ring */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-foreground">
                    Survey No. {selectedParcel.surveyNo}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({selectedParcel.village}, Taluka {selectedParcel.taluka})
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Area: {selectedParcel.areaHectares} Ha</span>
                  <span>·</span>
                  <span>ID: {selectedParcel.id}</span>
                </div>
              </div>

              {/* Title Risk Score Pill/Ring */}
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2 shrink-0">
                <div className="text-center">
                  <div className="font-mono text-2xl font-black text-red-600 dark:text-red-400 leading-none">
                    {selectedParcel.titleRiskScore}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300 mt-0.5">
                    Title Risk
                  </div>
                </div>
                <div className="border-l border-red-500/20 pl-3 text-left">
                  <span className="inline-block text-[10px] font-bold uppercase bg-red-500/20 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded">
                    {selectedParcel.riskBadge}
                  </span>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Field review priority
                  </div>
                </div>
              </div>
            </div>

            {/* Record vs Satellite Reality Comparison Block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                  Official Land Record (7/12)
                </span>
                <p className="mt-1.5 text-xs font-semibold text-foreground">
                  {selectedParcel.recordClassification}
                </p>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Registered use: Agriculture · Unirrigated fallow
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-amber-600" />
                  Satellite Reality (Sentinel-2 / UAV)
                </span>
                <p className="mt-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  {selectedParcel.satelliteFinding}
                </p>
                <div className="mt-2 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Built-up footprint: {selectedParcel.satelliteBuiltUpPct}% · Structural anomaly
                </div>
              </div>
            </div>

            {/* The 6 Defect Rules Pass/Fire Checklist */}
            <div className="mt-5 border-t border-border/40 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Automated Rule Engine (The 6 Land Discrepancy Rules)
                </h3>
                <HonestyBadge type="MODELLED" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedParcel.defectRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`rounded-lg border p-2.5 transition-all text-xs ${
                      rule.fired
                        ? "border-red-500/30 bg-red-500/5 text-red-950 dark:text-red-200"
                        : "border-border/50 bg-background text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        {rule.fired ? (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        )}
                        <span className={rule.fired ? "text-foreground font-bold" : ""}>
                          {rule.name}
                        </span>
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          rule.fired
                            ? "bg-red-500/20 text-red-700 dark:text-red-300"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {rule.fired ? "RULE FIRED" : "PASSED"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed pl-5">
                      {rule.description}
                    </p>
                    <div className="mt-1 pl-5 text-[10px] text-muted-foreground font-mono">
                      Ref: {rule.ruleCitation}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions: Assign Field Check & Trace Ownership */}
            <div className="mt-6 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleAssignCheck}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                  Assign Field Check
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOwnershipModalOpen(true)}
                  className="text-xs font-semibold"
                >
                  <GitBranch className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Trace Ownership Chain
                </Button>
              </div>

              <a
                href={`/parcel?id=${selectedParcel.id}`}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Open Full Parcel Task Page <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {assignedStatus && (
              <div className="mt-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{assignedStatus}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ownership Chain Modal */}
      {ownershipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  Ownership Chain Graph: Survey No. {selectedParcel.surveyNo}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Historical title transitions extracted from RoR and NGDRS e-Ferfar ledger.
                </p>
              </div>
              <button
                onClick={() => setOwnershipModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 py-2">
              {selectedParcel.ownershipChain.map((node, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i < selectedParcel.ownershipChain.length - 1 && (
                    <div className="absolute left-3.5 top-6 bottom-0 w-0.5 bg-border" />
                  )}
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-mono font-bold ${
                      node.verified
                        ? "bg-emerald-500 text-white"
                        : "bg-red-500 text-white animate-pulse"
                    }`}
                  >
                    {node.verified ? "✓" : "!"}
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/60 p-3 flex-1 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{node.owner}</span>
                      <span className="font-mono text-muted-foreground">{node.year}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Event: <span className="text-foreground">{node.event}</span> · Share: {node.share}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Deed Ref: {node.deedRef} · Status: {node.verified ? "Verified in Registry" : "UNVERIFIED / GAP"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setOwnershipModalOpen(false)}
              >
                Close Trace
              </Button>
            </div>
          </div>
        </div>
      )}

      <AiDisclaimerFooter />
    </div>
  );
}
