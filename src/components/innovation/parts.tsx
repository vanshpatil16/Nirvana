import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

/**
 * Small presentational primitives shared by the Innovation Portal screens.
 * Deliberately CSS-class driven (see styles.css) to match the editorial visual
 * language of the rest of NIRVANA rather than the default shadcard look.
 */

/** A labelled tag chip. `tone` drives the border/background treatment. */
export function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "blue" | "gold" | "red";
}) {
  return <span className={`inno-chip ${tone}`}>{children}</span>;
}

/**
 * Status pill. Deadline urgency is encoded with tone so red stays reserved for
 * warnings and genuinely urgent deadlines, per the visual system.
 */
export function StatusPill({ status, daysLeft }: { status: string; daysLeft?: number }) {
  const tone =
    daysLeft !== undefined && daysLeft <= 30
      ? "red"
      : status === "Open" || status === "Applications open"
        ? "green"
        : status === "Closing soon"
          ? "gold"
          : "blue";
  const label = daysLeft !== undefined && daysLeft <= 30 ? `Closing · ${daysLeft}d left` : status;
  return <span className={`inno-status ${tone}`}>{label}</span>;
}

/** A section heading with optional description and trailing action. */
export function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="inno-section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Labelled figure used in fact grids and the innovation pulse. */
export function Stat({
  value,
  label,
  note,
  icon,
}: {
  value: React.ReactNode;
  label: string;
  note?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="inno-stat">
      {icon && <span className="inno-stat-icon">{icon}</span>}
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
        {note && <em>{note}</em>}
      </div>
    </div>
  );
}

/** A definition-list row pair, used for challenge facts. */
export function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="inno-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Explicit "this is demo data" marker required by the spec's trust rule. */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="inno-demo-note">
      <span>Demo</span>
      {children}
    </p>
  );
}

/** Empty state used when a filter or module has no records. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="inno-empty" role="status">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

/** Member avatar chip with a deterministic accent derived from the id. */
export function Avatar({ initials, title }: { initials: string; title: string }) {
  const hue = Array.from(title).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
  return (
    <span
      className="inno-avatar"
      title={title}
      aria-label={title}
      style={{ background: `oklch(0.62 0.09 ${hue})` }}
    >
      {initials}
    </span>
  );
}

/** A clickable source reference that preserves the citation verbatim. */
export function Citation({ children }: { children: React.ReactNode }) {
  return <code className="inno-citation">{children}</code>;
}

/** Inline link to a challenge brief. */
export function ChallengeLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link
      to="/innovation/challenges/$challengeId"
      params={{ challengeId: id }}
      className="inno-inline-link"
    >
      {children}
      <ArrowUpRight />
    </Link>
  );
}
