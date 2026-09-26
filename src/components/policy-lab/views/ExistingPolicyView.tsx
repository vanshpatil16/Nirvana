import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  FileText,
  Info,
  LineChart,
  Map as MapIcon,
  ScrollText,
  Search,
  ShieldQuestion,
  Table2,
  Target,
  X,
} from "lucide-react";
import {
  GEOGRAPHIES,
  POLICIES,
  citationCount,
  runSimulation,
  type Policy,
  type SimulationResult,
} from "@/data/policySimulation";
import { BASE_YEAR as DATA_FROM, LATEST_YEAR as DATA_TO } from "@/data/policySimulation/observations";
import { dateLabel, listSentence, pluralise } from "../lab-helpers";
import { EvidencePanel, EvaluationBasisPanel } from "../parts/Evidence";
import {
  AssumptionsPanel,
  ComparisonCharts,
  DataSourcesPanel,
  IndicatorTable,
  KpiCards,
  LandMixTable,
  MapSection,
  ScenarioSummary,
  SectionHead,
} from "../parts/Results";
import { PrototypeTag } from "../parts/States";

/**
 * Existing policy evaluation — one screen, one button.
 *
 * The previous version walked a four-step strip in which "Policy overview" and
 * "Evaluation period" were rendered on the same screen anyway, so the strip
 * described a process the user never actually experienced. This version puts
 * the choice and the configuration on one screen and keeps a single primary
 * action — Evaluate policy — that hands over to the results dashboard. Coming
 * back is one click.
 */

type Stage = "pick" | "results";

export function ExistingPolicyView() {
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [geographyIds, setGeographyIds] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>("pick");
  const [result, setResult] = useState<SimulationResult | null>(null);

  const policy = policyId ? (POLICIES.find((p) => p.id === policyId) ?? null) : null;

  useEffect(() => {
    if (!policy) {
      setWindowId(null);
      setGeographyIds([]);
      setResult(null);
      return;
    }
    setWindowId(policy.windows[0]?.id ?? null);
    setGeographyIds(policy.targetGeographyIds.slice());
    setResult(null);
  }, [policy]);

  const config = useMemo(
    () =>
      policy && windowId && geographyIds.length
        ? {
            kind: "existing" as const,
            policyId: policy.id,
            windowId,
            scenarioName: "",
            objective: "",
            geographyIds,
            landCategories: policy.defaultLandCategories,
            parameters: {},
            seed: 1,
          }
        : null,
    [policy, windowId, geographyIds],
  );

  /** The one action. Synchronous — the engine has no network step to wait for. */
  const evaluate = () => {
    if (!config) return;
    setResult(runSimulation(config));
    setStage("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changePolicy = () => {
    setStage("pick");
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (stage === "results" && result && policy) {
    return (
      <div className="pl-view">
        <div className="pl-section-head">
          <div>
            <span className="pl-eyebrow">
              <BarChart3 />
              Evaluation result
            </span>
            <h2>{policy.name}</h2>
            <p>{policy.objective}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="pl-btn sm ghost" onClick={changePolicy}>
              <ArrowLeft />
              Change policy
            </button>
            <button className="pl-btn sm primary" onClick={evaluate}>
              Re-run
            </button>
          </div>
        </div>

        <div className="pl-section">
          <EvaluationBasisPanel
            basis={result.assumptions.basis}
            kind="existing"
            weakCount={result.weakEvidenceCount}
          />
        </div>

        <div className="pl-section">
          <ScenarioSummary result={result} />
        </div>

        <div className="pl-section">
          <SectionHead icon={Target} eyebrow="Headline" title="Impact results">
            Baseline and post-policy figures are means of the annual observations in each window.
            Every change below is a calculated difference, not an attributed effect.
          </SectionHead>
          <KpiCards result={result} />
        </div>

        <div className="pl-section">
          <SectionHead icon={LineChart} eyebrow="Trend & geography" title="Comparison charts">
            Charts update with the selected period and unit set.
          </SectionHead>
          <ComparisonCharts result={result} />
        </div>

        <div className="pl-section">
          <SectionHead icon={MapIcon} eyebrow="Spatial distribution" title="Where it moved">
            Target units are outlined; the rest are shown for context.
          </SectionHead>
          <MapSection result={result} />
        </div>

        <div className="pl-section">
          <SectionHead icon={Table2} eyebrow="Breakdown" title="Indicator-wise results">
            Each row is computed from the policy's own indicator set.
          </SectionHead>
          <div className="pl-card pl-panel">
            <IndicatorTable result={result} />
          </div>
          <div className="pl-card pl-panel">
            <div className="pl-panel-head">
              <span>Land-use composition</span>
            </div>
            <LandMixTable result={result} />
          </div>
        </div>

        <div className="pl-section">
          <SectionHead icon={BookOpen} eyebrow="Provenance" title="Evidence">
            Every figure the run depends on, with the clause and the quoted text it came from.
          </SectionHead>
          <EvidencePanel rows={result.evidence} weakCount={result.weakEvidenceCount} />
        </div>

        <div className="pl-section">
          <SectionHead icon={ShieldQuestion} eyebrow="Method" title="Assumptions & limitations">
            What the engine assumed, and what it cannot claim.
          </SectionHead>
          <AssumptionsPanel result={result} />
        </div>

        <div className="pl-section">
          <SectionHead icon={FileText} eyebrow="Provenance" title="Data sources">
            Mock metadata describing what a production run would read.
          </SectionHead>
          <DataSourcesPanel result={result} />
        </div>

        <div className="pl-section">
          <div className="pl-card pl-panel">
            <div className="pl-panel-head">
              <span>Change the evaluation</span>
            </div>
            <dl className="pl-kv">
              <div>
                <dt>Window</dt>
                <dd>
                  {result.period.label} ({result.period.from}–{result.period.to})
                </dd>
              </div>
              <div>
                <dt>Units</dt>
                <dd>{listSentence(result.geographyNames, 5)}</dd>
              </div>
            </dl>
            <button className="pl-btn primary" style={{ marginTop: 14 }} onClick={changePolicy}>
              <ArrowLeft />
              Change policy or period
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- One screen: choose the instrument, set it up, run it ---------------
  return (
    <div className="pl-view">
      <div className="pl-section-head">
        <div>
          <span className="pl-eyebrow">
            <ScrollText />
            Existing policy
          </span>
          <h2>Evaluate a policy that is already in force</h2>
          <p>
            Pick an instrument, set the period and the units, and read the before-and-after. Each
            policy carries its own citation, so you can check the clause behind any figure before
            you rely on it.
          </p>
        </div>
        <PrototypeTag label={`${pluralise(POLICIES.length, "instrument")} in the library`} />
      </div>

      <div className="pl-pick">
        <div className="pl-pick-list">
          <PolicyPicker selected={policy?.id ?? null} onSelect={setPolicyId} />
        </div>

        <div className="pl-pick-detail">
          {!policy ? (
            <div
              className="pl-card pl-panel"
              style={{ minHeight: 320, display: "grid", placeItems: "center" }}
            >
              <div style={{ textAlign: "center", maxWidth: 340 }}>
                <Search style={{ width: 26, height: 26, opacity: 0.35, marginBottom: 10 }} />
                <b style={{ display: "block", fontSize: 15, marginBottom: 6 }}>
                  Choose an instrument to begin
                </b>
                <p className="pl-help">
                  {POLICIES.length} policies are available, grouped by domain. Selecting one fills
                  in the period, the units and the parameters from the instrument itself.
                </p>
              </div>
            </div>
          ) : (
            <PolicySetup
              policy={policy}
              windowId={windowId}
              geographyIds={geographyIds}
              onWindow={setWindowId}
              onGeography={setGeographyIds}
              onEvaluate={evaluate}
              disabled={!config}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy picker
// ---------------------------------------------------------------------------

function PolicyPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<string>("All");

  const domains = useMemo(() => ["All", ...new Set(POLICIES.map((p) => p.domain))], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return POLICIES.filter((p) => {
      if (domain !== "All" && p.domain !== domain) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.shortName.toLowerCase().includes(q) ||
        p.objective.toLowerCase().includes(q) ||
        p.sourceDocument.clause.toLowerCase().includes(q)
      );
    });
  }, [query, domain]);

  const grouped = useMemo(() => {
    const map = new Map<string, Policy[]>();
    for (const p of filtered) {
      const list = map.get(p.domain) ?? [];
      list.push(p);
      map.set(p.domain, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="pl-card pl-panel">
      <div className="pl-panel-head">
        <span>Policy library</span>
        <span
          className="pl-muted"
          style={{ fontSize: 11, letterSpacing: 0, textTransform: "none" }}
        >
          {pluralise(filtered.length, "policy")}
        </span>
      </div>

      <div className="pl-search">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, objective or clause…"
          aria-label="Search the policy library"
        />
        {query && (
          <button className="pl-icon-btn" onClick={() => setQuery("")} aria-label="Clear search">
            <X />
          </button>
        )}
      </div>

      <div className="pl-multiselect" style={{ marginBottom: 12 }}>
        {domains.map((d) => (
          <button
            key={d}
            className={`pl-chip ${domain === d ? "on" : ""}`}
            onClick={() => setDomain(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="pl-scroll-box" style={{ maxHeight: 560 }}>
        {grouped.length === 0 ? (
          <p className="pl-help">No policy matches “{query}”.</p>
        ) : (
          grouped.map(([d, items]) => (
            <div key={d}>
              <div className="pl-subhead">
                <span>{d}</span>
              </div>
              {items.map((p) => (
                <button
                  key={p.id}
                  className={`pl-pick-item ${selected === p.id ? "on" : ""}`}
                  onClick={() => onSelect(p.id)}
                  aria-current={selected === p.id}
                >
                  <div className="pl-pick-item-top">
                    <b>{p.name}</b>
                    {selected === p.id && <CheckCircle2 />}
                  </div>
                  <small>
                    {p.implementationYear} · {p.sourceDocument.issuer}
                  </small>
                  <span className="pl-pick-item-foot">
                    <span className="pl-tag grey">
                      {pluralise(p.indicators.length, "indicator")}
                    </span>
                    <span className="pl-tag grey">{pluralise(citationCount(p), "citation")}</span>
                    <span className="pl-tag orange">{p.headline.value}</span>
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup + the single call to action
// ---------------------------------------------------------------------------

function PolicySetup({
  policy,
  windowId,
  geographyIds,
  onWindow,
  onGeography,
  onEvaluate,
  disabled,
}: {
  policy: Policy;
  windowId: string | null;
  geographyIds: string[];
  onWindow: (id: string) => void;
  onGeography: (ids: string[]) => void;
  onEvaluate: () => void;
  disabled: boolean;
}) {
  const window = policy.windows.find((w) => w.id === windowId);
  const notified = policy.targetGeographyIds;
  const contrast = policy.availableGeographyIds.filter((id) => !notified.includes(id));
  // True when at least one of the instrument's own windows sits inside the
  // record, so choosing a period actually changes the comparison.
  const observable = policy.windows.some((w) => w.from >= DATA_FROM && w.to <= DATA_TO);

  const toggle = (id: string) =>
    onGeography(
      geographyIds.includes(id) ? geographyIds.filter((x) => x !== id) : [...geographyIds, id],
    );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>
            <ScrollText style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
            Instrument
          </span>
          <span className="pl-tag">{policy.implementationYear}</span>
        </div>

        <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>{policy.name}</h3>
        <p className="pl-help" style={{ marginTop: 0 }}>
          {policy.objective}
        </p>

        <dl className="pl-kv" style={{ marginTop: 12 }}>
          <div>
            <dt>Clause</dt>
            <dd>{policy.sourceDocument.clause}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {policy.sourceDocument.sourceFile ? (
                <FileText
                  style={{ width: 12, height: 12, verticalAlign: "-1px", marginRight: 5 }}
                />
              ) : null}
              {policy.sourceDocument.title}
            </dd>
          </div>
          <div>
            <dt>Issuer</dt>
            <dd>{policy.sourceDocument.issuer}</dd>
          </div>
          <div>
            <dt>In force from</dt>
            <dd>{dateLabel(policy.implementationDate)}</dd>
          </div>
          <div>
            <dt>Baseline</dt>
            <dd>
              {policy.implementationYear - policy.baselineYears}–{policy.implementationYear - 1}
            </dd>
          </div>
          <div>
            <dt>Citations</dt>
            <dd>
              {pluralise(citationCount(policy), "clause and parameter")} traced to the source
              document
            </dd>
          </div>
        </dl>
      </div>

      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>
            <CalendarRange
              style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }}
            />
            Evaluation period
          </span>
        </div>
        {observable ? (
          <>
            <div className="pl-multiselect">
              {policy.windows.map((w) => (
                <button
                  key={w.id}
                  className={`pl-chip ${windowId === w.id ? "on" : ""}`}
                  onClick={() => onWindow(w.id)}
                  title={w.note}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <p className="pl-help" style={{ marginTop: 8 }}>
              {window?.note}
            </p>
          </>
        ) : (
          <>
            {/* Offering a period choice that cannot change the answer would be
                worse than saying so: this instrument's stated windows all fall
                outside the record, so there is nothing to choose between. */}
            <div className="pl-multiselect">
              <span className="pl-chip on">{DATA_FROM} – {DATA_TO}</span>
            </div>
            <p className="pl-help" style={{ marginTop: 8 }}>
              This instrument took effect in {policy.implementationYear}, before the record begins in{" "}
              {DATA_FROM}. Its own evaluation windows cannot be observed, so the whole available
              record is used and split in half. Read the result as a description of the period, not
              as an evaluation of the instrument.
            </p>
          </>
        )}
      </div>

      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>Units evaluated</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="pl-btn xs ghost"
              onClick={() => onGeography(notified.slice())}
              disabled={geographyIds.length === notified.length}
            >
              All notified
            </button>
            <button
              className="pl-btn xs ghost"
              onClick={() => onGeography([])}
              disabled={!geographyIds.length}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="pl-multiselect">
          {policy.availableGeographyIds.map((id) => {
            const g = GEOGRAPHIES.find((x) => x.id === id);
            if (!g) return null;
            const on = geographyIds.includes(id);
            return (
              <button
                key={id}
                className={`pl-chip ${on ? "on" : ""}`}
                title={g.note}
                onClick={() => toggle(id)}
              >
                {g.name}
                {notified.includes(id) && <span style={{ opacity: 0.7 }}>· notified</span>}
              </button>
            );
          })}
        </div>
        <p className="pl-help" style={{ marginTop: 8 }}>
          {pluralise(notified.length, "unit")} notified by the instrument
          {contrast.length > 0 && `, ${pluralise(contrast.length, "unit")} available as contrast`}.
          Adding an unnotified unit gives a comparison case.
        </p>
      </div>

      <div className="pl-cta">
        <button className="pl-btn primary lg" onClick={onEvaluate} disabled={disabled}>
          <BarChart3 />
          Evaluate policy
          <ArrowRight />
        </button>
        {disabled && (
          <p className="pl-help" style={{ marginTop: 8, marginBottom: 0 }}>
            Choose at least one unit and a period to continue.
          </p>
        )}
      </div>

      <div className="pl-card pl-panel">
        <div className="pl-panel-head">
          <span>
            <Info style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }} />
            What this comparison can and cannot show
          </span>
        </div>
        <ul className="pl-list">
          <li>
            Baseline and post-policy figures are means of the annual observations in each window —
            plain arithmetic, no weighting or smoothing.
          </li>
          <li>
            Nothing here isolates the instrument. A before/after difference describes what changed;
            it is not evidence of why it changed.
          </li>
          <li>
            A thin reference line continues the pre-implementation trend so the observed move can be
            read against a simple reference. It is not a counterfactual estimate.
          </li>
          <li>
            For a forward-looking test of a hypothetical instrument, use <strong>New policy</strong>{" "}
            instead.
          </li>
        </ul>
      </div>
    </div>
  );
}
