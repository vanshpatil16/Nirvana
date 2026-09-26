import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  ClipboardCopy,
  Cpu,
  Database,
  Download,
  FlaskConical,
  GitCommit,
  Hash,
  HelpCircle,
  Play,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { CAPSULE, KPI, QUERY_PLAN, SOURCES } from "./data";
import { Chip, Panel, Prov } from "./ui";

const ICONS = [
  HelpCircle,
  Braces,
  Database,
  GitCommit,
  FlaskConical,
  SlidersHorizontal,
  Target,
  BookOpen,
  Hash,
];

function downloadCapsule() {
  const json = {
    capsule_id: CAPSULE.id,
    title: CAPSULE.title,
    created: CAPSULE.created,
    status: "reproduced",
    prototype: true,
    note: "Prototype capsule — real LULC, synthetic land records and district panel.",
    contents: Object.fromEntries(
      CAPSULE.items.map((i) => [i.k.toLowerCase().replace(/\s+/g, "_"), i.v]),
    ),
    copilot_plan: QUERY_PLAN,
    kpi: {
      indicator: KPI.indicator,
      baseline_days: KPI.baseline,
      target: KPI.target,
      design: KPI.design,
      period: KPI.period,
      treated: KPI.treated,
      controls: KPI.control,
    },
    result: { effect_days: -8, ci95: [-11, -5], naive_before_after_days: -10, grade: "B" },
    sources: SOURCES.map((s) => ({ n: s.n, kind: s.kind, title: s.title, provenance: s.prov })),
    hash: `sha256:${KPI.hashFull}`,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${CAPSULE.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CapsuleScreen({ head, onNext }: { head: ReactNode; onNext: () => void }) {
  const [lines, setLines] = useState(-1); // -1 idle · 0..n streaming · n done
  const [copied, setCopied] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const total = CAPSULE.rerunLog.length;
  const done = lines >= total;

  const rerun = () => {
    if (lines >= 0 && !done) return;
    setLines(0);
  };
  useEffect(() => {
    if (lines < 0 || lines >= total) return;
    const t = window.setTimeout(() => setLines((l) => l + 1), lines === 3 ? 900 : 520);
    return () => window.clearTimeout(t);
  }, [lines, total]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const cite = `BHU-NITI Evidence Capsule ${CAPSULE.id}: “${CAPSULE.title}” (${CAPSULE.created}). ${KPI.hash}.`;

  return (
    <div className="wf-screen">
      {head}
      <div className="wf-capsule">
        <div className="wf-col">
          <section className="wf-capcard">
            <div className="wf-capcard-top">
              <span className="wf-capsule-ico">
                <FlaskConical size={22} />
              </span>
              <div>
                <span className="wf-eyebrow light">Evidence Capsule</span>
                <h2>{CAPSULE.title}</h2>
                <div className="wf-capmeta">
                  <code>{CAPSULE.id}</code>
                  <span>{CAPSULE.created}</span>
                  <span>commit {CAPSULE.commit}</span>
                </div>
              </div>
              <div className="wf-capgrade">
                <b>B</b>
                <small>grade</small>
              </div>
            </div>
            <div className="wf-capcard-foot">
              <span>
                <Hash size={13} /> {KPI.hash}
              </span>
              <span>
                <Check size={13} /> Pre-registered before evaluation
              </span>
              <span>
                <Check size={13} /> {done ? "Reproduced" : "Awaiting re-run"}
              </span>
            </div>
          </section>

          <Panel
            eyebrow="Contents"
            title="Everything needed to reproduce the claim"
            right={<Prov kind="synthetic">Synthetic records</Prov>}
          >
            <div className="wf-capgrid">
              {CAPSULE.items.map((it, i) => {
                const Icon = ICONS[i] ?? Database;
                return (
                  <div key={it.k} className="wf-captile">
                    <span className="ico">
                      <Icon size={15} />
                    </span>
                    <span className="k">{it.k}</span>
                    <b
                      className={
                        it.k === "JSON plan" || it.k === "Hash" || it.k === "Code commit"
                          ? "mono"
                          : ""
                      }
                    >
                      {it.v}
                    </b>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="wf-col">
          <section className="wf-console">
            <header>
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <span>bhu-niti capsule rerun {CAPSULE.id}</span>
              <Cpu size={14} />
            </header>
            <div className="wf-console-body" ref={logRef}>
              {lines < 0 && (
                <>
                  <p className="dim">$ cat {CAPSULE.id}/manifest</p>
                  {CAPSULE.items.map((it) => (
                    <p key={it.k} className="man">
                      <b>{it.k.toLowerCase().replace(/s+/g, "_")}</b>: {it.v}
                    </p>
                  ))}
                  <p className="dim">
                    $ Ready — re-running rebuilds the result from pinned data, code and parameters.
                  </p>
                </>
              )}
              {lines >= 0 && <p className="cmd">$ bhu-niti capsule rerun {CAPSULE.id} --verify</p>}
              {CAPSULE.rerunLog.slice(0, Math.max(0, lines)).map((l) => (
                <p key={l} className="ok">
                  <span>✓</span> {l}
                </p>
              ))}
              {lines >= 0 && !done && <p className="cursor">▍</p>}
            </div>
            {done && (
              <div className="wf-repro">
                <span className="ico">
                  <Check size={20} strokeWidth={3} />
                </span>
                <div>
                  <b>Reproduced ✓ identical output</b>
                  <div className="wf-hashcmp">
                    <span>
                      original <code>a3f9…7c21</code>
                    </span>
                    <span>
                      re-run <code>a3f9…7c21</code>
                    </span>
                    <Chip tone="green">match</Chip>
                  </div>
                </div>
              </div>
            )}
            <div className="wf-console-actions">
              <button
                type="button"
                className="wf-btn primary"
                onClick={rerun}
                disabled={lines >= 0 && !done}
              >
                <Play size={15} />{" "}
                {done ? "Re-run again" : lines >= 0 ? "Re-running…" : "Re-run capsule"}
              </button>
              <button type="button" className="wf-btn ghost onDark" onClick={downloadCapsule}>
                <Download size={15} /> Download .json
              </button>
              <button
                type="button"
                className="wf-btn ghost onDark"
                onClick={() => {
                  void navigator.clipboard?.writeText(cite);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
              >
                <ClipboardCopy size={15} /> {copied ? "Copied" : "Cite"}
              </button>
            </div>
          </section>

          <Panel eyebrow="Why it matters" title="A claim anyone can check">
            <ul className="wf-why">
              <li>
                <b>Same inputs, same answer.</b> Dataset versions, commit and parameters are pinned,
                so the result can be rebuilt byte-for-byte.
              </li>
              <li>
                <b>Target set before the data.</b> The KPI hash proves the goal wasn’t moved after
                seeing the outcome.
              </li>
              <li>
                <b>Sources travel with it.</b> The 6 citations behind the Copilot answer are part of
                the capsule.
              </li>
            </ul>
            {done && (
              <button type="button" className="wf-btn dark block" onClick={onNext}>
                Add to the evidence base <ArrowRight size={15} />
              </button>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
