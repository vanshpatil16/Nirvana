import { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Lock,
  Network,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Timer,
  UserCheck,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LimitedAccessBanner } from "@/components/auth/LimitedAccessBanner";
import { useRole } from "@/context/RoleContext";
import { HonestyBadge, AiDisclaimerFooter } from "@/mock/badges";
import { toast } from "sonner";

interface DataNode {
  id: string;
  state: string;
  status: "online" | "degraded" | "offline";
  districts: number;
  parcels: string;
  lastSync: string;
  privacyBudget: number;
  privacyUsed: number;
  activeRequests: number;
  kAnonymity: number;
}

interface AccessRequest {
  id: string;
  requester: string;
  requesterType: "researcher" | "policymaker" | "innovator";
  dataset: string;
  purpose: string;
  requestedAt: string;
  urgency: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  timeLimit?: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  query: string;
  plan: string;
  kAnonymityApplied: number;
  rowsMatched: number;
  rowsSuppressed: number;
  outcome: "Served (Differential Privacy)" | "Suppressed (k < 5)" | "Blocked (No Consent)";
}

const DATA_NODES: DataNode[] = [
  { id: "mh", state: "Maharashtra (Primary State Node)", status: "online", districts: 36, parcels: "28.4M", lastSync: "1 min ago", privacyBudget: 100, privacyUsed: 34, activeRequests: 5, kAnonymity: 5 },
  { id: "up", state: "Uttar Pradesh (Simulated Node)", status: "online", districts: 75, parcels: "47.2M", lastSync: "4 min ago", privacyBudget: 100, privacyUsed: 61, activeRequests: 12, kAnonymity: 5 },
  { id: "rj", state: "Rajasthan (Simulated Node)", status: "degraded", districts: 33, parcels: "16.8M", lastSync: "18 min ago", privacyBudget: 100, privacyUsed: 22, activeRequests: 2, kAnonymity: 5 },
  { id: "mp", state: "Madhya Pradesh (Simulated Node)", status: "online", districts: 52, parcels: "22.1M", lastSync: "6 min ago", privacyBudget: 100, privacyUsed: 48, activeRequests: 7, kAnonymity: 5 },
  { id: "ka", state: "Karnataka (Simulated Node)", status: "offline", districts: 31, parcels: "14.9M", lastSync: "2 hrs ago", privacyBudget: 100, privacyUsed: 15, activeRequests: 0, kAnonymity: 5 },
];

const INITIAL_REQUESTS: AccessRequest[] = [
  { id: "REQ-001", requester: "Dr. Ananya Iyer, IISc Bangalore", requesterType: "researcher", dataset: "Tenancy records — aggregated district level", purpose: "Multi-state land fragmentation & tenancy security study", requestedAt: "Today, 09:14", urgency: "medium", status: "pending" },
  { id: "REQ-002", requester: "DoLR Policy Cell, New Delhi", requesterType: "policymaker", dataset: "Forest fringe parcel boundary overlaps", purpose: "Pre-notification GIS review for FRA claim settlement", requestedAt: "Today, 08:02", urgency: "high", status: "pending" },
  { id: "REQ-003", requester: "GreenFields Agritech Pvt. Ltd.", requesterType: "innovator", dataset: "Crop-land attribute synthetic dataset", purpose: "ML model training for crop yield & drought risk", requestedAt: "Yesterday, 17:30", urgency: "low", status: "approved", timeLimit: "30 Days" },
  { id: "REQ-004", requester: "NITI Aayog Land Cell", requesterType: "policymaker", dataset: "Urban-rural boundary transition zones", purpose: "National land use conversion trend analysis", requestedAt: "Yesterday, 11:45", urgency: "high", status: "pending" },
];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  { id: "AUD-8921", timestamp: "Today, 14:48:12", user: "Dr. Ananya Iyer", role: "Researcher", query: "SELECT count(*), avg(fragmentation_index) FROM mh_parcels GROUP BY tehsil", plan: "Federated MapReduce over 36 local district partitions", kAnonymityApplied: 5, rowsMatched: 1420, rowsSuppressed: 0, outcome: "Served (Differential Privacy)" },
  { id: "AUD-8920", timestamp: "Today, 14:22:05", user: "Field Staff Nashik", role: "Officer", query: "VERIFY_DISCREPANCY survey_no = '142' AND village = 'Vadner Bhairav'", plan: "Row-level verification token via state enclave", kAnonymityApplied: 1, rowsMatched: 1, rowsSuppressed: 0, outcome: "Served (Differential Privacy)" },
  { id: "AUD-8919", timestamp: "Today, 13:50:33", user: "CivicTech Agri Bot", role: "Innovator", query: "SELECT owner_name, contact FROM mh_parcels WHERE khasra = '88/2'", plan: "BLOCKED: PII projection forbidden for non-statutory roles", kAnonymityApplied: 5, rowsMatched: 1, rowsSuppressed: 1, outcome: "Blocked (No Consent)" },
  { id: "AUD-8918", timestamp: "Today, 12:11:40", user: "DoLR Policy Lab", role: "Policymaker", query: "AGGREGATE dispute_frequency BY taluka WHERE case_count < 5", plan: "Small cell thresholding k < 5 triggered", kAnonymityApplied: 5, rowsMatched: 4, rowsSuppressed: 4, outcome: "Suppressed (k < 5)" },
  { id: "AUD-8917", timestamp: "Today, 11:04:19", user: "State IT Admin", role: "State Owner", query: "AUDIT_NODE_HEARTBEAT target = 'mh_node_prod'", plan: "Zero-knowledge enclave health attestation", kAnonymityApplied: 5, rowsMatched: 36, rowsSuppressed: 0, outcome: "Served (Differential Privacy)" },
];

const STATUS_META = {
  online: { label: "Online", color: "#16A34A", icon: Wifi },
  degraded: { label: "Degraded", color: "#D97706", icon: ShieldAlert },
  offline: { label: "Offline", color: "#DC2626", icon: X },
};

const REQUESTER_COLORS = { researcher: "#2563EB", policymaker: "#059669", innovator: "#EA580C" };

export function FederationConsole() {
  const { getAccess } = useRole();
  const access = getAccess("/federation-console");

  const [activeTab, setActiveTab] = useState<"console" | "audit">("console");
  const [requests, setRequests] = useState<AccessRequest[]>(INITIAL_REQUESTS);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("mh");
  const [kAnonymityThreshold, setKAnonymityThreshold] = useState<number>(5);
  const [auditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [searchAudit, setSearchAudit] = useState("");

  const activeNode = DATA_NODES.find((n) => n.id === selectedNodeId) || DATA_NODES[0]!;
  const onlineCount = DATA_NODES.filter((n) => n.status === "online").length;
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const handleApprove = (id: string, timeLimit: string = "30 Days") => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "approved" as const, timeLimit } : r))
    );
    toast.success(`Access Request ${id} Approved`, {
      description: `Authorized for purpose with time-lock: ${timeLimit}. Cryptographic token issued.`,
    });
  };

  const handleReject = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r))
    );
    toast.error(`Access Request ${id} Rejected`, {
      description: "Request discarded. Requester will be notified of purpose-mismatch.",
    });
  };

  const filteredAudits = auditLogs.filter((a) => {
    if (!searchAudit) return true;
    const q = searchAudit.toLowerCase();
    return (
      a.id.toLowerCase().includes(q) ||
      a.user.toLowerCase().includes(q) ||
      a.query.toLowerCase().includes(q) ||
      a.outcome.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {access === "limited" && (
        <LimitedAccessBanner scopeNote="Node governance & privacy threshold modification restricted to verified State IT Officers." />
      )}

      {/* Strict "Raw data never leaves the state" Notice */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 dark:text-emerald-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-600 text-white">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-sm font-bold tracking-tight">
                Federated Governance: Raw Data Never Leaves The State
              </strong>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-bold uppercase">
                Privacy-Preserving
              </span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5">
              Queries run locally inside state infrastructure enclaves. Only aggregated, differentially private gradients &amp; k-anonymized answers traverse boundaries.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-600" />
            {onlineCount}/{DATA_NODES.length} Federated Nodes Active
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded">
              <Server className="h-3 w-3" />
              State IT &amp; NIC Console
            </span>
            <HonestyBadge type="LIVE" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            Federation &amp; Privacy Console
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage state data nodes, adjust k-anonymity privacy thresholds, approve row-level access tokens, and audit queries.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("console")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "console" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Node &amp; Privacy Controls
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "audit" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3 w-3" />
            Audit Log
          </button>
        </div>
      </div>

      {/* TAB 1: CONSOLE */}
      {activeTab === "console" && (
        <div className="space-y-6">
          {/* Headline Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Indexed Parcels", value: "129.4M", icon: Database, color: "#7C3AED" },
              { label: "Privacy Budget (ε=0.8)", value: "34% Used", icon: Shield, color: "#2563EB" },
              { label: "k-Anonymity Floor", value: `k = ${kAnonymityThreshold}`, icon: Sliders, color: "#059669" },
              { label: "Pending Approvals", value: `${pendingCount} Reqs`, icon: Clock, color: "#D97706" },
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

          {/* Node Grid & Privacy Configuration Split */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left 5 cols: State Data Nodes List */}
            <div className="xl:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Federated State Data Nodes
                </h2>
                <span className="text-[10px] text-muted-foreground">Click to inspect node</span>
              </div>

              <div className="space-y-2">
                {DATA_NODES.map((node) => {
                  const meta = STATUS_META[node.status];
                  const Icon = meta.icon;
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/60 bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-foreground">{node.state}</span>
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border"
                          style={{
                            background: `color-mix(in oklab, ${meta.color} 12%, white)`,
                            color: meta.color,
                            borderColor: `color-mix(in oklab, ${meta.color} 25%, transparent)`,
                          }}
                        >
                          <Icon className="h-2.5 w-2.5" /> {meta.label}
                        </span>
                      </div>

                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>{node.districts} Districts</span>
                        <span>{node.parcels} Parcels</span>
                        <span className="ml-auto text-[10px]">Sync: {node.lastSync}</span>
                      </div>

                      <div className="mt-2.5">
                        <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
                          <span>Privacy Budget Usage</span>
                          <span className="font-semibold text-foreground">{node.privacyUsed}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${node.privacyUsed}%`,
                              background:
                                node.privacyUsed > 80
                                  ? "#DC2626"
                                  : node.privacyUsed > 55
                                  ? "#D97706"
                                  : "#16A34A",
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 7 cols: Active Node Governance & Threshold Controls */}
            <div className="xl:col-span-7 space-y-5">
              {/* Node Configuration & k-Anonymity Slider */}
              <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    {activeNode.state} — Privacy Budget &amp; Enclave Control
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground">Enclave Attested ✓</span>
                </div>

                {/* k-Anonymity Control Box */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          k-Anonymity Suppression Threshold Control
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Cells with fewer than <strong className="text-primary">k = {kAnonymityThreshold}</strong> records are automatically suppressed from outbound aggregate query answers.
                      </p>
                    </div>
                    <span className="font-mono text-lg font-black text-primary bg-background px-3 py-1 rounded-lg border border-primary/30">
                      k = {kAnonymityThreshold}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={2}
                      max={20}
                      step={1}
                      value={kAnonymityThreshold}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setKAnonymityThreshold(val);
                        toast.info(`k-Anonymity threshold updated to k = ${val}`, {
                          description: `Outbound queries matching fewer than ${val} records will be suppressed.`,
                        });
                      }}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">Default: 5</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Districts Indexed", value: `${activeNode.districts} Districts` },
                    { label: "Parcels Indexed", value: activeNode.parcels },
                    { label: "Differential Privacy", value: "Laplace (ε=0.8)" },
                    { label: "Suppressed Today", value: "14 Cells (k < 5)" },
                    { label: "Active Tokens", value: `${activeNode.activeRequests} Active` },
                    { label: "Enclave Status", value: "Hardware SGX ✓" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted/40 p-2.5 border border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purpose-Bound Inbound Access Requests */}
              <div className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <h3 className="font-bold text-sm text-foreground">
                      Purpose-Bound Row-Level Access Requests
                    </h3>
                  </div>
                  {pendingCount > 0 && (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                      {pendingCount} Pending Review
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className={`rounded-xl border p-3.5 transition-all space-y-2.5 ${
                        req.status === "pending"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : req.status === "approved"
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-red-500/20 bg-red-500/5 opacity-70"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border"
                              style={{
                                background: `color-mix(in oklab, ${REQUESTER_COLORS[req.requesterType]} 12%, white)`,
                                color: REQUESTER_COLORS[req.requesterType],
                                borderColor: `color-mix(in oklab, ${REQUESTER_COLORS[req.requesterType]} 25%, transparent)`,
                              }}
                            >
                              {req.requesterType}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">{req.id}</span>
                            <span className="text-[11px] text-muted-foreground">· {req.requestedAt}</span>
                          </div>
                          <p className="font-bold text-xs text-foreground mt-1">{req.requester}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Target Dataset: <span className="font-semibold text-foreground">{req.dataset}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Declared Purpose: <span className="italic text-foreground/90">{req.purpose}</span>
                          </p>
                        </div>

                        {/* Approval actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                          {req.status === "pending" ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2 gap-1 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10"
                                onClick={() => handleApprove(req.id, "7 Days")}
                              >
                                <Timer className="h-3 w-3" /> Grant 7d
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[11px] px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleApprove(req.id, "30 Days")}
                              >
                                <Check className="h-3 w-3" /> Grant 30d
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2 gap-1 text-red-700 border-red-500/30 hover:bg-red-500/10"
                                onClick={() => handleReject(req.id)}
                              >
                                <X className="h-3 w-3" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs font-bold">
                              {req.status === "approved" ? (
                                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Approved ({req.timeLimit})
                                </span>
                              ) : (
                                <span className="text-red-700 dark:text-red-400">Rejected</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG TAB */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/60">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Immutable Execution &amp; Enclave Audit Trail
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Timestamped query plans, requester roles, k-anonymity compliance, and differential privacy outcomes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={searchAudit}
                  onChange={(e) => setSearchAudit(e.target.value)}
                  placeholder="Filter audit logs..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-background rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary w-52"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-3">Audit ID &amp; Time</th>
                  <th className="p-3">User &amp; Role</th>
                  <th className="p-3">Query Statement</th>
                  <th className="p-3">Execution Plan</th>
                  <th className="p-3">Matched / Suppressed</th>
                  <th className="p-3">Privacy Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredAudits.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono text-[11px]">
                      <div className="font-bold text-foreground">{a.id}</div>
                      <div className="text-[10px] text-muted-foreground">{a.timestamp}</div>
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-foreground">{a.user}</div>
                      <div className="text-[10px] text-primary">{a.role}</div>
                    </td>

                    <td className="p-3 font-mono text-[11px] text-foreground/90 max-w-xs truncate" title={a.query}>
                      {a.query}
                    </td>

                    <td className="p-3 text-[11px] text-muted-foreground max-w-xs truncate" title={a.plan}>
                      {a.plan}
                    </td>

                    <td className="p-3 text-[11px]">
                      <span>{a.rowsMatched} matched</span>
                      {a.rowsSuppressed > 0 && (
                        <div className="text-amber-600 font-semibold">{a.rowsSuppressed} suppressed</div>
                      )}
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.outcome.includes("Served")
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : a.outcome.includes("Suppressed")
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                        }`}
                      >
                        {a.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AiDisclaimerFooter />
    </div>
  );
}
