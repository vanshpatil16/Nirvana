import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Search,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";

const MOCK_REPORTS = [
  { id:"NRV-20241028", type:"Boundary encroachment", state:"Maharashtra", district:"Pune", village:"Kharadi", khasraNo:"142/3A", submittedAt:"28 Oct 2024", status:"under_review" as const, tehsildarNote:"Field visit scheduled for 5 Nov. Satellite imagery corroborates claim.", lastUpdate:"2 Nov 2024" },
  { id:"NRV-20241015", type:"Wrong land use recorded", state:"Maharashtra", district:"Nagpur", village:"Butibori", khasraNo:"88B", submittedAt:"15 Oct 2024", status:"resolved" as const, tehsildarNote:"Mutation entry corrected. New RoR issued.", lastUpdate:"24 Oct 2024" },
  { id:"NRV-20241002", type:"Missing parcel in records", state:"Maharashtra", district:"Nashik", village:"Sinnar", khasraNo:"", submittedAt:"2 Oct 2024", status:"pending" as const, tehsildarNote:"", lastUpdate:"2 Oct 2024" },
];

const STATUS_META = {
  pending: { label:"Submitted", icon:Clock, color:"#D97706", bg:"bg-amber-500/10 border-amber-500/20 text-amber-700" },
  under_review: { label:"Under Review", icon:AlertCircle, color:"#2563EB", bg:"bg-blue-500/10 border-blue-500/20 text-blue-700" },
  resolved: { label:"Resolved", icon:CheckCircle2, color:"#16A34A", bg:"bg-green-500/10 border-green-500/20 text-green-700" },
};

export function ReportStatus() {
  const [refNo, setRefNo] = useState("");
  const [searchDone, setSearchDone] = useState(false);
  const [found, setFound] = useState<typeof MOCK_REPORTS[0] | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchDone(true);
    const match = MOCK_REPORTS.find(r => r.id.toLowerCase() === refNo.trim().toLowerCase());
    setFound(match ?? null);
  }

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Report Status</h1>
        </div>
        <p className="text-sm text-muted-foreground">Track the status of your submitted mismatch reports using your reference number.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Enter reference number (e.g. NRV-20241028)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5">
          <Search className="h-4 w-4" /> Search
        </button>
      </form>

      {searchDone && !found && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="font-medium text-sm">No report found for that reference number.</p>
          <p className="text-xs text-muted-foreground mt-1">Try NRV-20241028, NRV-20241015 or NRV-20241002 to see a sample record.</p>
        </div>
      )}

      {found && (() => {
        const meta = STATUS_META[found.status];
        const Icon = meta.icon;
        return (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="font-bold text-base">{found.id}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Submitted {found.submittedAt}</p>
              </div>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${meta.bg}`}>
                <Icon className="h-3.5 w-3.5" />{meta.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label:"Mismatch Type", value:found.type },
                { label:"State", value:found.state },
                { label:"District", value:found.district },
                { label:"Village", value:found.village },
                { label:"Khasra / Survey No.", value:found.khasraNo || "Not provided" },
                { label:"Last Update", value:found.lastUpdate },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {found.tehsildarNote && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1">Tehsildar Note</p>
                <p className="text-sm text-foreground">{found.tehsildarNote}</p>
              </div>
            )}
            {found.status === "resolved" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                <p className="text-xs text-green-700 font-medium">This report has been resolved. Check your updated RoR for the corrected entry.</p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Recent Reports (click to view)</h2>
        <div className="space-y-2">
          {MOCK_REPORTS.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <button key={r.id} onClick={() => { setRefNo(r.id); setFound(r); setSearchDone(true); }}
                className="w-full text-left rounded-xl border border-border/60 bg-card p-3.5 hover:border-primary/30 transition-all flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{r.id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.type} - {r.village}, {r.district}</p>
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${meta.bg}`}>
                  <Icon className="h-3 w-3" />{meta.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
