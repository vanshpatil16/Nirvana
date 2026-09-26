import {
  CalendarDays,
  Database,
  FileText,
  Layers,
  MapPin,
  ScrollText,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  GEOGRAPHIES,
  datasetOf,
  indicatorOf,
  type Geography,
  type LandCategoryId,
  type Policy,
} from "@/data/policySimulation";
import { dateLabel, listSentence, pluralise } from "../lab-helpers";
import { PrototypeTag } from "./States";

const TONE_BY_ROLE = { primary: "", secondary: "grey" } as const;

/** The full "policy overview" card: everything the spec asks to be shown. */
export function PolicyOverview({
  policy,
  selectedGeographies,
  selectedCategories,
}: {
  policy: Policy;
  selectedGeographies?: string[];
  selectedCategories?: LandCategoryId[];
}) {
  const datasets = policy.datasetIds.map(datasetOf).filter((d): d is NonNullable<typeof d> => !!d);
  const indicators = policy.indicators
    .map((ref) => ({ ref, ind: indicatorOf(ref.indicatorId) }))
    .filter(
      (x): x is { ref: (typeof policy.indicators)[number]; ind: NonNullable<typeof x.ind> } =>
        !!x.ind,
    );
  const targets = policy.targetGeographyIds
    .map((id) => GEOGRAPHIES.find((g) => g.id === id))
    .filter((g): g is Geography => !!g);
  const scope = selectedGeographies?.length
    ? GEOGRAPHIES.filter((g) => selectedGeographies.includes(g.id))
    : targets;

  return (
    <div className="pl-grid-2">
      <div className="pl-card pl-panel pl-overview">
        <div className="pl-panel-head">
          <span>Policy overview</span>
          <PrototypeTag label="Policy metadata" />
        </div>
        <dl>
          <div>
            <dt>Policy name</dt>
            <dd>
              {policy.name}
              <span className="pl-tag" style={{ marginLeft: 8 }}>
                {policy.domain}
              </span>
            </dd>
          </div>
          <div>
            <dt>Objective</dt>
            <dd>{policy.objective}</dd>
          </div>
          <div>
            <dt>Implementation date</dt>
            <dd>
              <CalendarDays
                style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }}
              />
              {dateLabel(policy.implementationDate)}
            </dd>
          </div>
          <div>
            <dt>Target area</dt>
            <dd>
              {listSentence(
                scope.map((g) => g.name),
                4,
              )}
              <small
                style={{ display: "block", marginTop: 3, color: "var(--pl-muted)", fontSize: 11 }}
              >
                {pluralise(scope.length, "unit")} ·{" "}
                {Math.round(scope.reduce((s, g) => s + g.areaKm2, 0)).toLocaleString("en-IN")} km²
              </small>
            </dd>
          </div>
          <div>
            <dt>Target land categories</dt>
            <dd>
              {listSentence(
                (selectedCategories ?? policy.defaultLandCategories).map((c) =>
                  c.replace(/-/g, " "),
                ),
                5,
              )}
            </dd>
          </div>
        </dl>
        <p className="prose">{policy.description}</p>
      </div>

      <div>
        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>Source document</span>
          </div>
          <div className="pl-doc">
            <span>
              <FileText />
            </span>
            <div>
              <b>{policy.sourceDocument.title}</b>
              <small>
                {policy.sourceDocument.issuer} · {policy.sourceDocument.year}
              </small>
              <em>{policy.sourceDocument.clause}</em>
              <small style={{ marginTop: 4 }}>Reference: {policy.sourceDocument.reference}</small>
            </div>
          </div>
        </div>

        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>Datasets required</span>
            <span className="pl-muted" style={{ fontSize: 11, letterSpacing: 0 }}>
              {pluralise(datasets.length, "source")}
            </span>
          </div>
          <div className="pl-list">
            {datasets.map((d) => (
              <li key={d.id}>
                <div>
                  <b style={{ fontSize: 12 }}>{d.name}</b>
                  <small style={{ display: "block", marginTop: 2, color: "var(--pl-muted)" }}>
                    {d.source} · {d.coverage} · {d.timePeriod}
                  </small>
                </div>
              </li>
            ))}
          </div>
        </div>

        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>Relevant indicators</span>
            <span className="pl-muted" style={{ fontSize: 11, letterSpacing: 0 }}>
              {indicators.filter((i) => i.ref.role === "primary").length} primary ·{" "}
              {indicators.filter((i) => i.ref.role === "secondary").length} secondary
            </span>
          </div>
          <ul className="pl-list">
            {indicators.map(({ ref, ind }) => (
              <li key={ind.id}>
                <div>
                  <b style={{ fontSize: 12 }}>{ind.name}</b>
                  <small style={{ display: "block", marginTop: 2, color: "var(--pl-muted)" }}>
                    {ind.unit} · {datasetOf(ind.datasetId)?.name ?? ind.datasetId}
                  </small>
                </div>
                <span className={`pl-tag ${TONE_BY_ROLE[ref.role]}`} style={{ marginLeft: "auto" }}>
                  {ref.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Compact "what this policy touches" strip used above the configuration form. */
export function ScopeStrip({
  policy,
  geographies,
  categories,
}: {
  policy: Policy;
  geographies: string[];
  categories: LandCategoryId[];
}) {
  const items = [
    { icon: MapPin, label: "Target units", value: pluralise(geographies.length, "unit") },
    {
      icon: Layers,
      label: "Land classes",
      value: pluralise(categories.length, "class", "classes"),
    },
    {
      icon: SlidersIcon,
      label: "Parameters",
      value: pluralise(policy.parameters.length, "control"),
    },
    { icon: Database, label: "Datasets", value: pluralise(policy.datasetIds.length, "source") },
    {
      icon: TrendingUp,
      label: "Indicators",
      value: pluralise(policy.indicators.length, "indicator"),
    },
  ];
  return (
    <div className="pl-metrics-5">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="pl-card pl-metric">
            <span className="pl-metric-label">
              <Icon />
              {it.label}
            </span>
            <strong>{it.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function SlidersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}
