import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Download,
  FileText,
  FlaskConical,
  Gauge,
  Info,
  LineChart,
  Map as MapIcon,
  Play,
  RotateCcw,
  ScrollText,
  ShieldQuestion,
  Table2,
  Target,
  Upload,
} from "lucide-react";
import {
  GEOGRAPHIES,
  LATEST_YEAR,
  POLICIES,
  applyPreset,
  policyById,
  registerDraft,
  runSimulation,
  scenarioPresetsFor,
  validateConfig,
  type DraftMeta,
  type LandCategoryId,
  type ParamValue,
  type ParamValues,
  type Policy,
  type SimulationResult,
} from "@/data/policySimulation";
import { compact, listSentence, pluralise } from "../lab-helpers";
import { EvidencePanel, EvaluationBasisPanel } from "../parts/Evidence";
import { LandCategoryPicker, ParameterForm, ParameterSummary } from "../parts/ParameterForm";
import { PolicyUpload } from "../parts/PolicyUpload";
import { PolicyOverview, ScopeStrip } from "../parts/PolicyOverview";
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
import { Empty, ValidationPanel } from "../parts/States";

export function NewPolicyView({ onToast }: { onToast?: (message: string) => void }) {
  /** Where the parameters come from: a library instrument, or a PDF the user read in. */
  const [source, setSource] = useState<"library" | "upload">("library");
  const [policyId, setPolicyId] = useState(POLICIES[0]?.id ?? "");
  // `null` means "as the instrument states it" — the policy's declared defaults,
  // which are the figures read out of the document. Any other id is a scenario
  // that deliberately departs from the instrument.
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [geographyIds, setGeographyIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<LandCategoryId[]>([]);
  const [params, setParams] = useState<ParamValues>({});
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const policy = policyById(policyId);

  // re-initialise whenever the template changes
  useEffect(() => {
    if (!policy) return;
    setPresetId(null);
    setParams(applyPreset(policy.parameters, null));
    setGeographyIds(policy.targetGeographyIds.slice());
    setCategories(policy.defaultLandCategories.slice());
    setName(`${policy.shortName} — draft scenario`);
    setObjective(policy.objective);
    setResult(null);
  }, [policy]);

  const adoptDraft = (draft: Policy, meta: DraftMeta) => {
    // Register before selecting, so the effect above can resolve it by id.
    registerDraft(draft);
    setDraftMeta(meta);
    setSource("upload");
    setPolicyId(draft.id);
  };

  const loadPreset = (id: string | null) => {
    if (!policy) return;
    setPresetId(id);
    setParams(applyPreset(policy.parameters, id));
    setResult(null);
  };

  const config = useMemo(
    () =>
      policy
        ? {
            kind: "new" as const,
            policyId: policy.id,
            windowId: policy.windows[0]?.id ?? "",
            scenarioName: name.trim() || "Untitled scenario",
            objective: objective.trim() || policy.objective,
            geographyIds,
            landCategories: categories,
            parameters: params,
            seed: Date.now() % 100000,
          }
        : null,
    [policy, name, objective, geographyIds, categories, params],
  );

  const issues = useMemo(() => (config ? validateConfig(config) : []), [config]);
  const canRun = !!policy && !issues.length && geographyIds.length > 0 && categories.length > 0;

  const run = () => {
    if (!config || issues.length) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // The engine is synchronous, so the result is ready on the same tick. Any
    // staged progress here would be narration of work that has already finished.
    setResult(runSimulation(config));
    onToast?.("Scenario evaluated");
  };

  const setParam = (id: string, value: ParamValue) => {
    setParams((prev) => ({ ...prev, [id]: value }));
    if (result) {
      setResult(null);
    }
  };

  if (!policy) {
    return (
      <Empty title="No policy template available">
        The prototype dataset contains no policy templates to build a scenario from.
      </Empty>
    );
  }

  const presets = scenarioPresetsFor(policy);
  const allowedCategories = policy.defaultLandCategories;
  const areaKm2 = geographyIds.reduce(
    (s, id) => s + (GEOGRAPHIES.find((g) => g.id === id)?.areaKm2 ?? 0),
    0,
  );
  const population = geographyIds.reduce(
    (s, id) => s + (GEOGRAPHIES.find((g) => g.id === id)?.population ?? 0),
    0,
  );

  return (
    <div className="pl-view">
      <div className="pl-section-head">
        <div>
          <span className="pl-eyebrow">
            <FlaskConical />
            New policy evaluation
          </span>
          <h2>Simulate a hypothetical policy</h2>
          <p>
            Start from an instrument in the library, or upload a policy PDF and have its provisions
            read out for you. Every value below is recalculated by the engine — there are no
            pre-written outcomes.
          </p>
        </div>
      </div>

      <div className="pl-source">
        <button
          className={source === "library" ? "on" : ""}
          onClick={() => {
            setSource("library");
            setDraftMeta(null);
            if (!POLICIES.find((p) => p.id === policyId)) setPolicyId(POLICIES[0]?.id ?? "");
          }}
        >
          <ScrollText />
          <span>
            <b>From the library</b>
            <small>Pick an instrument already catalogued here</small>
          </span>
        </button>
        <button className={source === "upload" ? "on" : ""} onClick={() => setSource("upload")}>
          <Upload />
          <span>
            <b>Upload a policy PDF</b>
            <small>Read an instrument that is not in the library</small>
          </span>
        </button>
      </div>

      {source === "upload" && !draftMeta && (
        <div className="pl-section">
          <PolicyUpload onDraft={adoptDraft} onToast={onToast} />
        </div>
      )}

      {source === "upload" && draftMeta && (
        <div className="pl-note" style={{ marginBottom: 16 }}>
          <Info />
          <div>
            <b>Draft read from {draftMeta.sourceFile}</b>
            <p style={{ margin: "4px 0 0" }}>
              {draftMeta.acceptedCount} provision
              {draftMeta.acceptedCount === 1 ? "" : "s"} accepted, each carrying its clause and
              quoted text. This draft lasts until you reload the page.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
            <DownloadDraft policy={policy} />
            <button className="pl-btn sm ghost" onClick={() => setDraftMeta(null)}>
              Read another
            </button>
          </div>
        </div>
      )}

      <ScopeStrip policy={policy} geographies={geographyIds} categories={categories} />

      <div className="pl-section">
        <div className="pl-two" style={{ gridTemplateColumns: "minmax(0, 1fr) 360px" }}>
          <div ref={formRef}>
            <div className="pl-card pl-panel">
              <div className="pl-panel-head">
                <span>
                  <ScrollText
                    style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px" }}
                  />
                  Scenario configuration
                </span>
                <select
                  value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}
                  style={{
                    border: "1px solid var(--pl-line-strong)",
                    borderRadius: 8,
                    background: "#fff",
                    padding: "6px 9px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {POLICIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName} — {p.domain}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pl-form">
                <div className="pl-field">
                  <label htmlFor="pl-scenario-name">
                    Policy name
                    <b>{name.length}/80</b>
                  </label>
                  <input
                    id="pl-scenario-name"
                    type="text"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name this hypothetical policy"
                  />
                  <span className="pl-help">
                    Free text. Used as the scenario label in results and exports.
                  </span>
                </div>
                <div className="pl-field">
                  <label htmlFor="pl-scenario-objective">
                    Objective
                    <b>{objective.length}/240</b>
                  </label>
                  <textarea
                    id="pl-scenario-objective"
                    maxLength={240}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  />
                  <span className="pl-help">
                    What this policy is meant to achieve. Shown in the scenario summary.
                  </span>
                </div>
              </div>

              <div className="pl-group">
                <h5>
                  <Target />
                  Scenario
                </h5>
                <div className="pl-multiselect">
                  <button
                    className={`pl-chip ${presetId === null ? "on" : ""}`}
                    onClick={() => loadPreset(null)}
                  >
                    As notified
                  </button>
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      className={`pl-chip ${presetId === p.id ? "on" : ""}`}
                      title={p.description}
                      onClick={() => loadPreset(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="pl-help">
                  {presetId === null
                    ? "As notified — every figure below is the one the instrument itself states. Change any value and the evidence column marks it as your assumption instead."
                    : (presets.find((p) => p.id === presetId)?.description ??
                      "Choose a scenario to load a set of parameter values.")}
                </p>
                {presetId === null && (
                  <p className="pl-help">
                    <CheckCircle2 style={{ width: 13, height: 13, verticalAlign: "-2px" }} /> The
                    other options are scenarios that deliberately depart from the instrument — they
                    are not claims about what the statute says.
                  </p>
                )}
              </div>

              <div className="pl-group">
                <h5>
                  <MapIcon />
                  Target geography
                </h5>
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
                        onClick={() => {
                          setGeographyIds((prev) =>
                            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                          );
                          setResult(null);
                        }}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
                <p className="pl-help">
                  {pluralise(geographyIds.length, "unit")} selected · {compact(areaKm2)} km² ·{" "}
                  {compact(population)} residents (mock). Each unit's development pressure index
                  scales every rule in the model.
                </p>
              </div>

              <div className="pl-group">
                <h5>
                  <Gauge />
                  Target land category
                </h5>
                <LandCategoryPicker
                  selected={categories}
                  onChange={(ids) => {
                    setCategories(ids);
                    setResult(null);
                  }}
                  options={allowedCategories}
                />
              </div>
            </div>

            <div className="pl-card pl-panel">
              <div className="pl-panel-head">
                <span>Policy parameters</span>
                <button
                  className="pl-btn sm ghost"
                  onClick={() => loadPreset(presetId)}
                  disabled={!presetId}
                >
                  <RotateCcw />
                  Reset to preset
                </button>
              </div>
              <ParameterForm policy={policy} values={params} issues={issues} onChange={setParam} />
            </div>

            <div style={{ marginTop: 16 }}>
              <ValidationPanel
                issues={issues}
                onJump={(id) => {
                  const el = document.getElementById(`pl-param-${id}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  el?.focus?.();
                }}
              />
            </div>

            <div
              style={{
                position: "sticky",
                bottom: 16,
                zIndex: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                marginTop: 16,
                border: "1px solid var(--pl-line)",
                borderRadius: 12,
                background: "color-mix(in oklab, #fff 92%, transparent)",
                padding: "12px 14px",
                boxShadow: "var(--pl-shadow-lift)",
                backdropFilter: "blur(10px)",
              }}
            >
              <button className="pl-btn primary" onClick={run} disabled={!canRun}>
                <Play />
                Run simulation
              </button>
              <button className="pl-btn ghost" onClick={() => loadPreset(null)}>
                Reset to as notified
              </button>
              <span className="pl-help" style={{ marginLeft: "auto" }}>
                Baseline year {LATEST_YEAR} · 5-year projection
              </span>
            </div>
          </div>

          <aside className="pl-summary">
            <div className="pl-card pl-panel">
              <div className="pl-panel-head">
                <span>Run preview</span>
              </div>
              <dl className="pl-kv">
                <div>
                  <dt>Template</dt>
                  <dd>{policy.shortName}</dd>
                </div>
                <div>
                  <dt>Units</dt>
                  <dd>{pluralise(geographyIds.length, "unit")}</dd>
                </div>
                <div>
                  <dt>Area</dt>
                  <dd>{compact(areaKm2)} km²</dd>
                </div>
                <div>
                  <dt>Land classes</dt>
                  <dd>{listSentence(categories, 3)}</dd>
                </div>
                <div>
                  <dt>Baseline year</dt>
                  <dd>{LATEST_YEAR}</dd>
                </div>
                <div>
                  <dt>Indicators</dt>
                  <dd>{policy.indicators.length}</dd>
                </div>
                <div>
                  <dt>Validation</dt>
                  <dd>
                    {issues.length ? (
                      <span className="pl-tag red">{pluralise(issues.length, "issue")}</span>
                    ) : (
                      <span className="pl-tag">Ready</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <ParameterSummary
              tone="plain"
              items={policy.parameters.map((p) => {
                const raw = params[p.id] ?? p.default;
                const value =
                  p.control === "toggle"
                    ? raw
                      ? "Enabled"
                      : "Disabled"
                    : p.control === "select"
                      ? (p.options?.find((o) => o.value === raw)?.label ?? String(raw))
                      : `${Number(raw).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${
                          p.unit ? ` ${p.unit}` : ""
                        }`;
                return { id: p.id, label: p.label, value };
              })}
            />
          </aside>
        </div>
      </div>

      {result && (
        <>
          <div className="pl-section">
            <EvaluationBasisPanel
              basis={result.assumptions.basis}
              kind="new"
              weakCount={result.weakEvidenceCount}
            />
          </div>

          <div className="pl-section">
            <ScenarioSummary result={result} />
          </div>

          <div className="pl-section">
            <SectionHead icon={Target} eyebrow="Headline" title="Simulation results">
              Current values are observed mock data. Simulated values are calculated by the engine
              from the parameters above.
            </SectionHead>
            <KpiCards result={result} />
          </div>

          <div className="pl-section">
            <SectionHead icon={LineChart} eyebrow="Comparison" title="Charts">
              Every chart below is derived from the result object and redraws on each run.
            </SectionHead>
            <ComparisonCharts result={result} />
          </div>

          <div className="pl-section">
            <SectionHead icon={MapIcon} eyebrow="Spatial" title="Simulated impact map">
              Colours come from this run’s result, not from a pre-drawn scenario layer.
            </SectionHead>
            <MapSection result={result} />
          </div>

          <div className="pl-section">
            <SectionHead icon={Table2} eyebrow="Breakdown" title="Indicator breakdown">
              Current vs simulated, with the dataset each figure is attributed to.
            </SectionHead>
            <div className="pl-card pl-panel">
              <IndicatorTable result={result} />
            </div>
            <div className="pl-card pl-panel">
              <div className="pl-panel-head">
                <span>Land-use reallocation</span>
              </div>
              <LandMixTable result={result} />
            </div>
          </div>

          <div className="pl-section">
            <SectionHead icon={BookOpen} eyebrow="Provenance" title="Evidence">
              Each figure below traces to a clause in the source document, or is marked as your own
              assumption.
            </SectionHead>
            <EvidencePanel rows={result.evidence} weakCount={result.weakEvidenceCount} />
          </div>

          <div className="pl-section">
            <SectionHead icon={ShieldQuestion} eyebrow="Method" title="Assumptions">
              Exactly what the engine assumed in producing these numbers.
            </SectionHead>
            <AssumptionsPanel result={result} />
          </div>

          <div className="pl-section">
            <SectionHead icon={FileText} eyebrow="Provenance" title="Data sources">
              Mock provenance metadata — the prototype does not call any live service.
            </SectionHead>
            <DataSourcesPanel result={result} />
          </div>

          <div className="pl-section">
            <PolicyOverview
              policy={policy}
              selectedGeographies={geographyIds}
              selectedCategories={categories}
            />
          </div>

          <div className="pl-section">
            <Empty
              icon={CalendarRange}
              title="Want to compare against a real instrument?"
              action={
                <a className="pl-btn" href="/policy-lab?mode=existing">
                  Open existing policy evaluation
                  <ArrowRight />
                </a>
              }
              compact
            >
              The existing-policy mode compares two observed windows around a real implementation
              date. This mode is entirely hypothetical.
            </Empty>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Downloads a draft policy as JSON.
 *
 * The app has no backend, so an uploaded policy cannot be persisted. Handing the
 * user the object means a draft they have reviewed can be moved into
 * `library/` and become a permanent entry rather than vanishing on reload.
 */
function DownloadDraft({ policy }: { policy: Policy | undefined }) {
  if (!policy || policy.origin !== "uploaded") return null;
  const onClick = () => {
    const blob = new Blob([JSON.stringify(policy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${policy.id.replace(/^uploaded-/, "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button className="pl-btn sm ghost" onClick={onClick}>
      <Download />
      Download draft
    </button>
  );
}
