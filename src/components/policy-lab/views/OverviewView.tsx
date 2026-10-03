import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Database,
  FlaskConical,
  Map as MapIcon,
  ScrollText,
  Table2,
} from "lucide-react";
import {
  DATASETS,
  GEOGRAPHIES,
  INDICATORS,
  POLICIES,
  citationCount,
  datasetByPolicy,
  indicatorByPolicy,
  unsourcedCount,
  type Policy,
} from "@/data/policySimulation";
export interface CorpusCounts {
  available?: boolean;
  acts_indexed?: number;
  provisions_indexed?: number;
  jurisdictions_indexed?: number;
  subject_count?: number;
}

import heroVideo from "@/assets/policy_home.mp4";
import { compact, listSentence, pluralise } from "../lab-helpers";
import type { LabMode } from "../PolicyLab";
import { PrototypeTag } from "../parts/States";

/** Decorative, muted loop feathered into the hero; a still frame under reduced motion. */
function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const v = ref.current;
      if (!v) return;
      if (mq.matches) v.pause();
      else void v.play().catch(() => undefined);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return (
    <div className="pl-hero-media" aria-hidden="true">
      <video
        ref={ref}
        className="pl-hero-video"
        src={heroVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        tabIndex={-1}
      />
    </div>
  );
}

/**
 * Live corpus counts for the hero.
 *
 * These replace what used to sit here: four counters taken from the simulation
 * layer (`POLICIES.length`, `citationTotal`, `INDICATORS.length`,
 * `GEOGRAPHIES.length`), which described mock instruments and nothing the user
 * could open.
 *
 * The fetch lives in PolicyLab and arrives as a prop, so the numbers are present
 * on first paint instead of flashing through as em dashes. Until they resolve the
 * slots render as an em dash rather than a plausible-looking number, because a
 * fabricated count in a hero banner is the most believable lie in a product.
 */
function CorpusStat({ value, label, live }: { value: string; label: string; live: boolean }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>
        {label}
        {live && <em className="pl-live">live</em>}
      </span>
    </div>
  );
}

export function OverviewView({
  onMode,
  corpus,
}: {
  onMode: (mode: LabMode) => void;
  corpus: CorpusCounts | null;
}) {
  const citationTotal = POLICIES.reduce((sum, p) => sum + citationCount(p), 0);

  const n = (v: number | undefined) => (v === undefined ? "—" : v.toLocaleString("en-IN"));
  const heroStats = [
    { v: n(corpus?.acts_indexed), l: "Enactments" },
    { v: n(corpus?.provisions_indexed), l: "Provisions" },
    { v: n(corpus?.jurisdictions_indexed), l: "Jurisdictions" },
    { v: n(corpus?.subject_count), l: "Subject areas" },
  ];
  return (
    <div className="pl-view">
      <div className="pl-hero">
        <div>
          <span className="pl-eyebrow">
            <FlaskConical />
            Policy Simulation Engine
          </span>
          <h1>
            Test a land policy <em>before</em> it is notified — and check what happened
            <em> after</em> one was.
          </h1>
          <p>
            Evaluate one of {POLICIES.length} real instruments against what was observed after it
            came into force, or set up a hypothetical policy and see where it would lead. Every
            parameter carries the clause it came from, so you can check the source before you rely
            on a number.
          </p>
          <div className="pl-hero-ctas">
            <button className="pl-btn primary" onClick={() => onMode("existing")}>
              <ScrollText />
              Evaluate an existing policy
            </button>
            <button className="pl-btn" onClick={() => onMode("new")}>
              <FlaskConical />
              Evaluate a new policy
            </button>
          </div>
          <div className="pl-hero-stats">
            {heroStats.map((s) => (
              <CorpusStat key={s.l} value={s.v} label={s.l} live={corpus !== null} />
            ))}
          </div>
          <p className="pl-hero-source">
            {corpus ? (
              <>
                Counted from the statutory corpus indexed in this build — parsed from India Code,
                with an official link on every provision.{" "}
                <button className="pl-link" onClick={() => onMode("statute")}>
                  Search it
                </button>
                .
              </>
            ) : (
              <>
                The statutory corpus is not installed in this build, so these counts are
                unavailable. {POLICIES.length} instruments and {citationTotal} citations below are
                prototype simulation data, not measured results.
              </>
            )}
          </p>
          <div className="pl-hero-meta">
            <PrototypeTag />
          </div>
        </div>
        <HeroVideo />
      </div>

      <div className="pl-section">
        <div className="pl-section-head">
          <div>
            <span className="pl-eyebrow">
              <ScrollText />
              Policy library
            </span>
            <h2>{pluralise(POLICIES.length, "instrument")} in this workspace</h2>
            <p>
              Each one declares its own citation, dates, parameters, indicators and evaluation
              windows. Every parameter value traces to a clause in the source document, or is
              labelled as a modelling assumption.
            </p>
          </div>
          <button className="pl-btn sm" onClick={() => onMode("existing")}>
            Open the library
            <ArrowRight />
          </button>
        </div>
        <div className="pl-grid-3">
          {POLICIES.map((p) => (
            <PolicySummaryCard key={p.id} policy={p} onOpen={() => onMode("existing")} />
          ))}
        </div>
      </div>

      <div className="pl-section">
        <div className="pl-section-head">
          <div>
            <span className="pl-eyebrow">
              <Database />
              Dataset coverage
            </span>
            <h2>What each template reads</h2>
            <p>
              Datasets are declared per policy — no template is forced to load every source, and
              unused sources are shown so the gap is visible.
            </p>
          </div>
        </div>
        <div className="pl-card pl-scroll">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Source</th>
                <th>Coverage</th>
                <th>Time period</th>
                <th>Used by</th>
              </tr>
            </thead>
            <tbody>
              {DATASETS.map((d) => {
                const used = POLICIES.filter((p) => p.datasetIds.includes(d.id));
                return (
                  <tr key={d.id}>
                    <td className="ind-name">
                      <b>{d.name}</b>
                      <small>{d.description}</small>
                    </td>
                    <td style={{ whiteSpace: "normal" }}>{d.source}</td>
                    <td style={{ whiteSpace: "normal" }}>{d.coverage}</td>
                    <td style={{ whiteSpace: "normal" }}>{d.timePeriod}</td>
                    <td>
                      {used.length ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                            justifyContent: "flex-end",
                          }}
                        >
                          {used.map((p) => (
                            <span key={p.id} className="pl-tag">
                              {p.shortName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="pl-tag grey">not yet used</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pl-section">
        <div className="pl-section-head">
          <div>
            <span className="pl-eyebrow">
              <Table2 />
              Indicator catalogue
            </span>
            <h2>{pluralise(INDICATORS.length, "indicator")} available</h2>
            <p>
              Indicators are registry entries, not per-policy constants. A policy references them by
              id and the same component renders whichever set it declares.
            </p>
          </div>
        </div>
        <div className="pl-card pl-scroll">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Dataset</th>
                <th>Direction</th>
                <th>Used by</th>
              </tr>
            </thead>
            <tbody>
              {INDICATORS.map((i) => {
                const used = POLICIES.filter((p) =>
                  p.indicators.some((r) => r.indicatorId === i.id),
                );
                return (
                  <tr key={i.id}>
                    <td className="ind-name">
                      <b>{i.name}</b>
                      <small>{i.description}</small>
                    </td>
                    <td>{i.unit}</td>
                    <td>{i.category}</td>
                    <td style={{ whiteSpace: "normal" }}>
                      {DATASETS.find((d) => d.id === i.datasetId)?.name ?? i.datasetId}
                    </td>
                    <td>
                      <span
                        className={`pl-tag ${i.trend === "up-good" ? "" : i.trend === "down-good" ? "blue" : "grey"}`}
                      >
                        {i.trend === "up-good"
                          ? "higher is better"
                          : i.trend === "down-good"
                            ? "lower is better"
                            : "neutral"}
                      </span>
                    </td>
                    <td>
                      {used.length ? (
                        listSentence(
                          used.map((p) => p.shortName),
                          2,
                        )
                      ) : (
                        <span className="pl-tag grey">available</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pl-section">
        <div className="pl-section-head">
          <div>
            <span className="pl-eyebrow">
              <MapIcon />
              Study area
            </span>
            <h2>{pluralise(GEOGRAPHIES.length, "unit")} in the prototype dataset</h2>
            <p>
              Unit boundaries are derived from a single study-region outline, so they always tile
              the area with no gaps and no hand-drawn per-scenario shapes.
            </p>
          </div>
        </div>
        <div className="pl-card pl-scroll">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Zone</th>
                <th>Area</th>
                <th>Population</th>
                <th>Pressure index</th>
                <th>Agri share</th>
                <th>Built-up share</th>
              </tr>
            </thead>
            <tbody>
              {GEOGRAPHIES.map((g) => (
                <tr key={g.id}>
                  <td className="ind-name">
                    <b>{g.name}</b>
                    <small>{g.note}</small>
                  </td>
                  <td>
                    <span className="pl-tag grey">{g.zone}</span>
                  </td>
                  <td className="num">{compact(g.areaKm2)} km²</td>
                  <td className="num">{compact(g.population)}</td>
                  <td className="num">
                    <span
                      className={`pl-tag ${g.pressure > 70 ? "red" : g.pressure > 45 ? "orange" : "grey"}`}
                    >
                      {g.pressure}
                    </span>
                  </td>
                  <td className="num">{(g.landMix.agricultural * 100).toFixed(1)}%</td>
                  <td className="num">{(g.landMix["built-up"] * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pl-section">
        <div className="pl-card pl-panel">
          <div className="pl-panel-head">
            <span>About this data</span>
            <PrototypeTag />
          </div>
          <ul className="pl-list">
            <li>
              The <strong>instrument metadata is real</strong> — titles, issuers, dates, clauses and
              the quoted text behind each parameter were read out of the source documents and are
              shown on every result. The <strong>observed values are not</strong>: they are a
              demonstration dataset and must not be cited.
            </li>
            <li>
              Where a parameter value is a modelling choice rather than something the document
              states, it is marked <span className="pl-tag orange">modelling assumption</span> and
              carries low confidence. Count them before quoting a run.
            </li>
            <li>
              Dataset names, publishers and coverage strings are metadata only. They describe what a
              production run would read; they are not evidence that any dataset was accessed.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function PolicySummaryCard({ policy, onOpen }: { policy: Policy; onOpen: () => void }) {
  const datasets = datasetByPolicy(policy);
  const indicators = indicatorByPolicy(policy);
  const cited = citationCount(policy);
  const unsourced = unsourcedCount(policy);
  return (
    <button className="pl-card pl-lift pl-policy" onClick={onOpen}>
      <div className="pl-policy-top">
        <span className="pl-tag">{policy.domain}</span>
        <span className="pl-tag grey">{policy.implementationYear}</span>
      </div>
      <h3>{policy.name}</h3>
      <p>{policy.objective}</p>
      <dl>
        <div>
          <dt>Citations</dt>
          <dd>{cited}</dd>
        </div>
        <div>
          <dt>Indicators</dt>
          <dd>
            {
              indicators.filter((i) =>
                policy.indicators.some((r) => r.indicatorId === i.id && r.role === "primary"),
              ).length
            }{" "}
            primary / {indicators.length}
          </dd>
        </div>
        <div>
          <dt>Datasets</dt>
          <dd>
            {listSentence(
              datasets.map((d) => d.name),
              2,
            )}
          </dd>
        </div>
        <div>
          <dt>Units</dt>
          <dd>
            {listSentence(
              policy.targetGeographyIds.map(
                (id) => GEOGRAPHIES.find((g) => g.id === id)?.name ?? id,
              ),
              2,
            )}
          </dd>
        </div>
      </dl>
      <div className="pl-policy-foot">
        <span className="pl-tag orange">{policy.headline.value}</span>
        {unsourced > 0 && (
          <span className="pl-tag grey" title="Parameters with no citation in the source document">
            {unsourced} assumed
          </span>
        )}
        <span className="go">
          Evaluate <ArrowRight />
        </span>
      </div>
    </button>
  );
}
