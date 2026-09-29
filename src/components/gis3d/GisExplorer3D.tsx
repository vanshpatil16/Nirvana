import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Compass,
  Home,
  Info,
  Layers3,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import {
  CesiumGlobe,
  type BuildingVisualMode,
  type ChoroplethSpec,
  type GlobeCameraInfo,
  type GlobeHover,
  type GlobeStatus,
} from "./globe/CesiumGlobe";
import { DEMO_BUILDING, isInsideDemoArea } from "./demoBuilding";
import { GisFloorStack } from "./GisFloorStack";
import { DATA_UPDATED, GIS_LAYERS, DEFAULT_LAYER_IDS, TIME_YEARS, gisLayer } from "./layerRegistry";
import {
  type Crumb,
  type LayerRuntime,
  type PerfMode,
  type Selection,
  type Viewport,
} from "./types";
import { GisLayerManager } from "./GisLayerManager";
import { EvidenceBody, GisIntelPanel, SelectionHeader } from "./GisIntelPanel";
import { GisAskBhumi, type AskContext } from "./GisAskBhumi";
import { GisScenarioDrawer } from "./GisScenarioDrawer";
import { buildChoropleth, pickChoroplethLayer } from "./chropleth";
import { stateRings, fetchPlaceRing } from "@/services/gis3d/adminGeo";
import { fetchGisParcels } from "@/services/gis3d/parcels";
import { fetchOsmFeatures, type OsmKind } from "@/services/gis3d/osmVectors";
import { searchPlaces, type PlaceResult } from "@/services/geocodeService";
import { ZERO_DELTAS } from "@/data/land-scenario";
import {
  GEOGRAPHY_SHAPES,
  GROWTH_CORRIDOR_IDS,
  REGION_OUTLINE_RING,
  geographyById,
} from "@/data/policySimulation/geographies";

const INDIA: Crumb = { label: "India", lat: 22.5, lon: 82.0, range: 7_500_000 };

const IDLE: LayerRuntime = { state: "idle", message: "", featureCount: 0 };

const OSM_LAYER_ID: Record<OsmKind, string> = {
  buildings: "buildings",
  roads: "roads",
  water: "water",
  protected: "protected",
};

const PERF_ORDER: PerfMode[] = ["high", "medium", "low"];

/** Native tileset rendering modes - restyle only, never a second tileset. */
const BUILDING_MODES: { id: BuildingVisualMode; label: string; title: string }[] = [
  { id: "standard", label: "STD", title: "Standard shading" },
  { id: "height", label: "HEIGHT", title: "Height bands: high ≥ 35 m, medium 18-35 m, low < 18 m" },
  { id: "footprint", label: "FOOTPRINT", title: "Footprint emphasis, geometry subdued" },
  { id: "inspection", label: "INSPECT", title: "Isolate the selected building" },
];

interface Props {
  search: { state?: string | undefined; layer?: string | undefined };
}

export function GisExplorer3D({ search }: Props) {
  /* ------------------------------------------------------------- state */
  const [active, setActive] = useState<string[]>(() => {
    const ids = new Set(DEFAULT_LAYER_IDS);
    if (search.state) ids.add("admin");
    if (search.layer) ids.add(search.layer);
    return [...ids].filter((id) => gisLayer(id) !== undefined);
  });
  const [year, setYear] = useState(2024);
  const [compare, setCompare] = useState(false);
  const [compareYears, setCompareYears] = useState<[number, number]>([2018, 2024]);
  const [splitPos, setSplitPos] = useState(0.5);
  const [perf, setPerf] = useState<PerfMode>("high");
  const [mode, setMode] = useState<"2d" | "3d">("3d");
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [crumbs, setCrumbs] = useState<Crumb[]>([INDIA]);
  const [runtimes, setRuntimes] = useState<Record<string, LayerRuntime>>({});
  const [status, setStatus] = useState<GlobeStatus>({
    terrain: "loading",
    buildings: "off",
    credits: [],
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [tab, setTab] = useState<"inspect" | "ask" | "scenario">("inspect");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showHits, setShowHits] = useState(false);
  const [deltas, setDeltas] = useState(ZERO_DELTAS);
  const [region, setRegion] = useState("Maharashtra");
  const [didStates, setDidStates] = useState<[string, string]>(["Maharashtra", "Gujarat"]);
  const [ringName, setRingName] = useState<string | null>(null);

  /* ------------------------------------------------- 3D mode / camera state */
  const [visualMode, setVisualMode] = useState<BuildingVisualMode>("standard");
  const [hover, setHover] = useState<GlobeHover | null>(null);
  const [camera, setCamera] = useState<GlobeCameraInfo>({
    headingDeg: 0,
    pitchDeg: -90,
    orbiting: false,
  });
  // Floor stack is a DEMO-only surface, and only inside the Patna view gate.
  const [floorOpen, setFloorOpen] = useState(false);
  const [floorExplosion, setFloorExplosion] = useState(0);
  const [floorSelected, setFloorSelected] = useState<number | null>(null);

  const globeRef = useRef<CesiumGlobe | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const creditRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);

  const states = useMemo(() => stateRings(), []);
  const layers = GIS_LAYERS;

  const patchRuntime = useCallback((id: string, patch: Partial<LayerRuntime>) => {
    setRuntimes((prev) => ({ ...prev, [id]: { ...(prev[id] ?? IDLE), ...patch } }));
  }, []);

  /* --------------------------------------------------------- globe init */
  useEffect(() => {
    const container = containerRef.current;
    const credit = creditRef.current;
    if (!container || !credit) return;
    let cancelled = false;
    let lastHoverTick = 0;
    let lastHoverKey = "";
    const globe = new CesiumGlobe({
      onViewport: (v) => !cancelled && setViewport(v),
      onPick: (p) => {
        if (cancelled) return;
        setSelection(pickToSelection(p));
        if (p) setRightOpen(true);
      },
      onStatus: (s) => !cancelled && setStatus(s),
      onCamera: (c) => !cancelled && setCamera(c),
      // The tooltip follows the pointer, so it is throttled hard: a full
      // re-render per mouse-move event would jank the globe.
      onHover: (h) => {
        if (cancelled) return;
        const key = h ? `${h.title}|${h.detail ?? ""}` : "";
        const now = performance.now();
        if (key === lastHoverKey && now - lastHoverTick < 60) return;
        lastHoverKey = key;
        lastHoverTick = now;
        setHover(h);
      },
      onReady: () => {},
    });
    globeRef.current = globe;
    void globe.init(container, credit).then((ok) => {
      if (cancelled) return;
      if (!ok) setFailed(true);
      else {
        setReady(true);
        // Open on India rather than the default whole-ellipsoid view.
        globe.flyHome(0);
      }
    });
    return () => {
      cancelled = true;
      globe.destroy();
      globeRef.current = null;
    };
  }, []);

  // Both drawers start collapsed so mobile never covers the globe; on a
  // desktop the panels are part of the layout, so open them on mount and
  // whenever the viewport crosses the breakpoint in either direction.
  useEffect(() => {
    let desktop = window.innerWidth > 980;
    if (desktop) {
      setLeftOpen(true);
      setRightOpen(true);
    }
    const onResize = () => {
      const next = window.innerWidth > 980;
      if (next === desktop) return;
      desktop = next;
      setLeftOpen(next);
      setRightOpen(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ------------------------------------------------- wheel over the chrome
     The legend, the status bar and the banners sit on top of the globe, so a
     wheel gesture landing on them used to be swallowed by that layer of UI.
     Anything non-interactive is forwarded to the canvas; panels and form
     controls keep their own scrolling. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("canvas")) return;
      if (target.closest(".g3d-panel, .g3d-top, input, select, textarea, button, a")) return;
      const canvas = stage.querySelector("canvas");
      if (!canvas) return;
      event.preventDefault();
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: event.screenX,
          screenY: event.screenY,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  /* Panels sit above the canvas, so the globe stops receiving moves the
     moment the pointer reaches one - drop the stale readout then. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onMove = (event: PointerEvent) => {
      if (event.target instanceof HTMLCanvasElement) return;
      setHover((prev) => (prev ? null : prev));
    };
    stage.addEventListener("pointermove", onMove);
    return () => stage.removeEventListener("pointermove", onMove);
  }, []);

  /* ------------------------------------------------- visual mode -> tileset
     One tileset, restyled in place. The layer toggle itself is unchanged -
     `tileset.show` - and only a pick that actually came off the tileset can
     drive the "selected building" condition. */
  const tilesetId = useMemo(() => {
    if (selection.kind !== "building") return null;
    if (selection.properties["origin"] !== "tileset-feature") return null;
    return selection.id.replace(/^tileset:/, "");
  }, [selection]);

  useEffect(() => {
    globeRef.current?.setBuildingStyle(visualMode, tilesetId);
  }, [visualMode, tilesetId]);

  /* ------------------------------------------------------- floor stack gate
     The stack is rendered only when the user asks for it AND the picked
     building sits inside the tiny demo bbox around the Patna anchor. */
  const demoAvailable =
    selection.kind === "building" && isInsideDemoArea(selection.lon, selection.lat);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    if (!floorOpen || !demoAvailable) {
      globe.setFloorStack(null);
      return;
    }
    const building = DEMO_BUILDING;
    globe.setFloorStack({
      lon: building.lon,
      lat: building.lat,
      footprint: building.footprint,
      totalHeightM: building.totalHeightM,
      levels: building.levels.map((level) => ({
        floorIndex: level.floorIndex,
        floorCode: level.floorCode,
        baseM: level.elevationBaseM,
        heightM: level.floorHeightM,
      })),
    });
    /* `ready` is a dependency on purpose: the FLOOR STACK shortcut can run
       before Cesium has finished booting, and the globe drops a stack request
       that arrives without a viewer. Re-run once it does. */
  }, [floorOpen, demoAvailable, ready]);

  useEffect(() => {
    if (!floorOpen || !demoAvailable) return;
    globeRef.current?.setFloorExplosion(floorExplosion, floorSelected);
  }, [floorOpen, demoAvailable, floorExplosion, floorSelected]);

  /* Closing the selection must close the demo stack with it. */
  useEffect(() => {
    if (selection.kind === "building") return;
    setFloorOpen(false);
    setFloorExplosion(0);
    setFloorSelected(null);
  }, [selection]);

  /* ------------------------------------------------- floor stack shortcut
     One click: open the fixture selection, fly to it and show the stack
     already pulled apart - no geocoder, no hunting for the right building,
     and no waiting on a tileset pick (scene.pick costs a full render pass). */
  const runDemoStack = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const building = DEMO_BUILDING;
    globe.flyTo(building.lon, building.lat, 420, -42);
    setSelection({
      kind: "building",
      id: `demo:${building.id}`,
      lat: building.lat,
      lon: building.lon,
      properties: {
        kind: "building",
        name: building.name,
        origin: "demo-floor",
        scope: "stack",
        heightM: building.totalHeightM,
        levels: building.levels.length,
        osmId: building.id,
        source: building.evidence.source,
        focusLon: building.lon,
        focusLat: building.lat,
        focusM: 0,
      },
    });
    setRightOpen(true);
    setFloorOpen(true);
    setFloorExplosion(0.5);
    setFloorSelected(null);
  }, []);

  /* --------------------------------------------------------- base layers */
  const satelliteOn = active.includes("satellite");
  const streetOn = active.includes("street");
  const terrainOn = active.includes("terrain");
  const buildingsOn = active.includes("buildings");
  const adminOn = active.includes("admin");
  const parcelsOn = active.includes("parcels");

  useEffect(() => {
    if (!ready) return;
    globeRef.current?.setCompare(compare, compareYears[0], compareYears[1]);
  }, [ready, compare, compareYears]);

  useEffect(() => {
    if (!ready || compare) return;
    globeRef.current?.setImagery({ satellite: satelliteOn, street: streetOn, year });
  }, [ready, compare, satelliteOn, streetOn, year]);

  useEffect(() => {
    if (!ready) return;
    globeRef.current?.setTerrainOn(terrainOn);
  }, [ready, terrainOn]);

  useEffect(() => {
    if (!ready) return;
    globeRef.current?.setBuildings(buildingsOn, perf === "high" ? "full" : "coarse");
    patchRuntime("buildings", {
      state: buildingsOn ? "loading" : "idle",
      message: buildingsOn ? "Waiting on the viewport..." : "",
    });
  }, [ready, buildingsOn, perf, patchRuntime]);

  // The Ion tileset streams on its own and never reports through the Overpass
  // path, so its arrival has to be surfaced here or the row stays "waiting".
  useEffect(() => {
    if (!ready || !buildingsOn || status.buildings !== "tileset") return;
    patchRuntime("buildings", {
      state: "ready",
      message: "OSM Buildings tileset streaming for the current view",
    });
  }, [ready, buildingsOn, status.buildings, patchRuntime]);

  useEffect(() => {
    if (!ready) return;
    globeRef.current?.setAdmin(adminOn, states);
    patchRuntime("admin", {
      state: adminOn ? "ready" : "idle",
      message: adminOn ? `${states.length} state & UT outlines draped` : "",
      featureCount: adminOn ? states.length : 0,
    });
  }, [ready, adminOn, states, patchRuntime]);

  /* --------------------------------------------------------- choropleth */
  const choroLayer = useMemo(() => pickChoroplethLayer(active, layers), [active, layers]);
  const choroSpec = useMemo<ChoroplethSpec | null>(
    () =>
      choroLayer ? buildChoropleth({ layer: choroLayer, year, deltas, region, didStates }) : null,
    [choroLayer, year, deltas, region, didStates],
  );

  useEffect(() => {
    if (!ready) return;
    globeRef.current?.setChoropleth(!!choroSpec, states, choroSpec);
    if (choroLayer) {
      patchRuntime(choroLayer.id, {
        state: choroSpec ? "ready" : "empty",
        message: choroSpec
          ? `${choroSpec.colors ? Object.keys(choroSpec.colors).length : 0} state outlines painted — ${choroLayer.evidence.kind.toUpperCase()}`
          : "No value available for this layer at the current settings.",
      });
    }
  }, [ready, choroSpec, choroLayer, states, patchRuntime]);

  /* -------------------------------------------------------- study region */
  const studyShapes = useMemo(() => {
    const corridor = active.includes("policy-intervention");
    const zones = active.includes("policy-zones");
    if (!corridor && !zones) return [];
    return GEOGRAPHY_SHAPES.filter((s) => {
      const isCorridor = GROWTH_CORRIDOR_IDS.includes(s.id);
      if (isCorridor) return corridor;
      return zones;
    }).map((s) => {
      const geo = geographyById(s.id);
      const isCorridor = GROWTH_CORRIDOR_IDS.includes(s.id);
      return {
        id: s.id,
        ring: s.ring,
        name: geo?.name ?? s.id,
        color: isCorridor ? "#2f7a5f" : "#7f93ad",
      };
    });
  }, [active]);

  useEffect(() => {
    if (!ready) return;
    globeRef.current?.setStudyRegion(
      studyShapes.length > 0,
      studyShapes,
      REGION_OUTLINE_RING as [number, number][],
    );
    for (const id of ["policy-zones", "policy-intervention"]) {
      patchRuntime(id, {
        state: studyShapes.length > 0 ? "ready" : "idle",
        message:
          studyShapes.length > 0
            ? `${studyShapes.length} modelled corridor cells (SCENARIO geometry)`
            : "",
        featureCount: studyShapes.length,
      });
    }
  }, [ready, studyShapes, patchRuntime]);

  /* ------------------------------------------- viewport-bounded fetching */
  useEffect(() => {
    if (!ready || !viewport) return;
    const [w, s, e, n] = viewport.bbox;
    const bbox: [number, number, number, number] = [w, s, e, n];
    const span = Math.max(e - w, n - s);
    const range = viewport.rangeMeters;

    const kinds: OsmKind[] = [];
    // Ion's OSM Buildings tileset already covers the viewport when it loaded;
    // extruding our own footprints on top would double-draw the same city.
    const tilesetCoversBuildings = status.buildings === "tileset";
    if (buildingsOn && range < 70_000 && !tilesetCoversBuildings) kinds.push("buildings");
    if (active.includes("roads") && range < 400_000) kinds.push("roads");
    if (active.includes("water") && range < 400_000) kinds.push("water");
    if ((active.includes("protected") || active.includes("forest-esz")) && range < 700_000)
      kinds.push("protected");

    if (!parcelsOn && kinds.length === 0) return;

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        if (parcelsOn) {
          patchRuntime("parcels", { state: "loading", message: "Querying the parcel store…" });
          try {
            const res = await fetchGisParcels(bbox, ctrl.signal);
            if (ctrl.signal.aborted) return;
            globeRef.current?.setParcels(true, res.parcels);
            patchRuntime("parcels", {
              state: res.parcels.length ? "ready" : "empty",
              featureCount: res.parcels.length,
              message: res.parcels.length
                ? `${res.parcels.length} parcels in view`
                : res.emptyReason,
            });
          } catch {
            if (ctrl.signal.aborted) return;
            patchRuntime("parcels", {
              state: "error",
              message: "Parcel geometry unavailable for this region.",
            });
          }
        } else {
          globeRef.current?.setParcels(false, []);
        }

        for (const kind of kinds) {
          const id = OSM_LAYER_ID[kind];
          patchRuntime(id, { state: "loading", message: "Querying OpenStreetMap…" });
          try {
            const res = await fetchOsmFeatures(kind, bbox, ctrl.signal);
            if (ctrl.signal.aborted) return;
            globeRef.current?.setOsm(kind, true, res.features);
            patchRuntime(id, {
              state: res.features.length ? "ready" : "empty",
              featureCount: res.features.length,
              message: res.features.length
                ? `${res.features.length} ${kind} features${res.capped ? " (capped sample)" : ""}`
                : "No features of this type in the current bounding box.",
            });
            if (kind === "protected") {
              for (const other of ["forest-esz"]) {
                if (active.includes(other)) {
                  patchRuntime(other, {
                    state: res.features.length ? "ready" : "empty",
                    featureCount: res.features.length,
                    message: res.features.length
                      ? `${res.features.length} protected / reserved areas in view`
                      : "No protected areas in the current bounding box.",
                  });
                }
              }
            }
          } catch {
            if (ctrl.signal.aborted) return;
            patchRuntime(id, {
              state: "error",
              message: "OpenStreetMap did not answer within the attempt budget.",
            });
          }
        }
      })();
    }, 350);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [ready, viewport, active, parcelsOn, buildingsOn, status.buildings, patchRuntime]);

  // Layers switched off clear their own geometry immediately.
  useEffect(() => {
    if (!ready) return;
    if (!parcelsOn) globeRef.current?.setParcels(false, []);
    for (const kind of ["buildings", "roads", "water", "protected"] as OsmKind[]) {
      const on =
        kind === "buildings"
          ? buildingsOn
          : kind === "roads"
            ? active.includes("roads")
            : kind === "water"
              ? active.includes("water")
              : active.includes("protected") || active.includes("forest-esz");
      if (!on) globeRef.current?.setOsm(kind, false, []);
    }
    if (!active.includes("flood-risk")) {
      // NDEM has no 3D render path — nothing to clear, but the runtime stays honest.
      patchRuntime("flood-risk", { state: "idle", message: "" });
    }
  }, [ready, parcelsOn, buildingsOn, active, patchRuntime]);

  /* ------------------------------------------------- searched admin ring */
  useEffect(() => {
    if (!ready || !ringName) return;
    const ctrl = new AbortController();
    void (async () => {
      try {
        const hit = await fetchPlaceRing(ringName, ctrl.signal);
        if (ctrl.signal.aborted) return;
        globeRef.current?.setSearchedRing(ringName, hit ? hit.rings : null);
        if (!hit) {
          patchRuntime("admin", {
            state: "ready",
            message: `No published outline for “${ringName}” — camera moved without drawing a boundary.`,
          });
        }
      } catch {
        /* ring stays off; the message below is enough */
      }
    })();
    return () => ctrl.abort();
  }, [ready, ringName, patchRuntime]);

  /* ----------------------------------------------------- camera controls */
  const flyToCrumb = (c: Crumb) => globeRef.current?.flyTo(c.lon, c.lat, c.range, -55);

  const onPlaceSelected = useCallback(async (place: PlaceResult) => {
    setShowHits(false);
    setQuery(place.name);
    setSelection({ kind: "place", name: place.name, lat: place.lat, lon: place.lon });
    setCrumbs((prev) => {
      const next = [...prev];
      const idx = next.findIndex((c) => c.label.toLowerCase() === place.name.toLowerCase());
      if (idx >= 0) return next.slice(0, idx + 1);
      return [...next, { label: place.name, lat: place.lat, lon: place.lon, range: 18_000 }];
    });
    globeRef.current?.flyTo(place.lon, place.lat, 18_000, -55);
    setRingName(place.name);
    if (leftRef.current && window.innerWidth <= 980) setLeftOpen(false);
  }, []);

  useEffect(() => {
    if (!showHits || query.trim().length < 3) {
      if (!showHits) setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      searchPlaces(query.trim(), ctrl.signal)
        .then((r) => {
          if (!ctrl.signal.aborted) setHits(r);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setHits([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false);
        });
    }, 320);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, showHits]);

  const toggleLayer = (id: string) => {
    if (id === "before-after") {
      setCompare((c) => !c);
      return;
    }
    setActive((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const locateRegion = (r: string) => {
    const g = globeRef.current;
    if (!g) return;
    if (r === "All India") {
      g.flyHome();
      return;
    }
    const st = states.find((x) => x.name === r);
    if (!st || st.rings.length === 0) return;
    let w = 180,
      s = 90,
      e = -180,
      n = -90;
    for (const ring of st.rings) {
      for (const pt of ring) {
        const lon = pt[0] ?? 0;
        const lat = pt[1] ?? 0;
        if (lon < w) w = lon;
        if (lon > e) e = lon;
        if (lat < s) s = lat;
        if (lat > n) n = lat;
      }
    }
    g.flyToBBox([w, s, e, n]);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  /* -------------------------------------------------------------- render */
  const chorLegend = choroLayer?.legend ?? [];
  const firstLegend =
    chorLegend.length > 0
      ? chorLegend
      : (active.map((id) => gisLayer(id)).find((l) => l && l.legend.length > 0)?.legend ?? []);

  const selectedHeight =
    selection.kind === "building" && typeof selection.properties["heightM"] === "number"
      ? `${(selection.properties["heightM"] as number).toFixed(1)} m`
      : selection.kind === "building"
        ? "not tagged"
        : null;
  const askContext: AskContext = {
    selection:
      selection.kind === "none"
        ? "none"
        : selection.kind === "state" || selection.kind === "place"
          ? `${selection.kind}: ${selection.name}`
          : selection.kind === "building"
            ? `building ${String(selection.properties["name"] ?? selection.id)} (id ${selection.id}, height ${
                selectedHeight ?? "not tagged"
              }, source ${String(selection.properties["source"] ?? "OpenStreetMap")})`
            : `${selection.kind}: ${selection.id}`,
    activeLayers: active.map((id) => gisLayer(id)?.label ?? id),
    bbox: viewport?.bbox ?? null,
    rangeMeters: viewport?.rangeMeters ?? null,
    year,
    terrain: status.terrain === "real" ? "real" : status.terrain === "off" ? "off" : "ellipsoid",
    region,
    visualMode: BUILDING_MODES.find((m) => m.id === visualMode)?.label ?? visualMode,
    gisMode: floorOpen ? "enhanced-demo" : "standard",
  };

  if (failed) {
    return (
      <div className="g3d-root">
        <div className="g3d-loading">
          <div style={{ maxWidth: 520, textAlign: "center", padding: 24 }}>
            <b style={{ display: "block", marginBottom: 10 }}>The 3D globe could not start</b>
            <span style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.6 }}>
              CesiumJS failed to load in this browser or the /cesium static assets are missing.
              Nothing was faked — run <code>npm run postinstall</code> to copy the Cesium assets,
              then reload. The 2D maps remain fully available.
            </span>
            <div style={{ marginTop: 18 }}>
              <a
                className="g3d-cta"
                href="/dashboard"
                style={{
                  background: "#e7b84b",
                  color: "#17231d",
                  borderRadius: 9,
                  padding: "9px 15px",
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                Back to the dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="g3d-root">
      <header className="g3d-top">
        <a className="g3d-back" href="/">
          <ArrowLeft /> NIRVANA
        </a>
        <div className="g3d-title">
          <span>3D GIS EXPLORER</span>
          <h1>India · evidence-driven</h1>
        </div>

        <nav className="g3d-crumb" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} style={{ display: "contents" }}>
              {i > 0 && <i>/</i>}
              <button type="button" onClick={() => flyToCrumb(c)}>
                {c.label}
              </button>
            </span>
          ))}
        </nav>

        <div className="g3d-search">
          <div className="g3d-search-box">
            <Search />
            <input
              value={query}
              placeholder="Search district, taluka or city in India…"
              aria-label="Search place"
              onChange={(e) => {
                setQuery(e.target.value);
                setShowHits(true);
              }}
              onFocus={() => setShowHits(true)}
            />
            {searching && <span className="g3d-spin" aria-hidden="true" />}
          </div>
          {showHits && query.trim().length >= 3 && (
            <div className="g3d-search-list">
              {hits.length === 0 ? (
                <p className="g3d-search-note">
                  {searching ? "Searching Nominatim…" : "No match in India for that query."}
                </p>
              ) : (
                hits.map((h) => (
                  <button
                    type="button"
                    className="g3d-search-item"
                    key={`${h.lat}-${h.lon}-${h.displayName}`}
                    onClick={() => void onPlaceSelected(h)}
                  >
                    <strong>{h.name}</strong>
                    <span>{h.displayName}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="g3d-top-tools">
          <button
            className="g3d-tbtn"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => globeRef.current?.zoomStep(1)}
          >
            <Minus />
          </button>
          <button
            className="g3d-tbtn"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => globeRef.current?.zoomStep(-1)}
          >
            <Plus />
          </button>
          <button className="g3d-tbtn" title="Home" onClick={() => globeRef.current?.flyHome()}>
            <Home />
          </button>
          <button
            className="g3d-tbtn"
            title="Use my location"
            onClick={() => void globeRef.current?.locateMe()}
          >
            <LocateFixed />
          </button>
          <button
            className="g3d-tbtn"
            title="Reset bearing"
            onClick={() => globeRef.current?.resetBearing()}
          >
            <Compass />
          </button>
          <button
            className={`g3d-tbtn ${mode === "2d" ? "on" : ""}`}
            title="Toggle 2D / 3D"
            onClick={() => {
              const next = mode === "3d" ? "2d" : "3d";
              setMode(next);
              globeRef.current?.setMode(next);
            }}
          >
            {mode === "3d" ? "3D" : "2D"}
          </button>
          <button
            className="g3d-tbtn"
            title="Performance mode"
            onClick={() => {
              const next = PERF_ORDER[(PERF_ORDER.indexOf(perf) + 1) % PERF_ORDER.length] ?? "high";
              setPerf(next);
              globeRef.current?.setPerf(next);
            }}
          >
            {perf === "high" ? "HIGH" : perf === "medium" ? "MED" : "LOW"}
          </button>
          <button className="g3d-tbtn" title="Fullscreen" onClick={toggleFullscreen}>
            <Maximize2 />
          </button>
          <button
            className={`g3d-tbtn wide ${active.includes("satellite") ? "on" : ""}`}
            title="Toggle satellite imagery"
            onClick={() => toggleLayer("satellite")}
          >
            <Layers3 /> IMAGERY
          </button>
        </div>
      </header>

      <main className="g3d-stage" ref={stageRef}>
        <div className="g3d-globe" ref={containerRef} />

        {/* -------------------------------------------- camera + mode cluster */}
        <div className="g3d-toolrow">
          <div className="g3d-toolgroup" role="group" aria-label="Camera presets">
            <button
              className="g3d-vbtn"
              title="North up, keeping the current tilt"
              onClick={() => globeRef.current?.setViewPreset("north")}
            >
              NORTH
            </button>
            <button
              className="g3d-vbtn"
              title="Top-down / nadir view"
              onClick={() => globeRef.current?.setViewPreset("top")}
            >
              TOP
            </button>
            <button
              className="g3d-vbtn"
              title="45° oblique view"
              onClick={() => globeRef.current?.setViewPreset("oblique45")}
            >
              45°
            </button>
            <button
              className="g3d-vbtn"
              title="Isometric view"
              onClick={() => globeRef.current?.setViewPreset("isometric")}
            >
              ISO
            </button>
            <span className="g3d-vsep" aria-hidden="true" />
            <button
              className="g3d-vbtn"
              title="Rotate 45° left"
              onClick={() => globeRef.current?.stepHeading(-45)}
            >
              −45°
            </button>
            <button
              className="g3d-vbtn"
              title="Rotate 45° right"
              onClick={() => globeRef.current?.stepHeading(45)}
            >
              +45°
            </button>
            <button
              className={`g3d-vbtn ${camera.orbiting ? "on" : ""}`}
              title="Continuous 360° turntable around the current focus"
              onClick={() => globeRef.current?.setOrbit(!camera.orbiting)}
            >
              <RotateCw /> {camera.orbiting ? "STOP" : "ORBIT"}
            </button>
            <span className="g3d-vread" title="Camera heading and tilt">
              {camera.headingDeg}° · {Math.abs(camera.pitchDeg)}°
            </span>
          </div>

          <div className="g3d-toolgroup" role="group" aria-label="Building rendering mode">
            {BUILDING_MODES.map((m) => (
              <button
                key={m.id}
                className={`g3d-vbtn ${visualMode === m.id ? "on" : ""}`}
                title={m.title}
                aria-pressed={visualMode === m.id}
                onClick={() => setVisualMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {visualMode === "height" && (
            <div className="g3d-toolgroup g3d-toolnote">
              <span className="g3d-hchip unknown">
                OSM Buildings has no per-feature height — hover a building for its measured storeys
              </span>
            </div>
          )}

          {/* Straight to the demo fixture - no geocoder, no hunting on the map. */}
          <div className="g3d-toolgroup" role="group" aria-label="Demo building">
            <button
              className="g3d-vbtn g3d-vbtn-demo"
              title="Fly to the Patna demo building and open the floor separation stack"
              onClick={runDemoStack}
            >
              <Building2 /> FLOOR STACK
            </button>
          </div>
        </div>

        {/* ------------------------------------------------- hover readout */}
        {ready && hover && (
          <div className="g3d-hovertip" style={{ left: hover.x, top: hover.y }} role="status">
            <strong>{hover.title}</strong>
            {hover.detail && <span>{hover.detail}</span>}
          </div>
        )}

        {!ready && !failed && <div className="g3d-loading">Loading CesiumJS globe…</div>}

        {ready && status.terrain === "loading" && (
          <p className="g3d-banner">
            <b>Probing terrain…</b> asking Cesium World Terrain; if it cannot be reached the globe
            stays on the WGS84 ellipsoid and the status bar will say so.
          </p>
        )}
        {ready && status.terrain === "ellipsoid" && (
          <p className="g3d-banner">
            <b>No relief loaded.</b> The terrain provider did not answer, so elevation is reported
            as unavailable rather than estimated.
          </p>
        )}

        {/* ------------------------------------------------------ left panel */}
        <aside
          className={`g3d-panel g3d-left ${leftOpen ? "open" : ""}`}
          aria-label="Layer manager"
        >
          <div className="g3d-panel-head">
            <div>
              <span className="g3d-eyebrow">LAYER MANAGER</span>
              <h2>What is on the globe</h2>
            </div>
            <button
              type="button"
              className="g3d-x"
              aria-label="Close layer manager"
              onClick={() => setLeftOpen(false)}
            >
              <X />
            </button>
          </div>
          <div className="g3d-panel-body">
            <GisLayerManager
              layers={layers}
              active={active}
              runtimes={runtimes}
              onToggle={toggleLayer}
              onInfo={(l) => setInfo(l.id)}
            />
            <p className="g3d-hint">
              DATA UPDATED {DATA_UPDATED}. Layers marked “Not connected” are listed because the spec
              requires them, and disabled because no licensed dataset is wired — nothing is drawn to
              fill the gap.
            </p>
          </div>
        </aside>

        {/* ----------------------------------------------------- right panel */}
        <aside className={`g3d-panel g3d-right ${rightOpen ? "open" : ""}`} aria-label="Inspector">
          <div className="g3d-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "inspect"}
              className={tab === "inspect" ? "on" : ""}
              onClick={() => setTab("inspect")}
            >
              INSPECT
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "ask"}
              className={tab === "ask" ? "on" : ""}
              onClick={() => setTab("ask")}
            >
              ASK BHUMI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "scenario"}
              className={tab === "scenario" ? "on" : ""}
              onClick={() => setTab("scenario")}
            >
              SCENARIO
            </button>
            <button
              type="button"
              className="g3d-x"
              aria-label="Close inspector"
              onClick={() => setRightOpen(false)}
            >
              <X />
            </button>
          </div>
          <div className="g3d-panel-body">
            {tab === "inspect" && (
              <>
                <SelectionHeader
                  selection={selection}
                  onClear={() => setSelection({ kind: "none" })}
                />
                <GisIntelPanel selection={selection} year={year} onInfo={setInfo} />
                {demoAvailable && (
                  <GisFloorStack
                    record={DEMO_BUILDING}
                    open={floorOpen}
                    explosion={floorExplosion}
                    selected={floorSelected}
                    onOpen={(next) => {
                      setFloorOpen(next);
                      if (!next) {
                        setFloorExplosion(0);
                        setFloorSelected(null);
                      }
                    }}
                    onExplosion={setFloorExplosion}
                    onSelect={setFloorSelected}
                    onLocate={() =>
                      globeRef.current?.flyTo(DEMO_BUILDING.lon, DEMO_BUILDING.lat, 420, -42)
                    }
                  />
                )}
              </>
            )}
            {tab === "ask" && (
              <GisAskBhumi
                context={askContext}
                onFlyTo={(place, lat, lon, zoom) => {
                  if (lat !== null && lon !== null) {
                    globeRef.current?.flyTo(lon, lat, zoom ? 40_000 / zoom : 20_000, -55);
                    setSelection({ kind: "place", name: place, lat, lon });
                    setCrumbs((prev) => [
                      ...prev,
                      { label: place, lat, lon, range: zoom ? 40_000 / zoom : 20_000 },
                    ]);
                  }
                  setTab("inspect");
                }}
              />
            )}
            {tab === "scenario" && (
              <GisScenarioDrawer
                region={region}
                year={year}
                deltas={deltas}
                didStates={didStates}
                onRegion={setRegion}
                onDeltas={setDeltas}
                onDid={(s) => setDidStates(s)}
                onLocate={locateRegion}
              />
            )}
          </div>
        </aside>

        {/* -------------------------------------------------- mobile toggles */}
        <button
          type="button"
          className="g3d-drawer-toggle left"
          onClick={() => setLeftOpen((v) => !v)}
        >
          <Layers3 /> Layers
        </button>
        <button
          type="button"
          className="g3d-drawer-toggle right"
          onClick={() => setRightOpen((v) => !v)}
        >
          <Info /> Inspect
        </button>

        {/* -------------------------------------------------------- legend */}
        {firstLegend.length > 0 && (
          <div className="g3d-legendbar">
            <strong>{choroLayer ? choroLayer.label : "Legend"}</strong>
            <div className="g3d-legend">
              {firstLegend.map((entry) => (
                <span key={entry.label}>
                  <i style={{ background: entry.color }} />
                  {entry.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------ timeline */}
        <div className="g3d-timeline">
          <span className="g3d-tl-label">{compare ? "COMPARE" : "TIMELINE"}</span>
          {compare ? (
            <div style={{ display: "flex", gap: 7, alignItems: "center", flex: 1 }}>
              <select
                aria-label="Left year"
                value={compareYears[0]}
                onChange={(e) => setCompareYears([Number(e.target.value), compareYears[1]])}
                style={{
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  fontSize: 10,
                  flex: 1,
                }}
              >
                {TIME_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted-foreground)" }}>
                vs
              </span>
              <select
                aria-label="Right year"
                value={compareYears[1]}
                onChange={(e) => setCompareYears([compareYears[0], Number(e.target.value)])}
                style={{
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  fontSize: 10,
                  flex: 1,
                }}
              >
                {TIME_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="g3d-years"
                onClick={() => setCompare(false)}
                style={{
                  padding: "6px 9px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <div className="g3d-years">
              {TIME_YEARS.map((y) => (
                <button
                  type="button"
                  key={y}
                  className={y === year ? "on" : ""}
                  onClick={() => setYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`g3d-tbtn ${compare ? "on" : ""}`}
            style={{
              borderColor: "rgba(23,35,29,.2)",
              color: compare ? "#17231d" : "var(--foreground)",
              background: compare ? "#e7b84b" : "transparent",
            }}
            onClick={() => setCompare((c) => !c)}
            title="Before / after split compare"
          >
            SPLIT
          </button>
        </div>

        {/* ------------------------------------------------ split divider */}
        {compare && (
          <>
            <div
              className="g3d-split"
              style={{ left: `${splitPos * 100}%` }}
              onPointerDown={(ev) => {
                ev.currentTarget.setPointerCapture(ev.pointerId);
                const stage = ev.currentTarget.parentElement;
                if (!stage) return;
                const move = (e: PointerEvent) => {
                  const rect = stage.getBoundingClientRect();
                  const p = Math.min(0.95, Math.max(0.05, (e.clientX - rect.left) / rect.width));
                  setSplitPos(p);
                  globeRef.current?.setSplitPosition(p);
                };
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            />
            <span className="g3d-split-tag" style={{ left: `${splitPos * 100}%` }}>
              {compareYears[0]} | {compareYears[1]}
            </span>
          </>
        )}

        {/* ------------------------------------------------------ bottom bar */}
        <div className="g3d-bottom">
          <span className="g3d-live">
            <i
              className={
                status.terrain === "real" ? "" : status.terrain === "loading" ? "warn" : "bad"
              }
            />
            {status.terrain === "real"
              ? "Terrain: Cesium World Terrain"
              : status.terrain === "loading"
                ? "Terrain: probing…"
                : status.terrain === "off"
                  ? "Terrain: off (ellipsoid)"
                  : "Terrain: unavailable (ellipsoid)"}
          </span>
          <span className="g3d-live">
            <i
              className={
                status.buildings === "tileset" ? "" : status.buildings === "off" ? "bad" : "warn"
              }
            />
            {status.buildings === "tileset"
              ? "3D buildings: OSM Buildings tileset"
              : status.buildings === "extrusions"
                ? "3D buildings: OSM extrusions"
                : status.buildings === "off"
                  ? "3D buildings: off"
                  : "3D buildings: idle"}
          </span>
          <span className="g3d-live" title="Globe operating mode">
            <i className={floorOpen ? "warn" : ""} />
            {floorOpen ? "Mode: enhanced demo (floor stack)" : "Mode: standard"}
          </span>
          <span className="g3d-coords">
            {viewport
              ? `bbox ${viewport.bbox.map((v) => v.toFixed(2)).join(", ")} · ${(
                  viewport.rangeMeters / 1000
                ).toFixed(0)} km`
              : "national view"}
          </span>
          <div className="g3d-credit cesium-widget-credit" ref={creditRef} />
        </div>

        {/* ---------------------------------------------------------- modal */}
        {info && (
          <div
            className="g3d-modal-back"
            role="dialog"
            aria-modal="true"
            aria-label="Layer data info"
            onClick={() => setInfo(null)}
          >
            <div className="g3d-modal" onClick={(e) => e.stopPropagation()}>
              <EvidenceBody layerId={info} />
              <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="g3d-x"
                  onClick={() => setInfo(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function pickToSelection(p: import("./globe/CesiumGlobe").GlobePick | null): Selection {
  if (!p) return { kind: "none" };
  const props = p.properties;
  if (p.kind === "state") {
    return { kind: "state", name: String(props["name"] ?? "State"), lat: p.lat, lon: p.lon };
  }
  if (p.kind === "building") {
    return { kind: "building", id: p.id, lat: p.lat, lon: p.lon, properties: props };
  }
  if (p.kind === "parcel") {
    return { kind: "parcel", id: p.id, lat: p.lat, lon: p.lon, properties: props };
  }
  if (p.kind === "place" || p.kind === "region") {
    return {
      kind: "place",
      name: String(props["name"] ?? props["label"] ?? p.id),
      lat: p.lat,
      lon: p.lon,
    };
  }
  return { kind: "place", name: p.id, lat: p.lat, lon: p.lon };
}
