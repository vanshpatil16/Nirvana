import React from "react";
import { AlertCircle, CheckCircle, Cpu, Database, Sparkles } from "lucide-react";

export type ProvenanceType = "SYNTHETIC" | "DEMO" | "MODELLED" | "LIVE";

interface HonestyBadgeProps {
  type: ProvenanceType;
  className?: string;
  size?: "sm" | "md";
}

export function HonestyBadge({ type, className = "", size = "sm" }: HonestyBadgeProps) {
  const configs: Record<ProvenanceType, { label: string; icon: typeof Database; style: string }> = {
    SYNTHETIC: {
      label: "SYNTHETIC",
      icon: Cpu,
      style: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25",
    },
    DEMO: {
      label: "DEMO",
      icon: Sparkles,
      style: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
    },
    MODELLED: {
      label: "MODELLED",
      icon: AlertCircle,
      style: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
    },
    LIVE: {
      label: "LIVE",
      icon: CheckCircle,
      style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    },
  };

  const conf = configs[type];
  const Icon = conf.icon;
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-bold tracking-wider rounded border ${conf.style} ${padding} ${className}`}
      title={`Data provenance class: ${type}`}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span>{conf.label}</span>
    </span>
  );
}

export function ScreeningSignalLabel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md font-medium ${className}`}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>Screening signal: requires field verification. Not a legal ruling.</span>
    </div>
  );
}

export function AiDisclaimerFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`py-4 text-center text-xs text-muted-foreground border-t border-border/40 mt-8 ${className}`}>
      <p className="flex items-center justify-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
        AI supports analysis; the decision-maker decides.
      </p>
    </footer>
  );
}
