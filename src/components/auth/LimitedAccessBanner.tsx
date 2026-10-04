import { Info, ShieldAlert } from "lucide-react";

interface LimitedAccessBannerProps {
  message?: string;
  scopeNote?: string;
  className?: string;
}

export function LimitedAccessBanner({
  message = "Limited access: some data is aggregated or hidden for your role.",
  scopeNote,
  className = "",
}: LimitedAccessBannerProps) {
  return (
    <div
      className={`mx-4 sm:mx-6 my-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 backdrop-blur-sm shadow-sm ${className}`}
      role="status"
    >
      <div className="flex items-center gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="font-medium">{message}</span>
        {scopeNote && (
          <span className="hidden md:inline-block text-amber-700/80 dark:text-amber-300/80 border-l border-amber-500/20 pl-2.5">
            {scopeNote}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">
        <ShieldAlert className="h-3 w-3" />
        <span>Scoped View</span>
      </div>
    </div>
  );
}
