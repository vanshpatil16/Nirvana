import { Ban, CheckCircle2, Gift, Gauge, Map, Percent, type LucideIcon } from "lucide-react";
import {
  GEOGRAPHIES,
  LAND_CATEGORY_LIST,
  type LandCategoryId,
  type ParamValue,
  type ParamValues,
  type Policy,
  type PolicyParameter,
  type ValidationIssue,
} from "@/data/policySimulation";
import { compact, num, pluralise } from "../lab-helpers";

const GROUP_META: Record<PolicyParameter["group"], { label: string; icon: LucideIcon }> = {
  scope: { label: "Scope", icon: Map },
  restriction: { label: "Restrictions", icon: Ban },
  threshold: { label: "Thresholds", icon: Percent },
  incentive: { label: "Incentives", icon: Gift },
  intensity: { label: "Scenario intensity", icon: Gauge },
};

const GROUP_ORDER: PolicyParameter["group"][] = [
  "scope",
  "restriction",
  "threshold",
  "incentive",
  "intensity",
];

const display = (p: PolicyParameter, v: ParamValue): string => {
  switch (p.control) {
    case "toggle":
      return v ? "On" : "Off";
    case "multi-select":
      return Array.isArray(v) ? pluralise(v.length, "unit") : "None";
    default:
      return num(Number(v ?? 0), p.step && p.step < 1 ? 2 : p.step && p.step > 1 ? 0 : 1);
  }
};

/** One data-driven control. The same component renders every parameter type. */
function Control({
  param,
  value,
  issue,
  onChange,
}: {
  param: PolicyParameter;
  value: ParamValue;
  issue?: ValidationIssue | undefined;
  onChange: (v: ParamValue) => void;
}) {
  const id = `pl-param-${param.id}`;
  const invalid = !!issue;
  const unit = param.unit ? ` ${param.unit}` : "";

  if (param.control === "toggle") {
    const on = value === true;
    return (
      <button
        type="button"
        id={id}
        className={`pl-switch ${on ? "on" : ""}`}
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
      >
        <span>
          <b>{param.label}</b>
          <small>{param.help}</small>
        </span>
        <i aria-hidden="true" />
      </button>
    );
  }

  if (param.control === "multi-select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className={`pl-field ${invalid ? "invalid" : ""}`} id={id}>
        <span className="pl-field-label">
          {param.label}
          <b>{pluralise(selected.length, "selected")}</b>
        </span>
        <div className="pl-multiselect">
          {GEOGRAPHIES.map((g) => {
            const on = selected.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                className={`pl-chip ${on ? "on" : ""}`}
                onClick={() =>
                  onChange(on ? selected.filter((x) => x !== g.id) : [...selected, g.id])
                }
              >
                {on && <CheckCircle2 />}
                {g.name}
              </button>
            );
          })}
        </div>
        <span className="pl-help">{param.help}</span>
        {issue && <span className="pl-error">{issue.message}</span>}
      </div>
    );
  }

  if (param.control === "select") {
    return (
      <div className={`pl-field ${invalid ? "invalid" : ""}`}>
        <label htmlFor={id}>{param.label}</label>
        <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {(param.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pl-help">{param.help}</span>
        {issue && <span className="pl-error">{issue.message}</span>}
      </div>
    );
  }

  if (param.control === "textarea") {
    return (
      <div className={`pl-field ${invalid ? "invalid" : ""}`}>
        <label htmlFor={id}>{param.label}</label>
        <textarea id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        <span className="pl-help">{param.help}</span>
      </div>
    );
  }

  if (param.control === "text") {
    return (
      <div className={`pl-field ${invalid ? "invalid" : ""}`}>
        <label htmlFor={id}>{param.label}</label>
        <input
          id={id}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="pl-help">{param.help}</span>
      </div>
    );
  }

  // slider & number share the same numeric contract
  const n = Number(value ?? 0);
  const lo = param.min ?? 0;
  const hi = param.max ?? 100;
  return (
    <div className={`pl-field ${invalid ? "invalid" : ""}`}>
      {param.control === "slider" ? (
        <>
          <label htmlFor={id}>
            {param.label}
            <b>
              {display(param, value)}
              {unit}
            </b>
          </label>
          <input
            id={id}
            type="range"
            min={lo}
            max={hi}
            step={param.step ?? 1}
            value={n}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <div className="pl-scale">
            <span>
              {num(lo, 0)} {param.unit ?? ""}
            </span>
            <span>
              {num(hi, 0)} {param.unit ?? ""}
            </span>
          </div>
        </>
      ) : (
        <>
          <label htmlFor={id}>
            {param.label}
            <b>
              {display(param, value)}
              {unit}
            </b>
          </label>
          <input
            id={id}
            type="number"
            min={lo}
            max={hi}
            step={param.step ?? 1}
            value={n}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="pl-help">
            Allowed range {num(lo, 0)} – {num(hi, 0)} {param.unit ?? ""}
          </span>
        </>
      )}
      {param.control === "slider" && <span className="pl-help">{param.help}</span>}
      {issue && <span className="pl-error">{issue.message}</span>}
    </div>
  );
}

/**
 * Renders every parameter a policy declares, grouped by category. Adding a
 * parameter to the policy object is the only change needed to surface it here.
 */
export function ParameterForm({
  policy,
  values,
  issues,
  onChange,
}: {
  policy: Policy;
  values: ParamValues;
  issues: ValidationIssue[];
  onChange: (id: string, value: ParamValue) => void;
}) {
  const byGroup = GROUP_ORDER.map((g) => ({
    group: g,
    items: policy.parameters.filter((p) => p.group === g),
  })).filter((g) => g.items.length);

  if (!byGroup.length) {
    return <p className="pl-muted">This template declares no adjustable parameters.</p>;
  }

  return (
    <div className="pl-form">
      {byGroup.map(({ group, items }) => {
        const meta = GROUP_META[group];
        const Icon = meta.icon;
        return (
          <section key={group} className="pl-group">
            <h5>
              <Icon />
              {meta.label}
            </h5>
            <div className="pl-form">
              {items.map((p) => (
                <Control
                  key={p.id}
                  param={p}
                  value={values[p.id] ?? p.default}
                  issue={issues.find((i) => i.parameterId === p.id)}
                  onChange={(v) => onChange(p.id, v)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Land-category picker — also fully data-driven. */
export function LandCategoryPicker({
  selected,
  onChange,
  options,
}: {
  selected: LandCategoryId[];
  onChange: (ids: LandCategoryId[]) => void;
  options: LandCategoryId[];
}) {
  const shown = LAND_CATEGORY_LIST.filter((c) => options.includes(c.id));
  return (
    <div className="pl-field">
      <span className="pl-field-label">
        Target land category
        <b>{pluralise(selected.length, "class", "classes")}</b>
      </span>
      <div className="pl-multiselect">
        {shown.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`pl-chip ${on ? "on" : ""}`}
              title={c.description}
              onClick={() =>
                onChange(on ? selected.filter((x) => x !== c.id) : [...selected, c.id])
              }
            >
              {on && <CheckCircle2 />}
              {c.short}
            </button>
          );
        })}
      </div>
      <span className="pl-help">
        Only categories the policy acts on are listed. A category the policy does not touch has no
        effect on the result.
      </span>
    </div>
  );
}

/** Compact read-only summary of the parameters a run used. */
export function ParameterSummary({
  items,
  tone = "card",
}: {
  items: { id: string; label: string; value: string }[];
  tone?: "card" | "plain";
}) {
  if (!items.length) return null;
  const body = (
    <dl className="pl-kv">
      {items.map((p) => (
        <div key={p.id}>
          <dt>{p.label}</dt>
          <dd>{p.value}</dd>
        </div>
      ))}
    </dl>
  );
  if (tone === "plain") return body;
  return (
    <div className="pl-card pl-panel">
      <div className="pl-panel-head">
        <span>Parameters used</span>
      </div>
      {body}
    </div>
  );
}
