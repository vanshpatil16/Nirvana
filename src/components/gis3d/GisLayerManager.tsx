import { Info } from "lucide-react";
import { GROUP_LABELS, type GisGroup, type GisLayerDef, type LayerRuntime } from "./types";

const GROUP_ORDER: GisGroup[] = [
  "base",
  "land",
  "environment",
  "governance",
  "socioeconomic",
  "policy",
];

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  demo: "Demo data",
  unavailable: "Not connected",
};

interface Props {
  layers: GisLayerDef[];
  active: string[];
  runtimes: Record<string, LayerRuntime>;
  onToggle: (id: string) => void;
  onInfo: (layer: GisLayerDef) => void;
}

export function GisLayerManager({ layers, active, runtimes, onToggle, onInfo }: Props) {
  return (
    <div>
      {GROUP_ORDER.map((group) => {
        const rows = layers.filter((l) => l.group === group);
        if (rows.length === 0) return null;
        return (
          <section className="g3d-group" key={group}>
            <h3>{GROUP_LABELS[group]}</h3>
            {rows.map((layer) => {
              const off = layer.status === "unavailable";
              const on = active.includes(layer.id) && !off;
              const rt = runtimes[layer.id];
              return (
                <div key={layer.id}>
                  <div
                    className={`g3d-row ${on ? "on" : "off"}`}
                    role="button"
                    tabIndex={off ? -1 : 0}
                    aria-pressed={on}
                    aria-disabled={off}
                    onClick={() => !off && onToggle(layer.id)}
                    onKeyDown={(e) => {
                      if (off) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle(layer.id);
                      }
                    }}
                  >
                    <span
                      className={`g3d-check ${layer.legend.length === 0 ? "none" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="g3d-row-main">
                      <span className="g3d-row-label">
                        <i className="g3d-dot" style={{ background: layer.color }} />
                        {layer.label}
                      </span>
                      <span className="g3d-row-hint">{layer.hint}</span>
                      <span className={`g3d-pill ${layer.status}`}>
                        {STATUS_LABEL[layer.status]}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="g3d-info"
                      title="Data info & provenance"
                      aria-label={`Data info for ${layer.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onInfo(layer);
                      }}
                    >
                      <Info />
                    </button>
                  </div>

                  {on && layer.legend.length > 0 && (
                    <div className="g3d-legend">
                      {layer.legend.map((entry) => (
                        <span key={entry.label}>
                          <i style={{ background: entry.color }} />
                          {entry.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {off && layer.unavailableNote && (
                    <p className="g3d-note">{layer.unavailableNote}</p>
                  )}

                  {on && rt && rt.state !== "idle" && (
                    <p className="g3d-runtime">
                      <i
                        className={
                          rt.state === "loading"
                            ? "busy"
                            : rt.state === "ready"
                              ? "ok"
                              : rt.state === "error"
                                ? "err"
                                : ""
                        }
                      />
                      {rt.message}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
