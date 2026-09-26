import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Inbox, type LucideIcon } from "lucide-react";
import type { ValidationIssue } from "@/data/policySimulation";

/** Small dashed "prototype" marker used in data-heavy areas. */
export function PrototypeTag({ label = "Prototype / simulated data" }: { label?: string }) {
  return (
    <span className="pl-prototype">
      <FlaskConical />
      {label}
    </span>
  );
}

export function Empty({
  icon: Icon = Inbox,
  title,
  children,
  action,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "pl-empty pl-compact" : "pl-empty"}>
      <Icon />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ValidationPanel({
  issues,
  onJump,
}: {
  issues: ValidationIssue[];
  onJump?: (id: string) => void;
}) {
  if (!issues.length) return null;
  return (
    <div className="pl-basis caution" role="alert">
      <AlertTriangle />
      <div style={{ minWidth: 0 }}>
        <b>
          {issues.length === 1
            ? "1 value needs attention"
            : `${issues.length} values need attention`}
        </b>
        <ul className="pl-list" style={{ marginTop: 6 }}>
          {issues.map((i) => (
            <li key={i.parameterId}>
              <button
                type="button"
                onClick={() => onJump?.(i.parameterId)}
                disabled={!onJump}
                style={{
                  cursor: onJump ? "pointer" : "default",
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  color: "inherit",
                  font: "inherit",
                  textAlign: "left",
                }}
              >
                <b>{i.label}</b> — {i.message}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="pl-toast" role="status">
      <CheckCircle2 />
      {message}
    </div>
  );
}
