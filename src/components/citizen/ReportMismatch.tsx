import { useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Flag,
  MapPin,
  Send,
  Upload,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";

const MISMATCH_TYPES = [
  "Boundary encroachment",
  "Wrong land use recorded",
  "Missing parcel in records",
  "Incorrect owner name",
  "Title not updated after inheritance",
  "Road / water body wrongly marked",
  "Other",
];

const STATES_LIST = ["Maharashtra", "Uttar Pradesh", "Rajasthan", "Madhya Pradesh", "Karnataka", "Gujarat", "Bihar", "West Bengal", "Odisha", "Telangana"];

export function ReportMismatch() {
  const { role } = useRole();
  const [step, setStep] = useState<"form" | "success">("form");
  const [form, setForm] = useState({ state: "", district: "", village: "", khasraNo: "", mismatchType: "", description: "", contact: "" });

  const isComplete = form.state && form.district && form.village && form.mismatchType && form.description.length >= 20;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) return;
    setStep("success");
  }

  if (step === "success") {
    const refNo = `NRV-${Date.now().toString().slice(-8)}`;
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Report Submitted!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your mismatch report has been received and will be reviewed by the local Tehsildar.</p>
          <div className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Reference Number</p>
            <p className="font-bold text-lg text-primary mt-1">{refNo}</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Save this reference number to track your report status.</p>
          <button onClick={() => { setStep("form"); setForm({ state:"", district:"", village:"", khasraNo:"", mismatchType:"", description:"", contact:"" }); }}
            className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Flag className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Report a Mismatch</h1>
        </div>
        <p className="text-sm text-muted-foreground">Report a discrepancy between official land records and ground reality. Your report will be reviewed by the local Tehsildar.</p>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 flex items-start gap-3 mb-6">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">Reports are routed to the state land records portal for review by the local Tehsildar.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Location Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">State *</label>
              <select value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select state</option>
                {STATES_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">District *</label>
              <input value={form.district} onChange={e => setForm(f => ({...f, district: e.target.value}))} placeholder="e.g. Pune"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Village / Ward *</label>
              <input value={form.village} onChange={e => setForm(f => ({...f, village: e.target.value}))} placeholder="e.g. Kharadi"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Khasra / Survey No. (optional)</label>
              <input value={form.khasraNo} onChange={e => setForm(f => ({...f, khasraNo: e.target.value}))} placeholder="e.g. 142/3A"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4 text-primary" /> Mismatch Details</h2>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type of Mismatch *</label>
            <select value={form.mismatchType} onChange={e => setForm(f => ({...f, mismatchType: e.target.value}))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select mismatch type</option>
              {MISMATCH_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description * <span className="text-muted-foreground/60">(min 20 characters)</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={4}
              placeholder="Describe what you observed on the ground and how it differs from official records..."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            <p className="text-[11px] text-muted-foreground mt-1">{form.description.length} / 20 minimum characters</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Photo Evidence (optional)</label>
            <div className="mt-1 rounded-lg border-2 border-dashed border-border/60 px-4 py-5 text-center hover:border-primary/40 transition-colors cursor-pointer">
              <Camera className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Click to upload photos (JPG or PNG, up to 5)</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold">Contact (optional)</h2>
          <input value={form.contact} onChange={e => setForm(f => ({...f, contact: e.target.value}))} placeholder="Phone or email to receive updates"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <button type="submit" disabled={!isComplete}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Send className="h-4 w-4" />
          Submit Mismatch Report
        </button>
      </form>
    </div>
  );
}
