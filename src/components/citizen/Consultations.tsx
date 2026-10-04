import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquareText,
  Send,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
} from "lucide-react";

const CONSULTATIONS = [
  {
    id: "c1",
    title: "Draft Land Acquisition Rehabilitation Policy — Maharashtra 2024",
    status: "open",
    department: "Maharashtra Revenue Department",
    openedAt: "15 Oct 2024",
    closingAt: "30 Nov 2024",
    totalResponses: 2847,
    description: "The state proposes revising compensation norms and social impact assessment timelines. Affected landowners and community members are invited to submit feedback.",
    comments: [
      { id: "cm1", author: "Ramesh Patil", location: "Nagpur", text: "The compensation rate should reflect current market value, not the 2018 circle rate.", votes: 142, time: "3 days ago" },
      { id: "cm2", author: "Sunita Deshpande", location: "Pune", text: "Rehabilitation must include alternative agricultural land, not just cash payments.", votes: 98, time: "5 days ago" },
      { id: "cm3", author: "Agricultural Cooperative, Nashik", location: "Nashik", text: "We request a 6-month extension of the comment period to allow gram sabhas to deliberate.", votes: 211, time: "6 days ago" },
    ],
  },
  {
    id: "c2",
    title: "Urban Fringe Land Use Reclassification — Bengaluru 2024",
    status: "open",
    department: "Karnataka Revenue Department",
    openedAt: "1 Nov 2024",
    closingAt: "15 Dec 2024",
    totalResponses: 1130,
    description: "Proposed reclassification of agricultural land within 10 km of BBMP limits for mixed-use development. Citizens may oppose or support specific survey numbers.",
    comments: [
      { id: "cm4", author: "Lakshmi Narayana", location: "Anekal", text: "Reclassifying survey no. 44/A in Anekal will displace 3 families who depend on it for farming.", votes: 76, time: "1 day ago" },
    ],
  },
  {
    id: "c3",
    title: "Forest Rights Act Implementation Review — National",
    status: "closed",
    department: "Ministry of Tribal Affairs / DoLR",
    openedAt: "1 Aug 2024",
    closingAt: "15 Sep 2024",
    totalResponses: 14672,
    description: "National review of FRA implementation. Community forest rights recognition rates and pending claims were the primary topics.",
    comments: [],
  },
];

const STATUS_META = {
  open: { label: "Open", className: "bg-green-500/10 text-green-700 border-green-500/20" },
  closed: { label: "Closed", className: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  review: { label: "Under Review", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
};

export function Consultations() {
  const [expanded, setExpanded] = useState<string | null>("c1");
  const [commentDraft, setCommentDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (commentDraft.trim().length < 10) return;
    setSubmitted(true);
    setCommentDraft("");
  }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Public Consultations</h1>
        </div>
        <p className="text-sm text-muted-foreground">Participate in open public consultations on land policy, legislation, and proposed changes. Your voice matters.</p>
      </div>

      {submitted && (
        <div className="mb-4 rounded-xl border border-green-500/25 bg-green-500/5 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">Your comment has been submitted. Thank you for participating!</p>
          <button onClick={() => setSubmitted(false)} className="ml-auto text-xs text-green-700 underline">Dismiss</button>
        </div>
      )}

      <div className="space-y-4">
        {CONSULTATIONS.map((c) => {
          const meta = STATUS_META[c.status as keyof typeof STATUS_META];
          const isOpen = expanded === c.id;
          return (
            <div key={c.id} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={() => setExpanded(isOpen ? null : c.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${meta.className}`}>{meta.label}</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Closes {c.closingAt}</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {c.totalResponses.toLocaleString()} responses</span>
                  </div>
                  <p className="font-semibold text-sm leading-snug">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.department}</p>
                </div>
                <div className="shrink-0 text-muted-foreground">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
              </button>

              {isOpen && (
                <div className="border-t border-border/50 px-5 pb-5">
                  <p className="text-sm text-muted-foreground mt-4 mb-4 leading-relaxed">{c.description}</p>

                  {c.comments.length > 0 && (
                    <div className="space-y-3 mb-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Community Comments</p>
                      {c.comments.map((cm) => (
                        <div key={cm.id} className="rounded-lg border border-border/50 bg-muted/30 p-3.5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div>
                              <span className="font-semibold text-xs">{cm.author}</span>
                              <span className="text-[11px] text-muted-foreground ml-2">{cm.location} · {cm.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <button className="flex items-center gap-1 hover:text-green-700 transition-colors"><ThumbsUp className="h-3 w-3" />{cm.votes}</button>
                              <button className="flex items-center gap-1 hover:text-red-700 transition-colors"><ThumbsDown className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <p className="text-sm leading-relaxed">{cm.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {c.status === "open" ? (
                    <form onSubmit={handleComment} className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Add Your Comment</p>
                      <textarea value={commentDraft} onChange={e => setCommentDraft(e.target.value)} rows={3}
                        placeholder="Share your view on this consultation..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                      <button type="submit" disabled={commentDraft.trim().length < 10}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                        <Send className="h-3.5 w-3.5" /> Submit Comment
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-500/20 bg-slate-500/5 px-3 py-2">
                      <XCircle className="h-4 w-4 text-slate-500" />
                      <p className="text-xs text-slate-600">This consultation is closed. Comments are no longer accepted.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
