import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Layers as LayersIcon, SkipBack, SkipForward } from "lucide-react";
import { TimeMachineClock, useClock } from "./TimeMachineClock";
import { TimeMachineScene, type Pick } from "./TimeMachineScene";
import "./time-machine.css";

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024] as const;
const CENTER: [number, number] = [73.994010411, 20.219252256]; // Vadnerbhairav, Nashik

/**
 * One source → one actual year list → one status. No fake continuity. The
 * satellite layer is the only time series that varies with the clock; parcels
 * are a static snapshot, weather is current-only, the change signal is a
 * 2024 observation.
 */
const SOURCES = [
  { id: "satellite", label: "Satellite imagery", status: "OBSERVED · Sentinel-2 cloudless", years: YEARS },
  { id: "parcels", label: "Parcel geometry", status: "CURRENT / STATIC", years: [] as number[] },
  { id: "change", label: "Change signal (record vs reality)", status: "OBSERVED SIGNAL · 2024", years: [2024] },
  { id: "weather", label: "Weather", status: "CURRENT ONLY", years: [] as number[] },
];

const EVENTS = [
  { id: "e2022", year: 2022, title: "Observation gap increase", lon: CENTER[0] + 0.02, lat: CENTER[1] + 0.01, type: "OBSERVED CHANGE" },
  { id: "e2023", year: 2023, title: "Built-up footprint expansion", lon: CENTER[0] - 0.015, lat: CENTER[1] + 0.02, type: "LAND-USE CHANGE" },
];

export function TimeMachinePage() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const mainScene = useRef<TimeMachineScene | null>(null);
  const compareScene = useRef<TimeMachineScene | null>(null);
  const clock = useMemo(() => new TimeMachineClock(2018, 2024, 2024), []);
  const snap = useClock(clock);
  const year = Math.round(snap.time);

  const [layers, setLayers] = useState({ satellite: true, parcels: true, events: true, change: true });
  const [selected, setSelected] = useState<{
    kind: "parcel" | "event";
    label: string;
    area?: number | undefined;
    gap?: number | undefined;
    year?: number | undefined;
  } | null>(null);
  const [compare, setCompare] = useState(false);
  const [compareYear, setCompareYear] = useState<number>(2019);
  const [ready, setReady] = useState(false);

  // ---- main 3D scene ----
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = new TimeMachineScene();
    mainScene.current = scene;
    void scene.init(sceneRef.current).then(() => setReady(true));
    scene.setPickHandler(handlePick);
    return () => {
      mainScene.current = null;
      scene.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = (p: Pick) => {
    if (p.kind === "event") {
      clock.seek(p.year);
      mainScene.current?.flyToEvent(p.lon, p.lat);
      setSelected({ kind: "event", label: p.title, year: p.year });
    } else {
      setSelected({ kind: "parcel", label: `Parcel ${p.id.replace("tm:parcel:", "").replace("tm:change:", "")}`, area: p.area, gap: p.gap });
    }
  };

  // ---- parcels + change layer ----
  useEffect(() => {
    if (!ready || !mainScene.current) return;
    void fetch("/landing/vadnerbhairav.json")
      .then((r) => r.json())
      .then((data: { origin: [number, number]; plots: { r: number[]; a: number; g: number }[] }) => {
        const [ox, oy] = data.origin;
        const parcels = data.plots.slice(0, 900).map((p, i) => {
          const ring: number[][] = [];
          let lonSum = 0;
          let latSum = 0;
          let n = 0;
          for (let j = 0; j < p.r.length - 1; j += 2) {
            const lon = ox + p.r[j]! / 1e6;
            const lat = oy + p.r[j + 1]! / 1e6;
            ring.push([lon, lat]);
            lonSum += lon;
            latSum += lat;
            n++;
          }
          return {
            id: `p${i}`,
            lon: lonSum / Math.max(n, 1),
            lat: latSum / Math.max(n, 1),
            ring,
            area: p.a,
            gap: p.g,
          };
        });
        mainScene.current?.setParcels(parcels, layers.parcels);
        mainScene.current?.setChangeLayer(parcels, layers.change);
        mainScene.current?.setEvents(
          EVENTS.map((e) => ({ id: e.id, year: e.year, title: e.title, lon: e.lon, lat: e.lat })),
          layers.events,
        );
      })
      .catch(() => {
        /* parcel bundle missing in this build */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // re-apply layer visibility whenever toggles or the scene changes
  useEffect(() => {
    if (!ready || !mainScene.current) return;
    void fetch("/landing/vadnerbhairav.json")
      .then((r) => r.json())
      .then((data: { origin: [number, number]; plots: { r: number[]; a: number; g: number }[] }) => {
        const [ox, oy] = data.origin;
        const parcels = data.plots.slice(0, 900).map((p, i) => {
          const ring: number[][] = [];
          for (let j = 0; j < p.r.length - 1; j += 2) {
            ring.push([ox + p.r[j]! / 1e6, oy + p.r[j + 1]! / 1e6]);
          }
          return { id: `p${i}`, lon: ring[0]?.[0] ?? ox, lat: ring[0]?.[1] ?? oy, ring, area: p.a, gap: p.g };
        });
        mainScene.current?.setParcels(parcels, layers.parcels);
        mainScene.current?.setChangeLayer(parcels, layers.change);
        mainScene.current?.setEvents(
          EVENTS.map((e) => ({ id: e.id, year: e.year, title: e.title, lon: e.lon, lat: e.lat })),
          layers.events,
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, ready]);

  // ---- year → imagery swap (committed, lightly debounced) ----
  useEffect(() => {
    if (!ready || !mainScene.current) return;
    const t = window.setTimeout(() => mainScene.current?.setYear(year), 80);
    return () => window.clearTimeout(t);
  }, [year, ready]);

  // ---- street layer ----
  // driven implicitly through layers.change? No: expose a street toggle.
  // (Not rendered as a separate control in this pass; satellite/parcels/change/events are the toggles.)
  // Keep API: not used.

  // ---- compare scene ----
  useEffect(() => {
    if (!compare || !compareRef.current || !mainScene.current) return;
    const main = mainScene.current;
    const scene2 = new TimeMachineScene();
    compareScene.current = scene2;
    void scene2.init(compareRef.current).then(() => {
      scene2.setYear(compareYear);
      const snapCam = main.cameraSnapshot();
      if (snapCam) scene2.applyCamera(snapCam);
      // keep cameras locked: second view follows first every frame
      main.onCameraChange(() => {
        const s = main.cameraSnapshot();
        if (s) scene2.applyCamera(s);
      });
    });
    return () => {
      compareScene.current = null;
      scene2.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, compareYear]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        snap.playing ? clock.pause() : clock.play();
      } else if (e.key === "ArrowLeft") clock.step(-1);
      else if (e.key === "ArrowRight") clock.step(1);
      else if (e.key === "Escape") {
        clock.pause();
        setCompare(false);
      } else if (e.key === "r" || e.key === "R") {
        mainScene.current?.flyTo(CENTER[0], CENTER[1], 5200, 1500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock, snap.playing]);

  // cleanup clock on unmount
  useEffect(() => () => clock.destroy(), [clock]);

  return (
    <div className="tm-root">
      <div className={`tm-mapwrap ${compare ? "compare" : ""}`}>
        <div ref={sceneRef} className="tm-map" />
        {compare && (
          <div className="tm-compare-pane">
            <div ref={compareRef} className="tm-map tm-compare-map" />
          </div>
        )}
        <div className="tm-vignette" />
      </div>

      <header className="tm-topbar">
        <div>
          <b>NIRVANA · LAND GOVERNANCE TIME MACHINE</b>
          <span>Vadnerbhairav, Nashik, Maharashtra</span>
        </div>
        <div className="tm-top-meta">
          <span className="tm-chip">{year}</span>
          <span className="tm-chip observed">● OBSERVED DATA</span>
          {EVENTS.map((e) => (
            <span key={e.id} className="tm-chip">
              {e.year} ●
            </span>
          ))}
        </div>
      </header>

      <aside className="tm-layers">
        <h4>
          <LayersIcon size={14} /> LAYERS
        </h4>
        {[
          { k: "satellite", label: "Satellite" },
          { k: "parcels", label: "Parcels (static)" },
          { k: "change", label: "Change signal" },
          { k: "events", label: "Event markers" },
        ].map((l) => (
          <label key={l.k}>
            <input
              type="checkbox"
              checked={layers[l.k as keyof typeof layers]}
              onChange={(e) => setLayers((s) => ({ ...s, [l.k]: e.target.checked }))}
            />
            {l.label}
          </label>
        ))}
        <div className="tm-sources">
          <h5>DATA AVAILABILITY</h5>
          {SOURCES.map((s) => (
            <div key={s.id}>
              <b>{s.label}</b>
              <span>
                {s.years.length ? s.years.map((y) => <i key={y} className="on">✓ {y}</i>) : <em>{s.status}</em>}
              </span>
            </div>
          ))}
        </div>
      </aside>

      <aside className="tm-inspector">
        <h4>TEMPORAL OVERVIEW</h4>
        <p className="tm-quote">Scrub the timeline to explore how this landscape changed.</p>
        <div className="tm-big-year">{year}</div>
        <div className="tm-status-line">
          <b>Satellite</b>
          <span>{YEARS.includes(year as (typeof YEARS)[number]) ? `${year} · OBSERVED` : "unavailable"}</span>
        </div>
        <div className="tm-status-line">
          <b>Parcel geometry</b>
          <span>CURRENT / STATIC</span>
        </div>
        <div className="tm-status-line">
          <b>Weather</b>
          <span>CURRENT ONLY · not historical</span>
        </div>
        <div className="tm-status-line">
          <b>Change signal</b>
          <span>OBSERVED SIGNAL · 2024</span>
        </div>

        {selected && (
          <div className="tm-selected">
            <h5>{selected.kind === "event" ? "EVENT" : "PARCEL"}</h5>
            <b>{selected.label}</b>
            {selected.area !== undefined && <span>Area (m²): {selected.area}</span>}
            {selected.gap !== undefined && <span>Gap class: {selected.gap}</span>}
            {selected.year !== undefined && <span>Year: {selected.year}</span>}
            <p className="tm-note">
              {selected.kind === "event"
                ? "Demo event: labelled synthetic for this prototype."
                : "Static parcel: CURRENT / STATIC PARCEL GEOMETRY, not a dated cadastral record."}
            </p>
          </div>
        )}

        <button className="tm-btn" onClick={() => setCompare((c) => !c)}>
          {compare ? "Exit compare" : "BEFORE / AFTER"}
        </button>
        {compare && (
          <div className="tm-compare-controls">
            <label>
              Baseline year
              <select value={compareYear} onChange={(e) => setCompareYear(Number(e.target.value))}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <span>second 3D view · camera locked to main</span>
          </div>
        )}
      </aside>

      <footer className="tm-timeline">
        <div className="tm-tl-controls">
          <button aria-label="reset view" onClick={() => mainScene.current?.flyTo(CENTER[0], CENTER[1], 5200, 1500)}>
            <RotateCcw size={15} />
          </button>
          <button aria-label="previous year" onClick={() => clock.step(-1)}>
            <SkipBack size={15} />
          </button>
          <button aria-label={snap.playing ? "pause" : "play"} onClick={() => (snap.playing ? clock.pause() : clock.play())}>
            {snap.playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button aria-label="next year" onClick={() => clock.step(1)}>
            <SkipForward size={15} />
          </button>
          <select aria-label="speed" value={snap.speed} onChange={(e) => clock.setSpeed(Number(e.target.value))}>
            {[0.5, 1, 2, 4, 8].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
        <div className="tm-tl-rail">
          <div className="tm-tl-ticks">
            {YEARS.map((y) => (
              <button key={y} className={y === year ? "on" : ""} onClick={() => clock.seek(y)}>
                {y}
              </button>
            ))}
          </div>
          <div className="tm-tl-bar">
            <input
              type="range"
              min={2018}
              max={2024}
              step={0.01}
              value={snap.time}
              aria-label="timeline scrubber"
              onChange={(e) => clock.previewSeek(Number(e.target.value))}
              onMouseUp={(e) => clock.seek(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => clock.seek(Number((e.target as HTMLInputElement).value))}
            />
            {EVENTS.map((ev) => (
              <button
                key={ev.id}
                className="tm-tl-event"
                style={{ left: `${((ev.year - 2018) / 6) * 100}%` }}
                title={`${ev.year} · ${ev.title}`}
                onClick={() => {
                  clock.seek(ev.year);
                  mainScene.current?.flyToEvent(ev.lon, ev.lat);
                  setSelected({ kind: "event", label: ev.title, year: ev.year });
                }}
              />
            ))}
          </div>
          <div className="tm-tl-labels">
            <span>2018 ── 2019 ── 2020 ── 2021 ── 2022 ── 2023 ── 2024</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
