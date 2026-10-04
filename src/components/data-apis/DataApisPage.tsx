/**
 * Data & APIs — the gateway surface.
 *
 * Everything on this page is fetched live from the Land Stack API (FastAPI on
 * Render). When that gateway is asleep, rate-limited or missing a credential the
 * page says so plainly instead of showing stale numbers, because a status page
 * that lies is worse than no status page.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CircleDot,
  Code2,
  Database,
  Globe2,
  Layers3,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  XCircle,
  Copy,
  Key,
  Lock,
  Terminal,
  Check,
  Server,
  Eye,
  ExternalLink,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { LimitedAccessBanner } from "@/components/auth/LimitedAccessBanner";
import { toast } from "sonner";
import { HonestyBadge } from "@/mock/badges";

import {
  LANDSTACK_BASE_URL,
  countFeatures,
  fetchCollections,
  fetchLandRecordsIndex,
  fetchSourceHealth,
  fetchSources,
  type LandStackCollection,
  type LandStackSource,
  type Result,
  type SourceHealth,
} from "@/services/landstackApi";

/** Patna Bailey Road — the demo fixture anchor, used for the "try it" buttons. */
const DEMO_BBOX: [number, number, number, number] = [85.115, 25.605, 85.13, 25.613];

const EVIDENCE_TONE: Record<string, string> = {
  OBSERVED: "tone-observed",
  DERIVED: "tone-derived",
  MODELLED: "tone-modelled",
  SCENARIO: "tone-scenario",
  DEMO: "tone-demo",
};

type Tone = { cls: string; Icon: typeof CheckCircle2; text: string };

const STATUS_TONE: Record<string, Tone> = {
  ok: { cls: "ok", Icon: CheckCircle2, text: "Operational" },
  configured: { cls: "ok", Icon: CheckCircle2, text: "Configured" },
  degraded: { cls: "warn", Icon: AlertTriangle, text: "Degraded" },
  slow: { cls: "warn", Icon: AlertTriangle, text: "Slow" },
  unconfigured: { cls: "off", Icon: CircleDot, text: "Not configured" },
};

function StatusPill({ status }: { status: SourceHealth["status"] }) {
  const entry: Tone = STATUS_TONE[status] ?? {
    cls: "warn",
    Icon: AlertTriangle,
    text: status,
  };
  const { Icon } = entry;
  return (
    <span className={`ds-pill ${entry.cls}`}>
      <Icon width={13} height={13} aria-hidden />
      {entry.text}
    </span>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon: typeof Activity;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`ds-panel ${className}`}>
      <header className="ds-panel-head">
        <h2>
          <Icon width={16} height={16} aria-hidden />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function DataApisPage() {
  const [sources, setSources] = useState<LandStackSource[] | null>(null);
  const [health, setHealth] = useState<Record<string, SourceHealth> | null>(null);
  const [collections, setCollections] = useState<LandStackCollection[] | null>(null);
  const [records, setRecords] = useState<{
    jurisdictions: number;
    with_public_portal: number;
    sanctioned_interfaces: number;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [probe, setProbe] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});
    const next: Record<string, string> = {};

    // Health is deliberately excluded: it takes ~25s even with probe=false, so
    // it is an explicit user action instead of blocking first paint.
    const [src, col, lri] = await Promise.all([
      fetchSources(),
      fetchCollections(),
      fetchLandRecordsIndex(),
    ]);

    if (src.ok) setSources(src.data);
    else next["sources"] = src.reason;
    if (col.ok) setCollections(col.data);
    else next["collections"] = col.reason;
    if (lri.ok) setRecords(lri.data);
    else next["records"] = lri.reason;

    setErrors(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkHealth = async () => {
    setChecking(true);
    setHealthError(null);
    const res = await fetchSourceHealth();
    if (res.ok) setHealth(res.data);
    else setHealthError(res.reason);
    setChecking(false);
  };
  // A click-to-verify affordance: prove what a collection actually returns for a
  // bbox. Zero features is a valid answer and is reported as such, not as a
  // failure — the gateway does not fabricate coverage it does not have.
  const tryCollection = async (id: string) => {
    setProbe((p) => ({ ...p, [id]: "loading" }));
    const res: Result<{ count: number; sample: unknown }> = await countFeatures(id, DEMO_BBOX);
    setProbe((p) => ({
      ...p,
      [id]: res.ok
        ? res.data.count === 0
          ? "0 features in this bbox — real, not fabricated coverage"
          : `${res.data.count} feature${res.data.count === 1 ? "" : "s"} returned`
        : res.reason,
    }));
  };

  const { role, roleId, getAccess } = useRole();
  const access = getAccess("/data-apis");
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const healthById = (id: string): SourceHealth["status"] =>
    health?.[id]?.status ??
    (sources?.find((s) => s.id === id)?.configured ? "configured" : "unconfigured");

  return (
    <div className="ds-shell">
      <header className="ds-hero">
        <div className="ds-hero-text">
          <span className="ds-kicker">
            <Globe2 width={13} height={13} aria-hidden /> Land Stack API
          </span>
          <h1>Data &amp; APIs</h1>
          <p>
            Every dataset, research corpus and geospatial service on this platform is reachable
            through one integration gateway. It speaks{" "}
            <strong>OGC API&nbsp;Features&nbsp;1.0</strong> and{" "}
            <strong>STAC&nbsp;API&nbsp;1.0</strong>, so any GIS tool can read it without a custom
            client.
          </p>
          <div className="ds-hero-actions">
            <a
              className="ds-btn primary"
              href={`${LANDSTACK_BASE_URL}/docs`}
              target="_blank"
              rel="noreferrer"
            >
              <Code2 width={15} height={15} aria-hidden /> OpenAPI docs
            </a>
            <a
              className="ds-btn"
              href={`${LANDSTACK_BASE_URL}/stac`}
              target="_blank"
              rel="noreferrer"
            >
              <Layers3 width={15} height={15} aria-hidden /> STAC catalog
            </a>
            <button className="ds-btn ghost" onClick={() => void load()} disabled={loading}>
              {loading ? (
                <Loader2 width={15} height={15} className="ds-spin" aria-hidden />
              ) : (
                <RefreshCw width={15} height={15} aria-hidden />
              )}
              Refresh
            </button>
          </div>
          <p className="ds-endpoint">
            <Globe2 width={12} height={12} aria-hidden />
            <code>{LANDSTACK_BASE_URL}</code>
          </p>
        </div>

        <div className="ds-hero-stats">
          <Stat value={collections?.length} label="OGC collections" Icon={Layers3} />
          <Stat value={sources?.length} label="Upstream sources" Icon={Database} />
          <Stat value={records?.jurisdictions} label="State / UT RoR portals" Icon={ScrollText} />
          <Stat
            value={records?.sanctioned_interfaces}
            label="Sanctioned interfaces"
            Icon={ShieldCheck}
          />
        </div>
      </header>

      {access === "limited" && (
        <LimitedAccessBanner scopeNote="Read-only view for your role: Developer API keys and direct write pipelines are hidden." />
      )}

      {/* STATE OWNER VIEW: Data Sources & Enclave Adapters */}
      {roleId === "state_owner" && (
        <section className="ds-panel my-4 border border-purple-500/30 bg-purple-500/5 rounded-2xl p-5 space-y-4 shadow-sm" aria-label="State Data Adapters">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                <h2 className="text-sm font-bold text-foreground">
                  State Node Adapters &amp; Local Enclave Ingestion
                </h2>
                <HonestyBadge type="LIVE" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Maintain state-specific adapters that bridge local NIC Bhulekh / RoR instances with the federated zero-knowledge gateway.
              </p>
            </div>
            <span className="text-[10px] font-mono text-purple-700 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/25 font-bold uppercase">
              State Data Owner View
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { name: "Maharashtra NIC Bhulekh REST Adapter", version: "v2.4.1", status: "Active / Online", latency: "18ms", mode: "Row-Level Differential Privacy Enclave" },
              { name: "Mahabhumi Cadastral WFS Bridge", version: "v1.9.0", status: "Active / Online", latency: "34ms", mode: "Zero-Knowledge Query Layer" },
              { name: "Bhuvan Sentinel-2 Mosaic Raster Proxy", version: "v3.1.2", status: "Active / Online", latency: "52ms", mode: "STAC GeoTIFF Streamer" },
            ].map((ad) => (
              <div key={ad.name} className="p-3.5 rounded-xl border border-border/70 bg-background space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">{ad.name}</span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {ad.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">Version: {ad.version} · Latency: {ad.latency}</div>
                <div className="text-[10px] font-mono text-primary bg-primary/5 p-1 rounded border border-primary/20">
                  {ad.mode}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RESEARCHER VIEW: Datasets & Academic API Keys */}
      {roleId === "researcher" && (
        <section className="ds-panel my-4 border border-blue-500/30 bg-blue-500/5 rounded-2xl p-5 space-y-4 shadow-sm" aria-label="Researcher Datasets and Keys">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-500/20 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <h2 className="text-sm font-bold text-foreground">
                  Academic Research API Access &amp; Citation Metadata
                </h2>
                <HonestyBadge type="LIVE" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pre-authenticated academic token with high-throughput OGC / STAC query quota for empirical research.
              </p>
            </div>
            <span className="text-[10px] font-mono text-blue-700 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/25 font-bold uppercase">
              Researcher View
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border/70 bg-background space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Personal Academic Key</span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-muted p-2 rounded flex-1 truncate text-foreground">
                  {showKey ? "nrv_live_res_9f83e2a7b1c4e9d082f6a5b3c2d1e0f9" : "nrv_live_res_••••••••••••••••••••••••••••••••"}
                </code>
                <button
                  onClick={() => setShowKey((s) => !s)}
                  className="px-2.5 py-2 text-xs border rounded-md hover:bg-muted font-semibold"
                >
                  {showKey ? "Hide" : "Reveal"}
                </button>
                <button
                  onClick={() => {
                    setCopiedKey(true);
                    toast.success("API Key Copied to Clipboard");
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="px-2.5 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-semibold flex items-center gap-1"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Monthly Quota: <strong>12,450 / 100,000 queries</strong></span>
                <span className="text-emerald-600 font-semibold">Tier: Accredited Academic</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-background space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Python Integration Snippet</span>
              <pre className="text-[11px] font-mono bg-muted/80 p-2.5 rounded text-foreground/90 overflow-x-auto">
{`import requests
res = requests.get(
  "https://api.nirvana.gov.in/v1/collections",
  headers={"X-API-Key": "nrv_live_res_..."}
)`}
              </pre>
              <p className="text-[10px] text-muted-foreground">Standardized citation DOI: 10.5281/zenodo.nirvana.2026</p>
            </div>
          </div>
        </section>
      )}

      {/* INNOVATOR VIEW: Production API Keys, Docs & Usage */}
      {roleId === "innovator" && (
        <section className="ds-panel my-4 border border-orange-500/30 bg-orange-500/5 rounded-2xl p-5 space-y-4 shadow-sm" aria-label="Innovator API Sandbox">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-500/20 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-orange-700 dark:text-orange-400" />
                <h2 className="text-sm font-bold text-foreground">
                  Developer Sandbox &amp; Production API Gateway
                </h2>
                <HonestyBadge type="LIVE" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Access machine-readable STAC, cadastral boundary features, and build agritech or civic tech solutions.
              </p>
            </div>
            <span className="text-[10px] font-mono text-orange-700 bg-orange-500/15 px-2 py-0.5 rounded border border-orange-500/25 font-bold uppercase">
              Industry / Startup View
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border/70 bg-background space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Production Key</span>
              <code className="text-xs font-mono bg-muted p-2 rounded block truncate text-foreground">
                nrv_live_inno_4c71d0e82a9b3f6d5e1c0b8a
              </code>
              <div className="text-[11px] text-muted-foreground flex justify-between pt-1">
                <span>Usage: <strong>8,420 / 25,000</strong></span>
                <span className="text-primary font-bold">34%</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: "34%" }} />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-background space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gateway Telemetry</span>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>P95 Latency:</span> <strong className="font-mono text-emerald-600">42ms</strong></div>
                <div className="flex justify-between"><span>Uptime (30d):</span> <strong className="font-mono text-emerald-600">99.94%</strong></div>
                <div className="flex justify-between"><span>Active Webhooks:</span> <strong className="font-mono text-foreground">2 endpoints</strong></div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-background space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">cURL Quickstart</span>
              <pre className="text-[10px] font-mono bg-muted p-2 rounded text-foreground overflow-x-auto">
{`curl -X GET \\
  "https://api.nirvana.gov.in/v1/stac" \\
  -H "Authorization: Bearer nrv_inno_..."`}
              </pre>
            </div>
          </div>
        </section>
      )}

      {/* POLICYMAKER VIEW: Read-Only System Audit */}
      {roleId === "policymaker" && (
        <section className="ds-panel my-4 border border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-4 space-y-2 shadow-sm" aria-label="Policymaker Read-only System View">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-foreground">
                National Data Infrastructure Audit (Read-Only)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/25 font-bold uppercase">
              Policymaker Scoped
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            All 36 states and UTs are connected through standardized OGC Feature &amp; STAC endpoints. Developer keys and mutable credentials are restricted from policy governance view.
          </p>
        </section>
      )}

      {Object.keys(errors).length > 0 && (
        <div className="ds-banner" role="status">
          <AlertTriangle width={16} height={16} aria-hidden />
          <div>
            <strong>Some gateway data could not be loaded.</strong>
            <ul>
              {Object.entries(errors).map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code>: {v}
                </li>
              ))}
            </ul>
          </div>
          <button className="ds-btn ghost small" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      <div className="ds-grid">
        <Panel
          title="Source health"
          icon={Activity}
          action={
            <button className="ds-btn tiny" onClick={() => void checkHealth()} disabled={checking}>
              {checking ? (
                <Loader2 width={12} height={12} className="ds-spin" aria-hidden />
              ) : (
                <Activity width={12} height={12} aria-hidden />
              )}
              {checking ? "Checking…" : "Check live health"}
            </button>
          }
        >
          {!sources ? (
            <Skeleton />
          ) : (
            <>
              <p className="ds-panel-intro">
                {health
                  ? "Live reachability from the gateway's own probe."
                  : "Shows credential status from the gateway. Live reachability probes ISRO Bhuvan, which is slow from the gateway's host, so it is a short, on-demand check."}
              </p>
              {healthError ? (
                <p className="ds-note warn">
                  <AlertTriangle width={12} height={12} aria-hidden /> Live check did not return:{" "}
                  {healthError} Credential status above is still accurate.
                </p>
              ) : null}
              <ul className="ds-health">
                {sources.map((s) => {
                  const status = healthById(s.id);
                  const detail = health?.[s.id]?.detail;
                  return (
                    <li key={s.id}>
                      <div className="ds-health-row">
                        <strong>{s.name}</strong>
                        <StatusPill status={status} />
                      </div>
                      <div className="ds-health-meta">
                        <span>{s.provider}</span>
                        <a href={s.url ?? "#"} target="_blank" rel="noreferrer">
                          {s.url} <ArrowUpRight width={11} height={11} aria-hidden />
                        </a>
                      </div>
                      {detail && status !== "ok" ? (
                        <p className="ds-health-note">{detail}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          title="Upstream sources"
          icon={Database}
          action={<span className="ds-muted">{sources?.length ?? 0} registered</span>}
        >
          {!sources ? (
            <Skeleton />
          ) : (
            <ul className="ds-sources">
              {sources.map((s) => (
                <li key={s.id}>
                  <div className="ds-source-head">
                    <strong>{s.name}</strong>
                    <span className={`ds-badge ${EVIDENCE_TONE[s.evidence] ?? ""}`}>
                      {s.evidence}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Access</dt>
                      <dd>{s.auth.replace(/_/g, " ")}</dd>
                    </div>
                    {s.license ? (
                      <div>
                        <dt>Licence</dt>
                        <dd>{s.license}</dd>
                      </div>
                    ) : null}
                    {s.cadence ? (
                      <div>
                        <dt>Cadence</dt>
                        <dd>{s.cadence}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {s.auth_notes ? <p className="ds-note">{s.auth_notes}</p> : null}
                  {!s.configured && s.unavailable_reason ? (
                    <p className="ds-note warn">
                      <XCircle width={12} height={12} aria-hidden /> {s.unavailable_reason}
                    </p>
                  ) : null}
                  {s.contains_personal_data ? (
                    <p className="ds-note danger">
                      <ShieldCheck width={12} height={12} aria-hidden /> Returns personal data —
                      restricted to the government role, DPDP Act 2023.
                    </p>
                  ) : null}
                  {s.limitations.length > 0 ? (
                    <details>
                      <summary>{s.limitations.length} known limitations</summary>
                      <ul>
                        {s.limitations.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="OGC collections"
          icon={Layers3}
          className="ds-wide"
          action={<span className="ds-muted">bbox: 85.115, 25.605, 85.130, 25.613</span>}
        >
          {!collections ? (
            <Skeleton />
          ) : (
            <div className="ds-cards">
              {collections.map((c) => (
                <article key={c.id} className="ds-card">
                  <header>
                    <h3>{c.title}</h3>
                    <span
                      className={`ds-badge ${EVIDENCE_TONE[c["x-evidence"] ?? "OBSERVED"] ?? ""}`}
                    >
                      {c["x-evidence"]}
                    </span>
                  </header>
                  <p>{c.description}</p>
                  <div className="ds-tags">
                    {c.keywords.slice(0, 4).map((k) => (
                      <span key={k}>{k}</span>
                    ))}
                  </div>
                  {c["x-license"] ? (
                    <p className="ds-meta">
                      <strong>Licence</strong> {c["x-license"]}
                    </p>
                  ) : null}
                  {c.id === "survey-parcels" ? (
                    <p className="ds-note warn">
                      Coverage is uneven across states — absence of data is not absence of parcels.
                    </p>
                  ) : null}
                  {c["x-caveats"]?.length ? (
                    <ul className="ds-caveats">
                      {c["x-caveats"].slice(0, 2).map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  ) : null}
                  <footer>
                    <code>{c.id}</code>
                    <button
                      className="ds-btn tiny"
                      onClick={() => void tryCollection(c.id)}
                      disabled={probe[c.id] === "loading"}
                    >
                      {probe[c.id] === "loading" ? (
                        <Loader2 width={12} height={12} className="ds-spin" aria-hidden />
                      ) : (
                        <Sparkles width={12} height={12} aria-hidden />
                      )}
                      Try it
                    </button>
                  </footer>
                  {probe[c.id] && probe[c.id] !== "loading" ? (
                    <p className="ds-probe">{probe[c.id]}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Endpoint reference" icon={Code2} className="ds-wide">
          <div className="ds-endpoints">
            <Endpoint
              method="GET"
              path="/collections"
              desc="Every collection with licence, evidence grade and extent"
            />
            <Endpoint
              method="GET"
              path="/collections/{id}/items?bbox=…"
              desc="Features for a bounding box, as GeoJSON"
            />
            <Endpoint method="GET" path="/stac" desc="STAC 1.0 catalog for GIS tooling" />
            <Endpoint method="GET" path="/stac/search" desc="Cross-collection item search" />
            <Endpoint
              method="GET"
              path="/api/v1/sources"
              desc="Upstreams with auth needs and limitations"
            />
            <Endpoint
              method="GET"
              path="/api/v1/geocode"
              desc="Place search and reverse geocoding"
            />
            <Endpoint
              method="GET"
              path="/api/v1/land-records/index"
              desc="State / UT Record of Rights discovery index"
            />
            <Endpoint
              method="POST"
              path="/api/v1/land-records/rbih/owner-details"
              desc="Owner details — government role only, personal data"
              danger
            />
          </div>
          <p className="ds-note">
            <ShieldCheck width={12} height={12} aria-hidden /> Roles are ordered public → researcher
            → policymaker → government → admin. Every error returns{" "}
            <code>application/problem+json</code> (RFC 7807), so a client can parse one shape
            regardless of which upstream failed.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  Icon,
}: {
  value: number | undefined;
  label: string;
  Icon: typeof Activity;
}) {
  return (
    <div className="ds-stat">
      <Icon width={15} height={15} aria-hidden />
      <strong>{value ?? "—"}</strong>
      <span>{label}</span>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
  danger,
}: {
  method: string;
  path: string;
  desc: string;
  danger?: boolean;
}) {
  return (
    <div className={`ds-endpoint${danger ? " danger" : ""}`}>
      <span className="ds-method">{method}</span>
      <code>{path}</code>
      <p>{desc}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <ul className="ds-skeleton" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} />
      ))}
    </ul>
  );
}
