import { useState } from "react";
import { ArrowRight, CloudSun, FileText, FlaskConical, History, MapPin, Scale, Sparkles, Sprout, X } from "lucide-react";
import { STATE_STATS, THEMES, type StateStat, type ThemeId } from "@/data/state-intelligence";
import { LAND_CLASS_ORDER, yearShares } from "@/data/land-scenario";
import { LULC_CLASSES } from "@/components/land-difference/lulcRaster";
import { MOSAIC_YEARS } from "@/services/temporal";
import { officialPortalFor, parcelAcres } from "@/services/parcelService";
import type { MapAction, SelectionSnapshot, SimSnapshot } from "./IndiaMap";

/**
 * Right-hand slide-over shown when a place or parcel is clicked on the dashboard map.
 * Indicator values are the DEMO state snapshots (STATE_STATS); the year series are a
 * deterministic demo curve anchored on those snapshots — never official figures.
 */

interface Indicator {
  theme: ThemeId;
  label: string;
  unit: string;
  value: (s: StateStat) => number;
  format: (v: number) => string;
  /** Latest-year value × this = 2018 value (shape of the demo series) */
  startRatio: number;
}

const fmtInt = (v: number) => Math.round(v).toLocaleString("en-IN");

const INDICATORS: Indicator[] = [
  { theme: "land-use-change", label: "Land-use change", unit: "% since 2015", value: (s) => s.change, format: (v) => `+${v.toFixed(1)}%`, startRatio: 0.55 },
  { theme: "disputes", label: "Active disputes", unit: "cases", value: (s) => s.disputes, format: fmtInt, startRatio: 1.3 },
  { theme: "climate-risk", label: "High-risk districts", unit: "districts", value: (s) => s.highRiskDistricts, format: fmtInt, startRatio: 0.7 },
  { theme: "socio-economic", label: "Vulnerable households", unit: "% of households", value: (s) => s.socio, format: (v) => `${v.toFixed(1)}%`, startRatio: 1.12 },
];

const ALL_STATS = Object.entries(STATE_STATS);
const nationalAvg = (ind: Indicator) => ALL_STATS.reduce((sum, [, s]) => sum + ind.value(s), 0) / ALL_STATS.length;
const nationalMax = (ind: Indicator) => Math.max(...ALL_STATS.map(([, s]) => ind.value(s)));
const rankOf = (ind: Indicator, state: string) =>
  [...ALL_STATS].sort((a, b) => ind.value(b[1]) - ind.value(a[1])).findIndex(([n]) => n === state) + 1;

const hashUnit = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
};

// Demo year series: eases from startRatio × latest (2018) to the latest value (2024), with a gentle deterministic wobble
function series(ind: Indicator, latest: number, key: string): number[] {
  const n = MOSAIC_YEARS.length;
  const phase = hashUnit(`${key}|${ind.theme}`) * Math.PI * 2;
  return MOSAIC_YEARS.map((_, i) => {
    const t = n > 1 ? i / (n - 1) : 1;
    const wobble = i === n - 1 ? 0 : 0.04 * Math.sin(phase + i * 1.1);
    return latest * (ind.startRatio + (1 - ind.startRatio) * t) * (1 + wobble);
  });
}

const RISK_TONE: Record<string, string> = { High: "tone-high", Moderate: "tone-moderate", Low: "tone-low" };

function TrendChart({ ind, state, stat, year }: { ind: Indicator; state: string; stat: StateStat; year: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const own = series(ind, ind.value(stat), state);
  const avg = series(ind, nationalAvg(ind), "India");
  const W = 320, H = 132, padL = 34, padR = 10, padT = 12, padB = 22;
  const hi = Math.max(...own, ...avg) * 1.08;
  const x = (i: number) => padL + (i / (MOSAIC_YEARS.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / hi) * (H - padT - padB);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path(own)} L${x(own.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const sel = Math.max(0, MOSAIC_YEARS.indexOf(year));
  const focus = hover ?? sel;

  return (
    <div className="insight-chart">
      <div className="insight-legend" aria-hidden="true">
        <span><i className="swatch-line" /> {state}</span>
        <span><i className="swatch-dash" /> India average</span>
      </div>
      <div className="insight-chart-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ind.label} in ${state}, ${MOSAIC_YEARS[0]}–${MOSAIC_YEARS[MOSAIC_YEARS.length - 1]}, compared with the India average`}>
          {[0.5, 1].map((f) => (
            <g key={f}>
              <line x1={padL} x2={W - padR} y1={y(hi * f)} y2={y(hi * f)} className="grid" />
              <text x={padL - 5} y={y(hi * f) + 3} className="axis" textAnchor="end">{ind.format(hi * f).replace("+", "")}</text>
            </g>
          ))}
          <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="baseline" />
          <path d={area} className="area" />
          <path d={path(avg)} className="avg" />
          <path d={path(own)} className="own" />
          <line x1={x(focus)} x2={x(focus)} y1={padT} y2={y(0)} className="crosshair" />
          {own.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={i === focus ? 4.5 : 2.5} className={i === focus ? "dot active" : "dot"} />
          ))}
          {MOSAIC_YEARS.map((yr, i) => (
            <text key={yr} x={x(i)} y={H - 6} textAnchor="middle" className={i === sel ? "axis strong" : "axis"}>{`'${yr.slice(2)}`}</text>
          ))}
          {/* Hit targets wider than the marks */}
          {MOSAIC_YEARS.map((yr, i) => (
            <rect
              key={yr}
              x={x(i) - (W - padL - padR) / (MOSAIC_YEARS.length - 1) / 2}
              y={0}
              width={(W - padL - padR) / (MOSAIC_YEARS.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>
      {/* Readout follows the hovered year, else the selected year */}
      <p className="insight-readout" aria-live="polite">
        <strong>{MOSAIC_YEARS[focus]}</strong>
        <span>{state} <b>{ind.format(own[focus]!)}</b></span>
        <span className="muted">India avg <b>{ind.format(avg[focus]!)}</b></span>
        <span className="muted unit">{ind.unit} · demo series</span>
      </p>
    </div>
  );
}

function LandMix({ state, year }: { state: string; year: string }) {
  const shares = yearShares(state, year);
  return (
    <div className="insight-mix">
      <div className="mix-bar" role="img" aria-label={`Land-use mix of ${state} in ${year}`}>
        {LAND_CLASS_ORDER.map((c, i) => (
          <span key={c} style={{ width: `${shares[c]}%`, backgroundColor: LULC_CLASSES[i]!.color }} title={`${LULC_CLASSES[i]!.label}: ${shares[c].toFixed(1)}%`} />
        ))}
      </div>
      <ul className="mix-legend">
        {LAND_CLASS_ORDER.map((c, i) => (
          <li key={c}>
            <i style={{ backgroundColor: LULC_CLASSES[i]!.color }} />
            <span>{LULC_CLASSES[i]!.label}</span>
            <b>{shares[c].toFixed(1)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Benchmarks({ state, stat, active }: { state: string; stat: StateStat; active: ThemeId }) {
  return (
    <ul className="bench-list">
      {INDICATORS.map((ind) => {
        const v = ind.value(stat);
        const max = nationalMax(ind) || 1;
        const avg = nationalAvg(ind);
        return (
          <li key={ind.theme} className={ind.theme === active ? "active" : ""}>
            <div className="bench-head">
              <span>{ind.label}</span>
              <b>{ind.format(v)}</b>
            </div>
            <div className="bench-track" role="img" aria-label={`${ind.label}: ${ind.format(v)} versus India average ${ind.format(avg)}`}>
              <span className="bench-fill" style={{ width: `${(v / max) * 100}%` }} />
              <span className="bench-avg" style={{ left: `${(avg / max) * 100}%` }} title={`India average ${ind.format(avg)}`} />
            </div>
            <small>Rank {rankOf(ind, state)} of {ALL_STATS.length} · India avg {ind.format(avg)}</small>
          </li>
        );
      })}
    </ul>
  );
}

export function LandInsightPanel({ selection, sim, theme, year, onAction, onTheme }: {
  selection: SelectionSnapshot;
  sim: SimSnapshot | null;
  theme: ThemeId;
  year: string;
  onAction: (action: MapAction["action"]) => void;
  onTheme: (theme: ThemeId) => void;
}) {
  const p = selection.parcel;
  const state = p?.properties.state ?? selection.stateName;
  const stat = state ? STATE_STATS[state] : undefined;
  const acres = p ? parcelAcres(p) : null;
  const portal = officialPortalFor(state);
  const active = INDICATORS.find((i) => i.theme === theme) ?? INDICATORS[0]!;
  const title = p
    ? `${p.properties.landuse.charAt(0).toUpperCase()}${p.properties.landuse.slice(1)} parcel`
    : selection.village ?? selection.placeLabel?.split(",")[0]?.trim() ?? selection.district ?? state ?? "Selected location";
  const admin = [p?.properties.village ?? selection.village, p?.properties.district ?? selection.district, state].filter(Boolean).join(" · ");
  const parcelRows: Array<[string, string]> = p
    ? [
        ["Parcel ID", p.properties.parcelId.replace(/^OSM-/, "")],
        ["Land use", p.properties.landuse],
        ["Area", acres !== null ? `${acres.toFixed(1)} ac · ${(acres * 0.404686).toFixed(2)} ha` : "Data unavailable"],
        ...(p.properties.taluka ?? selection.taluka ? [["Taluka", (p.properties.taluka ?? selection.taluka)!] as [string, string]] : []),
      ]
    : [];

  return (
    <aside className="insight-panel" aria-label="Selected land details">
      <header className="insight-head">
        <div>
          <span className="insight-kicker">{p ? "Plot / parcel" : "Location"}{state ? ` · ${state}` : ""}</span>
          <h3>{title}</h3>
          <small><MapPin /> {admin || "Admin area unavailable"} · {selection.lat.toFixed(4)}, {selection.lon.toFixed(4)}</small>
        </div>
        <button onClick={() => onAction("close")} aria-label="Close details"><X /></button>
      </header>

      <div className="insight-body">
        {stat && (
          <section className="insight-kpis" aria-label={`${state} indicators`}>
            {INDICATORS.map((ind) => {
              const v = ind.value(stat);
              const avg = nationalAvg(ind);
              const above = v >= avg;
              return (
                <button key={ind.theme} className={ind.theme === theme ? "active" : ""} onClick={() => onTheme(ind.theme)} aria-pressed={ind.theme === theme}>
                  <span>{ind.label}</span>
                  <strong>{ind.format(v)}</strong>
                  {ind.theme === "climate-risk" ? (
                    <em className={RISK_TONE[stat.risk]}>{stat.risk} risk</em>
                  ) : (
                    <em>{above ? "▲" : "▼"} {v / (avg || 1) >= 1.5 ? `${(v / (avg || 1)).toFixed(1)}× India avg` : `${Math.abs(((v - avg) / (avg || 1)) * 100).toFixed(0)}% vs India`}</em>
                  )}
                </button>
              );
            })}
          </section>
        )}

        {parcelRows.length > 0 && (
          <section className="insight-section">
            <h4>Parcel details</h4>
            <dl className="insight-rows">
              {parcelRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>
        )}

        {stat && state && (
          <section className="insight-section">
            <h4>{active.label} · {MOSAIC_YEARS[0]}–{MOSAIC_YEARS[MOSAIC_YEARS.length - 1]}</h4>
            <TrendChart ind={active} state={state} stat={stat} year={year} />
          </section>
        )}

        {state && (
          <section className="insight-section">
            <h4>Land-use mix · {state} {year}</h4>
            <LandMix state={state} year={year} />
          </section>
        )}

        {stat && state && (
          <section className="insight-section">
            <h4>How {state} compares</h4>
            <Benchmarks state={state} stat={stat} active={theme} />
          </section>
        )}

        {!stat && !p && <p className="insight-empty">No verified indicators for this point yet.</p>}

        {sim && (
          <section className="insight-section insight-sim">
            <h4>Scenario analysis · local estimate</h4>
            <dl className="insight-rows">
              <div><dt>Proposed use</dt><dd>{sim.params.use}</dd></div>
              <div><dt>Buffer</dt><dd>{sim.params.bufferM.toLocaleString("en-IN")} m</dd></div>
              <div><dt>Affected area</dt><dd>{sim.bufferAreaHa.toFixed(1)} ha</dd></div>
              <div><dt>Affected parcels</dt><dd>{sim.affectedParcels}</dd></div>
            </dl>
          </section>
        )}

        <section className="insight-section">
          <h4>Analyse this land</h4>
          <div className="insight-actions" role="group" aria-label="Contextual land actions">
            <button onClick={() => onAction("analyze")}><Sparkles /> AI analysis</button>
            <button onClick={() => onTheme("climate-risk")}><CloudSun /> Climate risk</button>
            <button onClick={() => onTheme("land-use-change")}><Sprout /> Land use</button>
            <button onClick={() => onTheme("disputes")}><Scale /> Disputes</button>
            <button onClick={() => onAction("regulations")}><FileText /> Regulations</button>
            <button onClick={() => onAction("simulate")}><FlaskConical /> Simulate conversion</button>
            <button onClick={() => onAction("historical")} className="wide"><History /> Compare historical change</button>
          </div>
        </section>

        <footer className="insight-foot">
          <small>{THEMES[theme].label} values are demo data · {p ? p.properties.source : "OpenStreetMap"} · not a legal survey record</small>
          <div>
            {portal && <a className="insight-primary" href={portal.url} target="_blank" rel="noreferrer">Official records · {portal.label} <ArrowRight /></a>}
            <a className="insight-secondary" href={`/gis-explorer?layer=${theme}${state ? `&state=${encodeURIComponent(state)}` : ""}`}>Open in GIS <ArrowRight /></a>
          </div>
        </footer>
      </div>
    </aside>
  );
}
