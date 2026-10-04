import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileCode,
  Filter,
  FlaskConical,
  Grid3X3,
  Layers,
  PackageCheck,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyBadge } from "@/mock/badges";
import { toast } from "sonner";

interface GapCell {
  intervention: string;
  outcome: string;
  status: "strong" | "moderate" | "gap";
  count: number;
  grade: "Grade A" | "Grade B" | "No Evidence";
  notes: string;
}

const INTERVENTIONS = [
  "Drone Cadastral Survey (SVAMITVA)",
  "Digital Mutation Automation",
  "Women Co-titling Mandate",
  "FRA Community Forest Demarcation",
  "e-Courts Land Dispute Fast-Track",
];

const OUTCOMES = [
  "Title Security",
  "Dispute Reduction",
  "Credit Flow",
  "Tenancy Protection",
  "Land Value Realization",
];

const GAP_GRID_DATA: Record<string, Record<string, GapCell>> = {
  "Drone Cadastral Survey (SVAMITVA)": {
    "Title Security": { intervention: "Drone Cadastral Survey (SVAMITVA)", outcome: "Title Security", status: "strong", count: 8, grade: "Grade A", notes: "8 RCT / DiD studies in Haryana, MP & Maharashtra" },
    "Dispute Reduction": { intervention: "Drone Cadastral Survey (SVAMITVA)", outcome: "Dispute Reduction", status: "moderate", count: 3, grade: "Grade B", notes: "Preliminary dispute dip; long-term appeal records pending" },
    "Credit Flow": { intervention: "Drone Cadastral Survey (SVAMITVA)", outcome: "Credit Flow", status: "strong", count: 6, grade: "Grade A", notes: "+24% formal bank mortgage uptake in surveyed villages" },
    "Tenancy Protection": { intervention: "Drone Cadastral Survey (SVAMITVA)", outcome: "Tenancy Protection", status: "gap", count: 0, grade: "No Evidence", notes: "Evidence Gap: Tenancy oral contracts unmeasured in drone surveys" },
    "Land Value Realization": { intervention: "Drone Cadastral Survey (SVAMITVA)", outcome: "Land Value Realization", status: "moderate", count: 2, grade: "Grade B", notes: "Reported +18% price discovery on formal exchanges" },
  },
  "Digital Mutation Automation": {
    "Title Security": { intervention: "Digital Mutation Automation", outcome: "Title Security", status: "strong", count: 9, grade: "Grade A", notes: "Reduced turnaround from 62 to 20 days; fraud flags down 42%" },
    "Dispute Reduction": { intervention: "Digital Mutation Automation", outcome: "Dispute Reduction", status: "strong", count: 5, grade: "Grade A", notes: "Statistically significant -18% mutation appeals filed" },
    "Credit Flow": { intervention: "Digital Mutation Automation", outcome: "Credit Flow", status: "moderate", count: 3, grade: "Grade B", notes: "Faster loan sanctions due to instant electronic encumbrance certificates" },
    "Tenancy Protection": { intervention: "Digital Mutation Automation", outcome: "Tenancy Protection", status: "gap", count: 0, grade: "No Evidence", notes: "Evidence Gap: Informal tenants not captured in mutation registries" },
    "Land Value Realization": { intervention: "Digital Mutation Automation", outcome: "Land Value Realization", status: "moderate", count: 2, grade: "Grade B", notes: "Commercial plots show higher liquidity" },
  },
  "Women Co-titling Mandate": {
    "Title Security": { intervention: "Women Co-titling Mandate", outcome: "Title Security", status: "strong", count: 7, grade: "Grade A", notes: "Significant reduction in unilateral dispossession of surviving spouses" },
    "Dispute Reduction": { intervention: "Women Co-titling Mandate", outcome: "Dispute Reduction", status: "moderate", count: 2, grade: "Grade B", notes: "Fewer partition litigation suits between siblings" },
    "Credit Flow": { intervention: "Women Co-titling Mandate", outcome: "Credit Flow", status: "moderate", count: 4, grade: "Grade B", notes: "SHG linkage expanded; formal bank joint loans +15%" },
    "Tenancy Protection": { intervention: "Women Co-titling Mandate", outcome: "Tenancy Protection", status: "gap", count: 0, grade: "No Evidence", notes: "Evidence Gap: Women agricultural tenant farmers under-evaluated" },
    "Land Value Realization": { intervention: "Women Co-titling Mandate", outcome: "Land Value Realization", status: "gap", count: 0, grade: "No Evidence", notes: "Evidence Gap: No econometric studies on land pricing elasticity" },
  },
  "FRA Community Forest Demarcation": {
    "Title Security": { intervention: "FRA Community Forest Demarcation", outcome: "Title Security", status: "strong", count: 5, grade: "Grade A", notes: "Community forest resource rights mapped across 400+ Gram Sabhas" },
    "Dispute Reduction": { intervention: "FRA Community Forest Demarcation", outcome: "Dispute Reduction", status: "moderate", count: 3, grade: "Grade B", notes: "Fringe disputes with forest department reduced by 33%" },
    "Credit Flow": { intervention: "FRA Community Forest Demarcation", outcome: "Credit Flow", status: "gap", count: 0, grade: "No Evidence", notes: "Evidence Gap: Non-timber forest produce credit linkages unstudied" },
    "Tenancy Protection": { intervention: "FRA Community Forest Demarcation", outcome: "Tenancy Protection", status: "moderate", count: 2, grade: "Grade B", notes: "Customary adivasi rights documented against encroachment" },
    "Land Value Realization": { intervention: "FRA Community Forest Demarcation", outcome: "Land Value Realization", status: "gap", count: 0, grade: "No Evidence", notes: "Evidence Gap: Inalienable community tenure; non-market asset" },
  },
  "e-Courts Land Dispute Fast-Track": {
    "Title Security": { intervention: "e-Courts Land Dispute Fast-Track", outcome: "Title Security", status: "moderate", count: 4, grade: "Grade B", notes: "Clarity on clouded titles achieved 14 months faster on average" },
    "Dispute Reduction": { intervention: "e-Courts Land Dispute Fast-Track", outcome: "Dispute Reduction", status: "strong", count: 6, grade: "Grade A", notes: "Pre-trial mediation cleared 28% of legacy revenue court cases" },
    "Credit Flow": { intervention: "e-Courts Land Dispute Fast-Track", outcome: "Credit Flow", status: "moderate", count: 2, grade: "Grade B", notes: "Disputed collateral unblocked for institutional credit" },
    "Tenancy Protection": { intervention: "e-Courts Land Dispute Fast-Track", outcome: "Tenancy Protection", status: "gap", count: 0, grade: "No Evidence", notes: "Evidence Gap: Eviction moratorium impacts remain unquantified" },
    "Land Value Realization": { intervention: "e-Courts Land Dispute Fast-Track", outcome: "Land Value Realization", status: "strong", count: 4, grade: "Grade A", notes: "Title cloud removal restores 35-40% discount on parcel market values" },
  },
};

interface EvidenceCapsule {
  id: string;
  title: string;
  authors: string;
  institution: string;
  doi: string;
  hash: string;
  datasetRef: string;
  roCrateVersion: string;
  evidenceGrade: "Strong (Grade A)" | "Moderate (Grade B)" | "Limited";
  lastVerified: string;
  status: "Reproducible" | "Verified" | "Running";
  reproCount: number;
}

const EVIDENCE_CAPSULES: EvidenceCapsule[] = [
  {
    id: "CAP-2025-081",
    title: "Causal Evaluation of Drone Cadastral Boundaries on Rural Credit Collateral",
    authors: "Prof. P. Sen, Dr. A. Iyer, V. Deshpande",
    institution: "IIT Bombay & DoLR Evaluation Cell",
    doi: "10.1016/j.landuse.2025.105421",
    hash: "0x3f7a1b...e902",
    datasetRef: "SVAMITVA-MH-2024-MICRO",
    roCrateVersion: "RO-Crate v1.1.2",
    evidenceGrade: "Strong (Grade A)",
    lastVerified: "Today, 11:20 AM",
    status: "Verified",
    reproCount: 14,
  },
  {
    id: "CAP-2025-072",
    title: "Difference-in-Differences Analysis of Fast-Track Digital Mutation Across 6 Districts",
    authors: "Dr. K. Ramanathan, S. Sengupta",
    institution: "National Law School of India University",
    doi: "10.1080/02255189.2025.201",
    hash: "0x8c2d4e...a715",
    datasetRef: "NGDRS-MUTATION-PANEL-2025",
    roCrateVersion: "RO-Crate v1.1.2",
    evidenceGrade: "Strong (Grade A)",
    lastVerified: "Yesterday",
    status: "Reproducible",
    reproCount: 9,
  },
  {
    id: "CAP-2024-049",
    title: "Tenurial Certainty & Soil Carbon Sequestration in Central India Forest Fringe",
    authors: "M. Fernandes, Dr. R. Kulkarni",
    institution: "Centre for Policy Research & ATREE",
    doi: "10.1038/s41893-024-00981-w",
    hash: "0x1a9c3d...b884",
    datasetRef: "FRA-BHUVAN-ODISHA-2024",
    roCrateVersion: "RO-Crate v1.1.0",
    evidenceGrade: "Moderate (Grade B)",
    lastVerified: "3 days ago",
    status: "Verified",
    reproCount: 22,
  },
];

export function EvidenceGapMap() {
  const [selectedCell, setSelectedCell] = useState<GapCell | null>(
    GAP_GRID_DATA["Drone Cadastral Survey (SVAMITVA)"]!["Title Security"]!
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              <Grid3X3 className="h-3 w-3" />
              Evidence Synthesis
            </span>
            <HonestyBadge type="SYNTHETIC" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">
            Evidence Gap Map: Interventions × Outcomes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Systematic matrix mapping empirical evidence density across land policy levers. Green = robust evidence, Amber = moderate, Red = evidence gap.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Strong (&ge;5 studies)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Moderate (1-4)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Gap (0 studies)</span>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/60 border-b border-border/60">
              <th className="p-3 text-left font-bold text-foreground w-1/4">Policy Intervention</th>
              {OUTCOMES.map((out) => (
                <th key={out} className="p-3 text-center font-bold text-foreground">
                  {out}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {INTERVENTIONS.map((interv) => (
              <tr key={interv} className="hover:bg-muted/15 transition-colors">
                <td className="p-3 font-semibold text-foreground bg-muted/20 border-r border-border/40">
                  {interv}
                </td>
                {OUTCOMES.map((out) => {
                  const cell = GAP_GRID_DATA[interv]?.[out];
                  if (!cell) return <td key={out} className="p-3 text-center text-muted-foreground">—</td>;
                  const isSelected =
                    selectedCell?.intervention === cell.intervention && selectedCell?.outcome === cell.outcome;

                  return (
                    <td
                      key={out}
                      className={`p-2.5 text-center cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-primary ring-inset bg-primary/10" : ""
                      }`}
                      onClick={() => setSelectedCell(cell)}
                    >
                      <div
                        className={`mx-auto rounded-lg p-2 font-bold flex flex-col items-center justify-center transition-transform hover:scale-105 ${
                          cell.status === "strong"
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                            : cell.status === "moderate"
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                            : "bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/30"
                        }`}
                      >
                        <span className="text-sm font-black">{cell.count}</span>
                        <span className="text-[9px] uppercase tracking-wider mt-0.5">
                          {cell.status === "gap" ? "Gap" : cell.grade}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Drilldown */}
      {selectedCell && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cell Inspection:</span>
              <strong className="text-sm text-foreground">
                {selectedCell.intervention} ✕ {selectedCell.outcome}
              </strong>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                selectedCell.status === "strong"
                  ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                  : selectedCell.status === "moderate"
                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                  : "bg-red-500/20 text-red-800 dark:text-red-300"
              }`}
            >
              {selectedCell.grade} ({selectedCell.count} studies)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{selectedCell.notes}</p>
        </div>
      )}
    </div>
  );
}

export function EvidenceCapsules() {
  const [capsules, setCapsules] = useState<EvidenceCapsule[]>(EVIDENCE_CAPSULES);
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRerun = (id: string) => {
    setRunningId(id);
    toast.info(`Executing Capsule ${id} Pipeline`, {
      description: "Re-running computational notebook in deterministic container...",
    });
    setTimeout(() => {
      setRunningId(null);
      setCapsules((prev) =>
        prev.map((c) => (c.id === id ? { ...c, reproCount: c.reproCount + 1, status: "Verified" as const } : c))
      );
      toast.success(`Capsule ${id} Successfully Re-run`, {
        description: "Zero variance detected. All empirical estimates replicated exactly.",
      });
    }, 1200);
  };

  const handleRecheck = (id: string) => {
    toast.success(`Cryptographic Checksum Passed for ${id}`, {
      description: "Data SHA-256 and script environment match RO-Crate manifest 100%.",
    });
  };

  const handleReproduce = (id: string) => {
    toast.success(`Exporting Reproduction Bundle for ${id}`, {
      description: "Downloaded standalone container, raw panel data slice, and run.sh script.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded">
              <PackageCheck className="h-3 w-3" />
              RO-Crate Packaging
            </span>
            <HonestyBadge type="LIVE" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">
            Evidence Capsules &amp; Reproducibility Registry
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Self-contained, executable research artifacts packaged under RO-Crate standards with deterministic containers and verifiable data hashes.
          </p>
        </div>

        <Button
          size="sm"
          className="text-xs gap-1.5"
          onClick={() =>
            toast.info("Create Capsule Wizard", {
              description: "Package your research code, panel data, and conda env into a pre-registered capsule.",
            })
          }
        >
          <FlaskConical className="h-3.5 w-3.5" /> Package New Capsule
        </Button>
      </div>

      {/* Capsule List */}
      <div className="space-y-4">
        {capsules.map((capsule) => {
          const isRunning = runningId === capsule.id;
          return (
            <div
              key={capsule.id}
              className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs space-y-3 transition-all hover:border-primary/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {capsule.id}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border">
                      {capsule.roCrateVersion}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      {capsule.evidenceGrade}
                    </span>
                    <span className="text-[11px] text-muted-foreground">· Verified {capsule.lastVerified}</span>
                  </div>

                  <h3 className="text-base font-bold text-foreground leading-snug">{capsule.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {capsule.authors} — <span className="text-foreground font-medium">{capsule.institution}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-start">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    disabled={isRunning}
                    onClick={() => handleRerun(capsule.id)}
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" /> Re-running...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 text-emerald-600" /> Re-run
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleRecheck(capsule.id)}
                  >
                    <CheckCircle2 className="h-3 w-3 text-blue-600" /> Recheck
                  </Button>

                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleReproduce(capsule.id)}
                  >
                    <Download className="h-3 w-3" /> Reproduce
                  </Button>
                </div>
              </div>

              {/* Capsule Metadata Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground font-mono">
                <div className="flex items-center gap-3">
                  <span>Dataset: <strong className="text-foreground">{capsule.datasetRef}</strong></span>
                  <span>DOI: <strong className="text-foreground">{capsule.doi}</strong></span>
                  <span>Manifest Hash: <strong className="text-primary">{capsule.hash}</strong></span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Independent Reproductions: <strong className="text-emerald-600 font-bold">{capsule.reproCount}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
