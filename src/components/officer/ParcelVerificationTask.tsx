import React, { useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  Layers,
  MapPin,
  ShieldAlert,
  Upload,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge, ScreeningSignalLabel, AiDisclaimerFooter } from "@/mock/badges";
import { QUEUE_PARCELS, type ParcelVerificationDetail } from "@/mock/officerData";
import { toast } from "sonner";

export function ParcelVerificationTask({ parcelId = "MH-NSK-VB-142" }: { parcelId?: string }) {
  const parcel = QUEUE_PARCELS.find((p) => p.id === parcelId) || QUEUE_PARCELS[0]!;

  const [step, setStep] = useState(parcel.statusStep);
  const [statusName, setStatusName] = useState(parcel.status);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleUpdateStatus = (newStep: number, label: "Flagged" | "Assigned" | "Visited" | "Confirmed" | "False alarm") => {
    setStep(newStep);
    setStatusName(label);
    toast.success(`Parcel status updated to: ${label}`, {
      description: `Survey No. ${parcel.surveyNo} verification record saved to state ledger.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div>
          <a
            href="/verification-queue"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Verification Queue
          </a>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl sm:text-2xl font-black text-foreground">
              Survey No. {parcel.surveyNo}
            </span>
            <span className="text-xs text-muted-foreground">({parcel.village}, Taluka {parcel.taluka})</span>
            <HonestyBadge type="LIVE" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Field-verification case file ID: <span className="font-mono">{parcel.id}</span> · Area: {parcel.areaHectares} Ha
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
              statusName === "Confirmed"
                ? "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30"
                : statusName === "False alarm"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
            }`}
          >
            Status: {statusName}
          </span>
        </div>
      </div>

      <ScreeningSignalLabel />

      {/* 4-Stage Status Stepper */}
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Verification Workflow Stepper
        </h2>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          <div className={`p-2 rounded-lg border ${step >= 1 ? "bg-primary/10 border-primary text-primary font-bold" : "bg-muted border-border text-muted-foreground"}`}>
            1. Flagged by Screening
          </div>
          <div className={`p-2 rounded-lg border ${step >= 2 ? "bg-primary/10 border-primary text-primary font-bold" : "bg-muted border-border text-muted-foreground"}`}>
            2. Field Staff Assigned
          </div>
          <div className={`p-2 rounded-lg border ${step >= 3 ? "bg-primary/10 border-primary text-primary font-bold" : "bg-muted border-border text-muted-foreground"}`}>
            3. Ground Visit Done
          </div>
          <div className={`p-2 rounded-lg border ${step >= 4 ? "bg-primary/10 border-primary text-primary font-bold" : "bg-muted border-border text-muted-foreground"}`}>
            4. Ruling Confirmed / Cleared
          </div>
        </div>
      </div>

      {/* Main Grid: Details + Ground Evidence Capture Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Parcel Record & Discrepancy Context (6 cols) */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              <span>Official 7/12 Extract Summary</span>
            </h3>

            <div className="rounded-lg bg-muted/40 p-3.5 border border-border/50 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Class of Land:</span>
                <span className="font-semibold text-foreground">{parcel.recordClassification}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registered Area:</span>
                <span className="font-mono text-foreground">{parcel.areaHectares} Hectares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned Officer:</span>
                <span className="text-foreground">{parcel.assignedOfficer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span className="font-mono text-amber-700 dark:text-amber-400">{parcel.dueDate}</span>
              </div>
            </div>

            {/* Satellite Discrepancy */}
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-600" />
                Satellite Screening Detection
              </span>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {parcel.satelliteFinding}
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                {parcel.fieldNotes}
              </p>
            </div>

            {/* Ownership Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                Historical Ownership Timeline
              </h4>
              <div className="space-y-2">
                {parcel.ownershipChain.map((node, i) => (
                  <div key={i} className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-foreground">{node.owner}</span>
                      <span className="font-mono text-muted-foreground">{node.year}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {node.event} · Share: {node.share}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Field-Verification Evidence Capture Form (6 cols) */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                <span>Field Evidence Capture &amp; Resolution</span>
              </h3>
              <HonestyBadge type="LIVE" />
            </div>

            {/* 1. Photo Capture */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>1. Geotagged Ground Photo</span>
                {photoUploaded && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Photo Attached
                  </span>
                )}
              </label>
              <div className="border-2 border-dashed border-border/70 rounded-xl p-4 text-center bg-muted/20 hover:bg-muted/30 transition-colors">
                {photoUploaded ? (
                  <div className="space-y-2">
                    <div className="inline-block p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      IMG_20261004_1423_SURVEY142.jpg (Geotagged 20.2458° N, 74.1523° E)
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setPhotoUploaded(false)}
                    >
                      Replace Photo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Upload ground photograph showing parcel boundary and standing structure
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setPhotoUploaded(true)}
                    >
                      <Camera className="h-3.5 w-3.5 mr-1 text-primary" />
                      Capture / Upload Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. GPS Lock */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>2. GPS Coordinates Lock</span>
                {gpsLocked && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> GPS Fixed (Accuracy: ±2.4m)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={gpsLocked ? `${parcel.lat.toFixed(4)}° N, ${parcel.lng.toFixed(4)}° E` : "GPS uncalibrated"}
                  className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-mono text-foreground"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs shrink-0"
                  onClick={() => setGpsLocked(true)}
                >
                  <Compass className="h-3.5 w-3.5 mr-1 text-primary" />
                  Auto-Lock GPS
                </Button>
              </div>
            </div>

            {/* 3. Lawful Exception Justification */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                3. Lawful Exception / Policy Exemption Reason (if applicable)
              </label>
              <select
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
              >
                <option value="">-- Select lawful exception reason --</option>
                <option value="Agribusiness Policy 2020 Sec 14(b) - Permitted Post-Harvest Storage">
                  Agribusiness Policy 2020 Sec 14(b) - Permitted Post-Harvest Packhouse/Cold Storage
                </option>
                <option value="Solar Agricultural Feeder Substation under PM-KUSUM">
                  Solar Agricultural Feeder Substation under PM-KUSUM Component C
                </option>
                <option value="Deemed NA Conversion under Ease of Doing Business 2023">
                  Deemed Non-Agricultural (NA) conversion sanctioned by District Collector
                </option>
                <option value="Traditional Farmhouse / Cattle Shed within permissible 10% FSI">
                  Traditional Farmhouse / Cattle Shed within permissible agricultural FSI
                </option>
                <option value="No Lawful Exception: Unsanctioned Commercial Conversion">
                  No Lawful Exception: Unsanctioned Commercial Conversion (Violation Confirmed)
                </option>
              </select>
            </div>

            {/* 4. Officer Inspection Notes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                4. Field Inspector Summary Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter field observation findings, farmer statement, and verification ruling recommendation..."
                className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Ruling Submission Actions */}
            <div className="pt-3 border-t border-border/40 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleUpdateStatus(3, "Visited")}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Mark Ground Visited
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleUpdateStatus(4, "Confirmed")}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                  Confirm Discrepancy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(4, "False alarm")}
                  className="text-xs text-emerald-700 hover:text-emerald-800"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Clear as Lawful Exception
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AiDisclaimerFooter />
    </div>
  );
}
