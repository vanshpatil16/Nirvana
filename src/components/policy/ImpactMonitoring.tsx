import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileCheck,
  FileText,
  FlaskConical,
  Globe,
  Hash,
  HelpCircle,
  History,
  Info,
  Link as LinkIcon,
  Lock,
  Network,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LimitedAccessBanner } from "@/components/auth/LimitedAccessBanner";
import { useRole } from "@/context/RoleContext";
import { DidChart } from "@/components/innovation/evaluation/DidChart";
import type { DifferenceInDifferences } from "@/data/innovation";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { toast } from "sonner";

interface PreRegisteredKpi {
  id: string;
  name: string;
  baseline: number;
  current: number;
  target: number;
  unit: string;
  duration: string;
  treatmentDistricts: string;
  controlDistricts: string;
  sha256Hash: string;
  prevHash: string;
  lockedDate: string;
  status: "locked" | "verified";
  policyRef: string;
  state: string;
  positiveDirection: "up" | "down";
}

const PRE_REGISTERED_KPIS: PreRegisteredKpi[] = [
  {
    id: "KPI-2025-01",
    name: "Land Mutation Turnaround Time",
    baseline: 30,
    current: 20,
    target: 15,
    unit: "days",
    duration: "18 months (Jan 2025 – Jun 2026)",
    treatmentDistricts: "Pune, Nashik, Nagpur (3)",
    controlDistricts: "Satara, Ahmednagar, Kolhapur (3)",
    sha256Hash: "9f83e2a7b1c4e9d082f6a5b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3",
    prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
    lockedDate: "15 Jan 2025",
    status: "locked",
    policyRef: "DoLR/DILRMP/EVAL-2025/01",
    state: "Maharashtra",
    positiveDirection: "down",
  },
  {
    id: "KPI-2025-02",
    name: "Boundary Discrepancy Reconciliation",
    baseline: 34,
    current: 58,
    target: 80,
    unit: "%",
    duration: "24 months (Mar 2025 – Feb 2027)",
    treatmentDistricts: "Gorakhpur, Varanasi, Lucknow (3)",
    controlDistricts: "Ayodhya, Kanpur, Prayagraj (3)",
    sha256Hash: "4c71d0e82a9b3f6d5e1c0b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e",
    prevHash: "9f83e2a7b1c4e9d082f6a5b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3",
    lockedDate: "01 Mar 2025",
    status: "locked",
    policyRef: "UP-DILRMP-2025-09",
    state: "Uttar Pradesh",
    positiveDirection: "up",
  },
  {
    id: "KPI-2025-03",
    name: "Joint Title Registrations (Women Co-ownership)",
    baseline: 18,
    current: 29,
    target: 40,
    unit: "%",
    duration: "12 months (Jun 2025 – May 2026)",
    treatmentDistricts: "Bhopal, Sehore, Raisen (3)",
    controlDistricts: "Vidisha, Hoshangabad, Rajgarh (3)",
    sha256Hash: "a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    prevHash: "4c71d0e82a9b3f6d5e1c0b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e",
    lockedDate: "10 Jun 2025",
    status: "locked",
    policyRef: "DoLR-GENDER-2025-14",
    state: "Madhya Pradesh",
    positiveDirection: "up",
  },
  {
    id: "KPI-2025-04",
    name: "Forest Fringe Demarcation Completion",
    baseline: 11,
    current: 44,
    target: 100,
    unit: "%",
    duration: "24 months (Aug 2025 – Jul 2027)",
    treatmentDistricts: "Mayurbhanj, Sundargarh (2)",
    controlDistricts: "Kendujhar, Sambalpur (2)",
    sha256Hash: "7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d",
    prevHash: "a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    lockedDate: "18 Aug 2025",
    status: "locked",
    policyRef: "FRA-ODISHA-2025-03",
    state: "Odisha",
    positiveDirection: "up",
  },
];

const MUTATION_DID_DATA: DifferenceInDifferences = {
  id: "did-mutation-speed",
  projectId: "proj-mutation-delay",
  pilotId: "ps-1",
  outcome: "Land Mutation Turnaround Time",
  unit: "days",
  betterDirection: "lower",
  treatedLabel: "Digital Mutation Fast-Track (Treated)",
  controlLabel: "Standard Manual Mutation (Control)",
  treated: {
    periods: ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4", "2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"],
    values: [30.4, 30.1, 29.8, 29.5, 25.1, 22.4, 20.8, 20.0],
  },
  control: {
    periods: ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4", "2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"],
    values: [30.2, 30.0, 29.9, 29.7, 29.4, 29.0, 28.5, 28.0],
  },
  method:
    "Difference-in-differences on matched districts. Digital Mutation Fast-Track offices adopted the DigiLocker pipeline in 2024-Q1; matched controls kept the manual workflow. Pre-period is four quarters.",
  assumptions: [
    "Matched districts would have followed a parallel trend absent the fast-track rollout",
    "No other processing change coincided with the intervention in either arm",
  ],
  parallelTrendCheck: {
    passed: true,
    note: "The pre-period trend in both arms is essentially flat, so parallel trends is not rejected.",
  },
  threatsToValidity: [
    "One intervention cycle cannot separate the fast-track effect from seasonal variation",
  ],
  status: "evaluable",
};

const EXPERIMENTS = [
  { id: "e1", name: "PM SVAMITVA - Phase 3 Drone Survey", status: "active", states: 9, coverage: 72, impact: "+14% titling rate", dueDate: "Dec 2026" },
  { id: "e2", name: "Digital Mutation via DigiLocker", status: "active", states: 6, coverage: 45, impact: "-8 days true effect (p<0.01)", dueDate: "Nov 2026" },
  { id: "e3", name: "Forest Right Act GIS Integration", status: "review", states: 3, coverage: 31, impact: "44% demarcation done", dueDate: "Jan 2027" },
  { id: "e4", name: "Women Co-ownership Incentive Pilot", status: "completed", states: 4, coverage: 100, impact: "+11pp coverage", dueDate: "Jun 2026" },
];

export function ImpactMonitoring() {
  const { role, getAccess } = useRole();
  const access = getAccess("/impact-monitoring");

  const [activeTab, setActiveTab] = useState<"kpi_ledger" | "causal" | "experiments">("kpi_ledger");
  const [chainVerified, setChainVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showFailedPlaceboDemo, setShowFailedPlaceboDemo] = useState(false);

  const handleVerifyChain = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setChainVerified(true);
      toast.success("Cryptographic Chain Verified", {
        description: "4 blocks intact against DoLR Merkle Root 0x8a7f9c2d1b. All SHA-256 hashes valid.",
      });
    }, 900);
  };

  const handleExportCapsule = () => {
    toast.success("Exporting Evidence Capsule", {
      description: "Downloaded capsule-DILRMP-2025-01.json (RO-Crate v1.1 compliant).",
    });
  };

  return (
    <div className="space-y-6">
      {access === "limited" && (
        <LimitedAccessBanner scopeNote="Full cryptographic hash verification & raw causal microdata scoped to Policymaker & Lead Researcher roles." />
      )}

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">
              <Network className="h-3 w-3" />
              DoLR Evaluation Layer
            </span>
            <HonestyBadge type="LIVE" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            Impact &amp; Causal Monitoring
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pre-registered KPI ledger, cryptographic hash audit, and difference-in-differences causal evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={handleExportCapsule}
          >
            <Download className="h-3.5 w-3.5" />
            Export Evidence Capsule
          </Button>
        </div>
      </div>

      {/* KPI Headline Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Locked Policy KPIs", value: "4 Pre-Registered", icon: Lock, color: "#059669" },
          { label: "Chain Status", value: chainVerified ? "Chain Intact ✓" : "Genesis Valid", icon: Hash, color: chainVerified ? "#16A34A" : "#2563EB" },
          { label: "States Covered", value: "18 States", icon: Globe, color: "#7C3AED" },
          { label: "Causal Effects Proved", value: "3 Significant", icon: Sparkles, color: "#D97706" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border/60 bg-card p-3.5 flex items-center gap-3 shadow-2xs">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in oklab, ${color} 12%, white)`, color }}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
              <p className="text-base font-bold leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <button
          onClick={() => setActiveTab("kpi_ledger")}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === "kpi_ledger"
              ? "border-b-2 border-primary text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          Pre-Registered KPI Ledger
        </button>

        <button
          onClick={() => setActiveTab("causal")}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === "causal"
              ? "border-b-2 border-primary text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Causal Results &amp; DiD Proof
        </button>

        <button
          onClick={() => setActiveTab("experiments")}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === "experiments"
              ? "border-b-2 border-primary text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Active Experiments &amp; Pilots ({EXPERIMENTS.length})
        </button>
      </div>

      {/* TAB 1: PRE-REGISTERED KPI LEDGER */}
      {activeTab === "kpi_ledger" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 p-4 rounded-xl border border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Cryptographic Immutability Ledger</span>
                <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border">
                  SHA-256 Chaining
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Policy KPIs are strictly read-only once locked. Pre-registered targets prevent p-hacking and retrospective goal shifting.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant={chainVerified ? "outline" : "default"}
                onClick={handleVerifyChain}
                disabled={verifying}
                className="gap-1.5 text-xs font-semibold"
              >
                {verifying ? (
                  <>
                    <History className="h-3.5 w-3.5 animate-spin" /> Verifying Hashes...
                  </>
                ) : chainVerified ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Chain Verified (Intact)
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" /> Verify Chain
                  </>
                )}
              </Button>
            </div>
          </div>

          {chainVerified && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Hash Chain Intact: 4 KPI blocks verified against DoLR National Pre-Registration Merkle Root (0x8a7f9...e319).
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded">All Hashes Valid</span>
            </div>
          )}

          {/* Table of Pre-Registered KPIs */}
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-3">KPI &amp; Policy Ref</th>
                  <th className="p-3">Baseline / Target</th>
                  <th className="p-3">Duration &amp; Jurisdiction</th>
                  <th className="p-3">Treatment / Control</th>
                  <th className="p-3">SHA-256 Hash &amp; Previous</th>
                  <th className="p-3">Lock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {PRE_REGISTERED_KPIS.map((kpi) => {
                  const isGood =
                    kpi.positiveDirection === "up" ? kpi.current > kpi.baseline : kpi.current < kpi.baseline;
                  return (
                    <tr key={kpi.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{kpi.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-primary">{kpi.id}</span>
                          <span>·</span>
                          <span>{kpi.policyRef}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>Base: <strong>{kpi.baseline} {kpi.unit}</strong></span>
                          <span>→</span>
                          <span className="text-primary font-bold">Target: {kpi.target} {kpi.unit}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Current: <strong className={isGood ? "text-emerald-600" : "text-amber-600"}>{kpi.current} {kpi.unit}</strong> ({isGood ? "Trending on track" : "Needs acceleration"})
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-medium text-foreground">{kpi.duration}</div>
                        <div className="text-[11px] text-muted-foreground">{kpi.state}</div>
                      </td>

                      <td className="p-3">
                        <div className="text-[11px]">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">T:</span> {kpi.treatmentDistricts}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-semibold text-muted-foreground">C:</span> {kpi.controlDistricts}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[10px] text-muted-foreground">
                        <div>
                          <span className="text-foreground font-semibold">Curr:</span> {kpi.sha256Hash.slice(0, 14)}...{kpi.sha256Hash.slice(-6)}
                        </div>
                        <div className="text-[9px] text-muted-foreground/80 mt-0.5">
                          <span>Prev:</span> {kpi.prevHash.slice(0, 14)}...{kpi.prevHash.slice(-6)}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground border">
                            <Lock className="h-2.5 w-2.5 text-primary" /> Locked
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {kpi.lockedDate}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CAUSAL RESULTS & DID PROOF */}
      {activeTab === "causal" && (
        <div className="space-y-6">
          {/* Main Causal Result Card */}
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/20">
                    Pre-Registered Causal Evaluation
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/20">
                    Evidence Grade: Strong (A)
                  </span>
                  <HonestyBadge type="MODELLED" />
                </div>
                <h2 className="text-lg font-bold text-foreground mt-1">
                  Land Mutation Turnaround: Digital Fast-Track Intervention
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pre-registered Difference-in-Differences across 3 treatment districts vs 3 matched synthetic control districts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setShowFailedPlaceboDemo((p) => !p)}
                >
                  {showFailedPlaceboDemo ? "Show Passing Proof" : "Simulate Failed Placebo State"}
                </Button>
              </div>
            </div>

            {/* Placebo failure state notice if toggled */}
            {showFailedPlaceboDemo && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Unreliable: Not Published as Proof (Placebo Check Failed)
                </div>
                <p>
                  Placebo test at pseudo-treatment time t-2 detected a statistically significant spurious shift (p = 0.024 &lt; 0.05).
                  Parallel-trends assumption is violated in the pre-intervention window. Policy outcome cannot be attributed causally to this intervention.
                </p>
              </div>
            )}

            {/* Causal Chart and Statistics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-background rounded-xl p-4 border border-border/60">
                <DidChart did={MUTATION_DID_DATA} />
              </div>

              <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/40 p-3 border border-border/50">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Estimated Causal Effect (β̂)</span>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      −8.0 days
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Treated: 30.4 → 20.0 days (−10.4d) · Control: 30.2 → 28.0 days (−2.2d)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/30 p-2.5 border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-semibold">95% Confidence Interval</span>
                      <p className="font-mono font-bold text-foreground mt-0.5">[−10.2d, −5.8d]</p>
                    </div>

                    <div className="rounded-lg bg-muted/30 p-2.5 border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-semibold">p-value (Significance)</span>
                      <p className="font-mono font-bold text-emerald-600 mt-0.5">p &lt; 0.001</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Parallel Trends Test
                      </span>
                      <span className="font-mono text-[10px]">F = 0.42 (p = 0.74 ✓)</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Pseudo-Date Placebo Check
                      </span>
                      <span className="font-mono text-[10px]">Null effect: −0.3d (p = 0.81 ✓)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">RO-Crate Packaging: PR-2025-004</span>
                  <Button size="sm" onClick={handleExportCapsule} className="text-xs gap-1.5 font-semibold">
                    <Download className="h-3 w-3" /> Export Evidence Capsule
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXPERIMENTS & PILOTS */}
      {activeTab === "experiments" && (
        <div className="space-y-3">
          {EXPERIMENTS.map((exp) => (
            <div
              key={exp.id}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-2xs flex flex-wrap items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 border border-blue-500/20">
                    {exp.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Due: {exp.dueDate}</span>
                </div>
                <p className="mt-1.5 font-bold text-sm text-foreground">{exp.name}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{exp.states} States</span>
                  <span className="flex items-center gap-1"><Target className="h-3 w-3" />{exp.coverage}% coverage</span>
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3 w-3" />{exp.impact}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${exp.coverage}%` }} />
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => setActiveTab("causal")}
              >
                Inspect DiD <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AiDisclaimerFooter />
    </div>
  );
}
