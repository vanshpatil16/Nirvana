/**
 * Owns the CesiumJS `Viewer` for the 3D GIS Explorer.
 *
 * Design notes:
 *  - Cesium is imported DYNAMICALLY inside `init()` so the module (several MB)
 *    is never part of the SSR graph and never blocks the rest of the app.
 *  - No Cesium Ion token is ever required or committed. Ion-backed assets
 *    (world terrain, OSM Buildings) are *probed*; if they fail the globe keeps
 *    running on the WGS84 ellipsoid / Overpass extrusions and reports the real
 *    status up the chain so the UI can say so.
 *  - Nothing is ever drawn that did not come from a named source: every entity
 *    carries an id prefix + properties so the inspector can explain it.
 */
import { resolveFloors } from "@/services/gis3d/buildingFloors";
import type { PerfMode, Viewport } from "../types";

/** Type-only reference so `tsc` sees the module without bundling it here. */
type CesiumModule = typeof import("cesium");

export type GlobePickKind = "parcel" | "building" | "state" | "region" | "place" | "none";

export interface GlobePick {
  kind: GlobePickKind;
  id: string;
  lat: number;
  lon: number;
  properties: Record<string, unknown>;
}

/**
 * Native `Cesium3DTileStyle` rendering mode for the single OSM Buildings
 * tileset. Every mode restyles the SAME tileset - no tileset is ever created,
 * cloned or rebuilt per mode.
 */
export type BuildingVisualMode = "standard" | "height" | "footprint" | "inspection";

export const BUILDING_MODE_LABEL: Record<BuildingVisualMode, string> = {
  standard: "Standard",
  height: "Height",
  footprint: "Footprint",
  inspection: "Inspection",
};

/** Cursor-following readout for whatever is under the pointer. */
export interface GlobeHover {
  /** Canvas-relative pixels (same space as `scene.pick`). */
  x: number;
  y: number;
  title: string;
  detail: string | null;
}

/** A horizontal slab of the demo floor stack, in metres above the ellipsoid. */
export interface FloorStackSpec {
  lon: number;
  lat: number;
  /** Outer ring, degrees, `[lon, lat]` pairs. */
  footprint: number[][];
  levels: { floorIndex: number; floorCode: string; baseM: number; heightM: number }[];
  totalHeightM: number;
}

export interface GlobeStatus {
  terrain: "loading" | "real" | "ellipsoid" | "off";
  buildings: "idle" | "tileset" | "extrusions" | "off";
  /** Live attribution strings for the bottom bar. */
  credits: string[];
}

export interface GlobeCameraInfo {
  headingDeg: number;
  pitchDeg: number;
  orbiting: boolean;
}

export interface ChoroplethSpec {
  /** state name â†’ fill colour (CSS) */
  colors: Record<string, string>;
  /** state name â†’ short value shown in the inspector */
  values: Record<string, string>;
}

export interface GlobeHooks {
  onViewport: (v: Viewport) => void;
  onPick: (p: GlobePick | null) => void;
  onStatus: (s: GlobeStatus) => void;
  onReady?: () => void;
  /** Cursor readout, or null when the pointer leaves anything pickable. */
  onHover?: (h: GlobeHover | null) => void;
  /** Heading/pitch readout, used by the camera preset cluster. */
  onCamera?: (c: GlobeCameraInfo) => void;
}

// EOX serves EPSG:3857 tiles in plain XYZ order (y counts from the north).
// Flipping y/x here silently returns blank blue tiles, so the globe renders
// the mirrored hemisphere and the map looks like it never loaded.
const SATELLITE_YEAR_URL = (year: number) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`;

const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const SAT_CREDIT = "Copernicus Sentinel-2 cloudless mosaic © EOX";
const OSM_CREDIT = "© OpenStreetMap contributors";

export class CesiumGlobe {
  private C: CesiumModule | null = null;
  private viewer: import("cesium").Viewer | null = null;
  private hooks: GlobeHooks;

  private streetLayer: import("cesium").ImageryLayer | null = null;
  private satLayer: import("cesium").ImageryLayer | null = null;
  private satLayerB: import("cesium").ImageryLayer | null = null;

  private statePrimitives = new Map<string, string[]>();
  private parcelEntities: string[] = [];
  private osmEntities = new Map<string, string[]>();
  private regionEntities: string[] = [];
  private adminEntities: string[] = [];
  private adminRings: { name: string; rings: number[][][] }[] = [];
  private ringEntities = new Map<string, string[]>();

  private tileset: import("cesium").Cesium3DTileset | null = null;
  private tilesetRequested = false;
  private hoveredId: string | null = null;
  private hoverCursorOn = false;
  private lastHover: { x: number; y: number; key: string } | null = null;

  /** The single tileset is restyled in place - never recreated - per mode. */
  private buildingMode: BuildingVisualMode = "standard";
  private buildingSelectedId: string | null = null;
  /**
   * Ion's OSM Buildings tileset ships without batch-table properties, so a
   * `Cesium3DTileStyle` condition can never match the clicked feature. The
   * highlight therefore rides on `Cesium3DTileFeature.color`, which the style
   * engine overwrites whenever it (re)evaluates - `tintRefresh` re-stamps the
   * picked feature for a few frames after every style change.
   */
  private selectedFeature: import("cesium").Cesium3DTileFeature | null = null;
  private tintRefresh = 0;
  private tintHandler: (() => void) | null = null;
  /** Orbit / preset centre: falls back to the camera's ground point. */
  private focusTarget: { lon: number; lat: number; height: number } | null = null;
  private orbitFrame: number | null = null;
  private orbiting = false;
  private floorEntities: string[] = [];
  private floorSpec: FloorStackSpec | null = null;
  private floorExplosion = 0;
  private floorSelected: number | null = null;
  /** Ground elevation sampled once per floor-stack creation, metres. */
  private floorGroundM: number | null = null;

  private status: GlobeStatus = {
    terrain: "loading",
    buildings: "off",
    credits: [SAT_CREDIT],
  };

  private realTerrain: import("cesium").TerrainProvider | null = null;
  private terrainOn = true;

  private destroyed = false;
  private perf: PerfMode = "high";
  private mode: "2d" | "3d" = "3d";
  private compare = false;
  private splitPos = 0.5;

  constructor(hooks: GlobeHooks) {
    this.hooks = hooks;
  }

  /* ------------------------------------------------------------ lifecycle */

  async init(container: HTMLElement, creditContainer: HTMLElement): Promise<boolean> {
    if (typeof window === "undefined") return false;
    // The globe only ever exists in the browser. Keeping this as a literal SSR
    // guard lets the bundler drop the dynamic `import("cesium")` from the server
    // graph entirely â€” Cesium is several MB and must never ship with the worker.
    if (import.meta.env.SSR) return false;
    // Runtime guarantee for buildModuleUrl(): Cesium reads the bare global
    // `CESIUM_BASE_URL`. The vite `define` covers bundled builds; this covers
    // any path where the define does not reach Cesium's own source.
    (window as unknown as Record<string, string>)["CESIUM_BASE_URL"] = "/cesium/";
    ensureWidgetsCss("/cesium/Widgets/widgets.css");

    let C: CesiumModule;
    try {
      C = await import("cesium");
    } catch {
      return false;
    }
    if (this.destroyed) return false;
    this.C = C;

    try {
      const viewer = new C.Viewer(container, {
        baseLayer: false,
        terrainProvider: new C.EllipsoidTerrainProvider(),
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer,
      });
      // DPR capped so a retina laptop does not double the globe's fill cost.
      viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);
      this.viewer = viewer;
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>)["__g3dGlobe"] = this;
      }
    } catch {
      return false;
    }

    const viewer = this.viewer;
    // Where imagery has not arrived yet the globe must read as "nothing drawn"
    // rather than as a pale landmass - the shell colour is the same dark as the
    // app chrome, so unloaded tiles never masquerade as data.
    viewer.scene.globe.baseColor = C.Color.fromCssColorString("#17231D");
    viewer.scene.backgroundColor = C.Color.fromCssColorString("#17231D");
    // Ground/sky atmosphere scatter hard when the camera sits thousands of
    // kilometres up - the whole disc washes to white and buries the imagery.
    // This route trades on true colour, so both are switched off.
    viewer.scene.globe.showGroundAtmosphere = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.highDynamicRange = false;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 25;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 60_000_000;

    viewer.screenSpaceEventHandler.setInputAction(
      (evt: { position: import("cesium").Cartesian2 }) => this.pick(evt.position),
      C.ScreenSpaceEventType.LEFT_CLICK,
    );
    viewer.screenSpaceEventHandler.setInputAction(
      (evt: { endPosition: import("cesium").Cartesian2 }) => this.hover(evt.endPosition),
      C.ScreenSpaceEventType.MOUSE_MOVE,
    );

    let lastEmit = 0;
    viewer.camera.changed.addEventListener(() => {
      if (this.destroyed) return;
      const now = Date.now();
      if (now - lastEmit < 220) return;
      lastEmit = now;
      this.emitViewport();
    });
    viewer.camera.moveEnd.addEventListener(() => {
      this.emitViewport();
    });

    this.emitViewport();
    void this.probeTerrain();
    this.hooks.onReady?.();
    this.emitStatus();
    this.requestRender();
    return true;
  }

  private emitStatus(): void {
    this.hooks.onStatus({ ...this.status, credits: [...this.status.credits] });
  }

  private emitViewport(): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const height = viewer.camera.positionCartographic?.height ?? 1_000_000;
    const bbox = this.viewBBox();
    this.hooks.onViewport({ bbox, rangeMeters: height, cameraHeight: height });
  }

  /**
   * Screen-space extent of the globe, in degrees.
   *
   * `Camera.computeViewRectangle()` bails out with `Rectangle.MAX_VALUE` from
   * high altitude - it only samples the four canvas corners, and from 7 500 km
   * up the whole planet sits inside those corners, so every pick misses. A
   * small grid over the canvas is used instead, which works at any altitude.
   */
  private viewBBox(): [number, number, number, number] {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return [-180, -85, 180, 85];
    const canvas = viewer.scene.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cols = 5;
    const rows = 5;
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    let hits = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cartesian = viewer.camera.pickEllipsoid(
          new C.Cartesian2((w * i) / (cols - 1), (h * j) / (rows - 1)),
          C.Ellipsoid.WGS84,
        );
        if (!cartesian) continue;
        const carto = C.Cartographic.fromCartesian(cartesian);
        const lon = C.Math.toDegrees(carto.longitude);
        const lat = C.Math.toDegrees(carto.latitude);
        if (lon < west) west = lon;
        if (lon > east) east = lon;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
        hits += 1;
      }
    }
    if (hits < 2) return this.estimatedBBox();
    return [west, south, east, north];
  }

  /** Frustum-derived stand-in used only when no grid sample lands on the globe. */
  private estimatedBBox(): [number, number, number, number] {
    const C = this.C;
    const viewer = this.viewer;
    const carto = viewer?.camera.positionCartographic;
    if (!C || !viewer || !carto) return [-180, -85, 180, 85];
    const frustum = viewer.camera.frustum;
    const fov = (frustum instanceof C.PerspectiveFrustum ? frustum.fov : undefined) ?? Math.PI / 3;
    const aspect = (frustum instanceof C.PerspectiveFrustum ? frustum.aspectRatio : undefined) ?? 1;
    const halfV = C.Math.toDegrees(fov) / 2;
    const halfH = C.Math.toDegrees(Math.atan(Math.tan(fov / 2) * aspect));
    // The visible cap can never be wider than the horizon as seen from centre.
    const radius = C.Ellipsoid.WGS84.maximumRadius;
    const horizon = C.Math.toDegrees(
      Math.acos(Math.min(1, radius / (radius + Math.max(0, carto.height)))),
    );
    const v = Math.min(halfV, horizon);
    const hh = Math.min(halfH, horizon);
    const lon = C.Math.toDegrees(carto.longitude);
    const lat = C.Math.toDegrees(carto.latitude);
    return [
      Math.max(-180, lon - hh),
      Math.max(-85, lat - v),
      Math.min(180, lon + hh),
      Math.min(85, lat + v),
    ];
  }

  private requestRender(): void {
    this.viewer?.scene.requestRender();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopOrbit();
    if (this.tintHandler && this.viewer) {
      this.viewer.scene.postRender.removeEventListener(this.tintHandler);
      this.tintHandler = null;
    }
    this.selectedFeature = null;
    const C = this.C;
    if (this.viewer && C) {
      try {
        this.viewer.destroy();
      } catch {
        /* already gone */
      }
    }
    this.viewer = null;
  }

  /* -------------------------------------------------------------- terrain */

  /**
   * Probe Ion world terrain. Uses Cesium's bundled default Ion token when no
   * `VITE_CESIUM_ION_TOKEN` is configured â€” if that is rate-limited or blocked
   * we fall back to the ellipsoid and say so, rather than showing fake relief.
   */
  private async probeTerrain(): Promise<void> {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const token = import.meta.env["VITE_CESIUM_ION_TOKEN"] as string | undefined;
    if (token) {
      try {
        C.Ion.defaultAccessToken = token;
      } catch {
        /* leave bundled token in place */
      }
    }
    try {
      const provider = await Promise.race([
        C.createWorldTerrainAsync({ requestWaterMask: false, requestVertexNormals: false }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("terrain timeout")), 9000),
        ),
      ]);
      if (this.destroyed || !this.viewer) return;
      this.realTerrain = provider;
      if (this.terrainOn) {
        this.viewer.terrainProvider = provider;
        this.status.terrain = "real";
      }
    } catch {
      if (this.destroyed) return;
      this.status.terrain = "ellipsoid";
    }
    this.emitStatus();
    this.requestRender();
  }

  /** Terrain layer toggle: off puts the globe back on the WGS84 ellipsoid. */
  setTerrainOn(on: boolean): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    this.terrainOn = on;
    if (!on) {
      viewer.terrainProvider = new C.EllipsoidTerrainProvider();
      this.status.terrain = "off";
      this.emitStatus();
      this.requestRender();
      return;
    }
    if (this.realTerrain) {
      viewer.terrainProvider = this.realTerrain;
      this.status.terrain = "real";
      this.emitStatus();
      this.requestRender();
    } else {
      this.status.terrain = "loading";
      this.emitStatus();
      void this.probeTerrain();
    }
  }

  /* ------------------------------------------------------------- imagery */

  private imagery(C: CesiumModule, year: number): import("cesium").ImageryProvider {
    return new C.UrlTemplateImageryProvider({
      url: SATELLITE_YEAR_URL(year),
      maximumLevel: 16,
      credit: new C.Credit(SAT_CREDIT, false),
    });
  }

  /**
   * Rebuild the imagery stack. Street tiles sit underneath; satellite tiles
   * composite over them so the two can be used together as a hybrid view.
   * Compare mode takes over the stack entirely (handled in setCompare).
   */
  setImagery(opts: { satellite: boolean; street: boolean; year: number }): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    if (this.compare) return; // setCompare() owns the stack while comparing
    const layers = viewer.imageryLayers;
    const credits: string[] = [];

    if (this.satLayerB) {
      layers.remove(this.satLayerB, true);
      this.satLayerB = null;
    }
    if (this.satLayer) {
      layers.remove(this.satLayer, true);
      this.satLayer = null;
    }
    if (this.streetLayer) {
      layers.remove(this.streetLayer, true);
      this.streetLayer = null;
    }

    if (opts.street) {
      this.streetLayer = layers.addImageryProvider(
        new C.OpenStreetMapImageryProvider({
          url: OSM_TILE_URL,
          credit: new C.Credit(OSM_CREDIT, false),
        }),
      );
      credits.push(OSM_CREDIT);
    }
    if (opts.satellite) {
      this.satLayer = layers.addImageryProvider(this.imagery(C, opts.year));
      this.satLayer.splitDirection = C.SplitDirection.NONE;
      // Hybrid view when both are on: OSM labels stay readable under the mosaic.
      this.satLayer.alpha = opts.street ? 0.45 : 1;
      credits.unshift(SAT_CREDIT);
    }

    this.status.credits = credits.length ? credits : [SAT_CREDIT];
    this.emitStatus();
    this.requestRender();
  }

  setCompare(on: boolean, yearA: number, yearB: number): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const layers = viewer.imageryLayers;
    if (this.satLayer) {
      layers.remove(this.satLayer, true);
      this.satLayer = null;
    }
    if (this.satLayerB) {
      layers.remove(this.satLayerB, true);
      this.satLayerB = null;
    }
    if (this.streetLayer) {
      layers.remove(this.streetLayer, true);
      this.streetLayer = null;
    }
    this.compare = on;
    if (!on) {
      viewer.scene.splitPosition = 0.5;
      this.status.credits = [SAT_CREDIT];
      this.emitStatus();
      this.requestRender();
      return;
    }
    this.satLayer = layers.addImageryProvider(this.imagery(C, yearA));
    this.satLayer.splitDirection = C.SplitDirection.LEFT;
    this.satLayerB = layers.addImageryProvider(this.imagery(C, yearB));
    this.satLayerB.splitDirection = C.SplitDirection.RIGHT;
    viewer.scene.splitPosition = this.splitPos;
    this.status.credits = [SAT_CREDIT, OSM_CREDIT];
    this.emitStatus();
    this.requestRender();
  }

  setSplitPosition(pos: number): void {
    if (!this.viewer || !this.compare) return;
    this.splitPos = Math.min(0.95, Math.max(0.05, pos));
    this.viewer.scene.splitPosition = this.splitPos;
    this.requestRender();
  }

  getSplitPosition(): number {
    return this.splitPos;
  }

  /* ------------------------------------------------------------- buildings */

  /**
   * Buildings layer toggle.
   *
   * The OSM Buildings tileset is created at most once for the life of the
   * viewer and from then on is only shown or hidden - `tileset.show`. Nothing
   * is fetched, rebuilt or restyled by toggling, and no second tileset is ever
   * created while one exists.
   */
  setBuildings(on: boolean, detail: "full" | "coarse"): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const sse = detail === "coarse" ? 20 : 8;
    if (this.tileset) this.tileset.maximumScreenSpaceError = sse;

    if (!on) {
      this.clearGroup(this.osmEntities);
      if (this.tileset) this.tileset.show = false;
      this.status.buildings = "off";
      this.emitStatus();
      this.requestRender();
      return;
    }

    if (this.tileset) {
      this.tileset.show = true;
      this.status.buildings = "tileset";
      this.emitStatus();
      this.requestRender();
      return;
    }

    if (this.tilesetRequested) return;
    this.tilesetRequested = true;
    void C.createOsmBuildingsAsync()
      .then((tileset) => {
        if (this.destroyed || !this.viewer || !this.C) return;
        tileset.maximumScreenSpaceError = sse;
        // Guard against a toggle that turned the layer off while loading.
        tileset.show = true;
        this.tileset = this.viewer.scene.primitives.add(tileset);
        // Any footprint extrusions fetched while the tileset was still in
        // flight would render the same buildings twice - drop them here.
        this.clearExtrusionKind("buildings");
        this.applyBuildingStyle();
        this.status.buildings = "tileset";
        this.emitStatus();
        this.requestRender();
      })
      .catch(() => {
        if (this.destroyed) return;
        this.status.buildings = "extrusions";
        this.emitStatus();
      });
    this.status.buildings = "extrusions";
    this.emitStatus();
  }

  /** Drop only the extruded-footprint copy of one OSM kind. */
  private clearExtrusionKind(kind: string): void {
    const ids = this.osmEntities.get(kind);
    if (!ids || !this.viewer) return;
    for (const id of ids) this.viewer.entities.removeById(id);
    this.osmEntities.delete(kind);
  }

  /**
   * Restyle the one buildings tileset. `Cesium3DTileStyle` re-evaluates on the
   * GPU, so switching modes costs no new tile requests and no DOM work.
   */
  setBuildingStyle(mode: BuildingVisualMode, selectedId: string | null): void {
    this.buildingMode = mode;
    this.buildingSelectedId = selectedId;
    // A cleared id means the selection moved off the tileset - drop the tint.
    if (selectedId === null) this.selectedFeature = null;
    this.applyBuildingStyle();
    this.requestRender();
  }

  private applyBuildingStyle(): void {
    const C = this.C;
    const tileset = this.tileset;
    if (!C || !tileset) return;
    // Dimming is keyed on the *live* feature, not on the selection id: if the
    // tile that owned it unloaded there is nothing left to tint, and dimming
    // every other building without a highlight would read as a bug.
    const anySelected = this.selectedFeature ? "true" : "false";

    /* Ion's OSM Buildings tileset ships no batch table: every feature reports
       the same estimated height and exposes no id, so a per-feature condition
       (height band, storey band, id hash) can never match. The one thing the
       style language can still do is pick a colour, so each mode gets a
       deliberate one - warm, saturated, and clearly distinguishable over
       satellite imagery instead of the washed-out teal this used to be.
       Per-building colour needs a source that carries properties; until then
       the floor readout in the tooltip and the evidence card is where the
       per-building detail lives. */
    const flat = (hex: string, alpha: string) => ({
      conditions: [
        [anySelected, "color('#0c292f', 0.28)"],
        ["true", `color('${hex}', ${alpha})`],
      ],
    });

    const byMode: Record<BuildingVisualMode, object> = {
      standard: { color: flat("#F2A31C", "0.9") },
      height: { color: flat("#E0561C", "0.9") },
      footprint: {
        color: {
          conditions: [
            [anySelected, "color('#071a1e', 0.22)"],
            ["true", "color('#0d7a4f', 0.35)"],
          ],
        },
      },
      /* Inspection pushes the context forward: the rest of the city drops back
         so the selected building reads without hiding the streets around it. */
      inspection: { color: flat("#2E9FB5", "0.42") },
    };

    try {
      tileset.style = new C.Cesium3DTileStyle(byMode[this.buildingMode]);
    } catch {
      // A malformed style must never take the globe down - keep the last one.
      return;
    }
    if (this.selectedFeature) {
      this.tintRefresh = 6;
      this.ensureTintHandler();
    }
  }

  /** Re-stamp the picked feature after the style engine wipes its colour. */
  private ensureTintHandler(): void {
    const scene = this.viewer?.scene;
    if (!scene || this.tintHandler) return;
    this.tintHandler = () => {
      if (this.tintRefresh <= 0 || !this.selectedFeature) return;
      this.tintRefresh -= 1;
      this.applySelectionTint();
      this.requestRender();
    };
    scene.postRender.addEventListener(this.tintHandler);
  }

  private applySelectionTint(): void {
    const C = this.C;
    const feature = this.selectedFeature;
    if (!C || !feature) return;
    try {
      feature.color = C.Color.fromCssColorString("#00f3ff").withAlpha(0.95);
    } catch {
      // The tile that owned this feature went away - drop the highlight rather
      // than retry it on every frame.
      this.selectedFeature = null;
      this.tintRefresh = 0;
    }
  }

  private removeTileset(): void {
    this.stopOrbit();
    if (this.tileset && this.viewer) {
      try {
        this.viewer.scene.primitives.remove(this.tileset);
      } catch {
        /* already removed */
      }
    }
    this.tileset = null;
    this.tilesetRequested = false;
  }

  /* ------------------------------------------------------------ vectors */

  private clearGroup(group: Map<string, string[]> | string[]): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const ids = Array.isArray(group) ? group : [...group.values()].flat();
    for (const id of ids) viewer.entities.removeById(id);
    if (!Array.isArray(group)) group.clear();
    else group.length = 0;
  }

  private addPolygon(
    id: string,
    rings: number[][][],
    opts: {
      fill?: string;
      alpha?: number;
      outline?: boolean;
      outlineColor?: string;
      outlineWidth?: number;
      height?: number;
      extrudedHeight?: number;
      clamp?: boolean;
      properties?: Record<string, unknown>;
      show?: boolean;
    },
  ): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const flat: number[] = [];
    for (const ring of rings) {
      if (ring.length < 3) continue;
      // Rings beyond the first are treated as separate entities' parts; simple
      // polygon rings are pushed in order and Cesium closes them itself.
      for (const pt of ring) flat.push(pt[0] ?? 0, pt[1] ?? 0);
      if (flat.length && (flat[flat.length - 2] !== flat[0] || flat[flat.length - 1] !== flat[1])) {
        flat.push(flat[0] ?? 0, flat[1] ?? 0);
      }
    }
    if (flat.length < 6) return;
    const hierarchy = C.Cartesian3.fromDegreesArray(flat);
    viewer.entities.add({
      id,
      show: opts.show !== false,
      polygon: {
        hierarchy,
        material: opts.fill
          ? C.Color.fromCssColorString(opts.fill).withAlpha(opts.alpha ?? 0.35)
          : C.Color.TRANSPARENT,
        outline: opts.outline ?? false,
        outlineColor: opts.outlineColor
          ? C.Color.fromCssColorString(opts.outlineColor)
          : C.Color.fromCssColorString("#3d5a45"),
        outlineWidth: opts.outlineWidth ?? 1,
        // Clamped features keep `height` / `extrudedHeight` relative to the
        // ground surface, so extrusions sit on the terrain wherever it exists
        // and on the ellipsoid where it does not â€” no elevation is invented.
        heightReference: opts.clamp ? C.HeightReference.CLAMP_TO_GROUND : C.HeightReference.NONE,
        ...(opts.height !== undefined ? { height: opts.height } : {}),
        ...(opts.extrudedHeight !== undefined ? { extrudedHeight: opts.extrudedHeight } : {}),
      },
      ...(opts.properties ? { properties: opts.properties } : {}),
    });
  }

  private addLine(
    id: string,
    ring: number[][],
    opts: { color: string; width?: number; properties?: Record<string, unknown> },
  ): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    if (ring.length < 2) return;
    const flat: number[] = [];
    for (const pt of ring) flat.push(pt[0] ?? 0, pt[1] ?? 0);
    viewer.entities.add({
      id,
      polyline: {
        positions: C.Cartesian3.fromDegreesArray(flat),
        width: opts.width ?? 1.5,
        material: C.Color.fromCssColorString(opts.color),
        clampToGround: true,
      },
      ...(opts.properties ? { properties: opts.properties } : {}),
    });
  }

  /** State / UT outlines â€” draped polylines, always cheap. */
  setAdmin(show: boolean, rings: { name: string; rings: number[][][] }[]): void {
    this.adminRings = rings;
    const viewer = this.viewer;
    if (!viewer) return;
    this.clearGroup(this.adminEntities);
    if (!show) {
      this.requestRender();
      return;
    }
    rings.forEach((r, i) => {
      r.rings.forEach((ring, j) => {
        const id = `admin:${i}:${j}`;
        this.adminEntities.push(id);
        this.addLine(id, ring, { color: "#5c7f5c", width: 1.4 });
      });
    });
    this.requestRender();
  }

  /** Searched district/taluka/city ring. */
  setSearchedRing(name: string, rings: number[][][] | null): void {
    const viewer = this.viewer;
    if (!viewer) return;
    this.clearGroup(this.ringEntities);
    if (!rings) {
      this.requestRender();
      return;
    }
    const key = name;
    rings.forEach((ring, j) => {
      const id = `ring:${key}:${j}`;
      const list = this.ringEntities.get(key) ?? [];
      list.push(id);
      this.ringEntities.set(key, list);
      this.addPolygon(id, [ring], {
        fill: "#2f6fb5",
        alpha: 0.08,
        outline: true,
        outlineColor: "#2f6fb5",
        outlineWidth: 2,
        clamp: true,
        properties: { kind: "place", name: key },
      });
      this.addLine(`ringline:${key}:${j}`, ring, { color: "#2f6fb5", width: 2.5 });
    });
    this.requestRender();
  }

  setParcels(
    show: boolean,
    parcels: { id: string; rings: number[][][]; properties: Record<string, unknown> }[],
  ): void {
    const viewer = this.viewer;
    if (!viewer) return;
    this.clearGroup(this.parcelEntities);
    if (!show) {
      this.requestRender();
      return;
    }
    parcels.forEach((p, i) => {
      const id = `parcel:${i}:${p.id}`;
      this.parcelEntities.push(id);
      this.addPolygon(id, p.rings, {
        fill: "#0d7a4f",
        alpha: 0.26,
        outline: true,
        outlineColor: "#0d7a4f",
        outlineWidth: 1.5,
        clamp: true,
        properties: { kind: "parcel", ...p.properties, id: p.id },
      });
    });
    this.requestRender();
  }

  setOsm(
    kind: string,
    show: boolean,
    features: { id: string; rings: number[][][]; height: number | null }[],
  ): void {
    const viewer = this.viewer;
    if (!viewer) return;
    const existing = this.osmEntities.get(kind) ?? [];
    for (const id of existing) viewer.entities.removeById(id);
    this.osmEntities.delete(kind);
    if (!show) {
      this.requestRender();
      return;
    }
    const ids: string[] = [];
    const color =
      kind === "buildings"
        ? "#cbbfa9"
        : kind === "roads"
          ? "#b08a4a"
          : kind === "water"
            ? "#2878d0"
            : "#1f7a3f";
    features.forEach((f, i) => {
      const id = `osm:${kind}:${i}`;
      ids.push(id);
      if (kind === "buildings") {
        // Only extrude what OSM actually tags with a height / level count.
        if (typeof f.height === "number" && f.height > 0) {
          this.addPolygon(id, f.rings, {
            fill: color,
            alpha: 0.72,
            outline: true,
            outlineColor: "#8d8271",
            height: 0,
            extrudedHeight: f.height,
            clamp: true,
            properties: { kind: "building", heightM: f.height, osmId: f.id },
          });
        } else {
          this.addPolygon(id, f.rings, {
            fill: color,
            alpha: 0.2,
            outline: true,
            outlineColor: "#a89c88",
            height: 0,
            clamp: true,
            properties: { kind: "building", heightM: null, osmId: f.id },
          });
        }
      } else if (kind === "roads") {
        f.rings.forEach((ring, j) => this.addLine(`${id}:${j}`, ring, { color, width: 1.4 }));
      } else {
        this.addPolygon(id, f.rings, {
          fill: color,
          alpha: kind === "water" ? 0.5 : 0.28,
          outline: kind !== "water",
          outlineColor: color,
          clamp: true,
          properties: { kind: "osm", osmKind: kind },
        });
        if (kind === "water") {
          f.rings.forEach((ring, j) => this.addLine(`${id}:${j}`, ring, { color, width: 1 }));
        }
      }
    });
    this.osmEntities.set(kind, ids);
    this.requestRender();
  }

  setChoropleth(
    show: boolean,
    states: { name: string; rings: number[][][] }[],
    spec: ChoroplethSpec | null,
  ): void {
    const viewer = this.viewer;
    if (!viewer) return;
    this.clearGroup(this.statePrimitives);
    if (!show || !spec) {
      this.requestRender();
      return;
    }
    states.forEach((s, i) => {
      const fill = spec.colors[s.name];
      if (!fill) return;
      s.rings.forEach((ring, j) => {
        const id = `state:${i}:${j}`;
        const list = this.statePrimitives.get(s.name) ?? [];
        list.push(id);
        this.statePrimitives.set(s.name, list);
        this.addPolygon(id, [ring], {
          fill,
          alpha: 0.5,
          outline: true,
          outlineColor: "#3d5a45",
          outlineWidth: 1,
          clamp: true,
          properties: { kind: "state", name: s.name, value: spec.values[s.name] ?? "" },
        });
      });
    });
    this.requestRender();
  }

  setStudyRegion(
    show: boolean,
    shapes: { id: string; ring: [number, number][]; name?: string; color?: string }[],
    outline: [number, number][] | null,
  ): void {
    const viewer = this.viewer;
    if (!viewer) return;
    this.clearGroup(this.regionEntities);
    if (!show) {
      this.requestRender();
      return;
    }
    shapes.forEach((s, i) => {
      const ring = s.ring.map((p) => [p[0], p[1]]);
      const id = `region:${i}:${s.id}`;
      this.regionEntities.push(id);
      this.addPolygon(id, [ring], {
        fill: s.color ?? "#7f93ad",
        alpha: 0.32,
        outline: true,
        outlineColor: "#3f5877",
        clamp: true,
        properties: { kind: "region", name: s.name ?? s.id, id: s.id },
      });
    });
    if (outline && outline.length > 2) {
      const id = "region:outline";
      this.regionEntities.push(id);
      this.addLine(
        id,
        outline.map((p) => [p[0], p[1]]),
        { color: "#2f4f6f", width: 2 },
      );
    }
    this.requestRender();
  }

  /* -------------------------------------------------------- floor stack */

  /**
   * Draw the demo building's floor slabs, or clear them with `null`.
   *
   * Levels are supplied in metres ABOVE GROUND: the ground sample is taken
   * once from the loaded terrain so the stack sits on the real surface rather
   * than on a made-up elevation. Every slab is a DEMO fixture (see
   * `demoBuilding.ts`) and never a claim about a surveyed building.
   */
  setFloorStack(spec: FloorStackSpec | null): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    this.clearFloorStack();
    this.floorSpec = spec;
    if (!spec) {
      this.requestRender();
      return;
    }

    const draw = (groundM: number) => {
      const v = this.viewer;
      if (!v || !this.floorSpec) return;
      for (const level of this.floorSpec.levels) {
        const id = `floor:${level.floorIndex}`;
        const base = groundM + level.baseM + this.explosionOffset(level.floorIndex);
        v.entities.add({
          id,
          show: true,
          polygon: {
            hierarchy: this.polygonHierarchy(this.floorSpec.footprint),
            height: base,
            extrudedHeight: base + level.heightM,
            material: C.Color.fromCssColorString(this.floorColor(level.floorIndex)).withAlpha(
              this.floorAlpha(level.floorIndex),
            ),
            outline: true,
            outlineColor: C.Color.fromCssColorString(
              this.floorSelected === level.floorIndex ? "#ffffff" : "#E7B84B",
            ).withAlpha(this.floorSelected === level.floorIndex ? 0.95 : 0.5),
            heightReference: C.HeightReference.NONE,
          },
          label: {
            text: `${level.floorCode}`,
            font: "600 11px ui-sans-serif, system-ui, sans-serif",
            fillColor: C.Color.fromCssColorString("#F8F7F1"),
            outlineColor: C.Color.fromCssColorString("#17231D"),
            outlineWidth: 3,
            pixelOffset: new C.Cartesian2(0, -14),
            show: new C.ConstantProperty(this.floorExplosion > 0.05 || this.floorSelected !== null),
          },
          properties: {
            kind: "building",
            name: `Level ${level.floorCode} · demo floor`,
            heightM: level.heightM,
            origin: "demo-floor",
          },
        });
        this.floorEntities.push(id);
      }
      this.requestRender();
    };

    void this.sampleGround([spec.lon], [spec.lat])
      .then((samples) => {
        if (this.destroyed || !this.floorSpec) return;
        const value = samples[0];
        const ground = typeof value === "number" && Number.isFinite(value) ? value : 0;
        this.floorGroundM = ground;
        draw(ground);
      })
      .catch(() => {
        if (this.destroyed || !this.floorSpec) return;
        this.floorGroundM = 0;
        draw(0);
      });
  }

  private polygonHierarchy(ring: number[][]): import("cesium").Cartesian3[] {
    const C = this.C;
    if (!C) return [];
    const flat: number[] = [];
    for (const pt of ring) flat.push(pt[0] ?? 0, pt[1] ?? 0);
    if (
      flat.length >= 4 &&
      (flat[flat.length - 2] !== flat[0] || flat[flat.length - 1] !== flat[1])
    ) {
      flat.push(flat[0] ?? 0, flat[1] ?? 0);
    }
    return C.Cartesian3.fromDegreesArray(flat);
  }

  private explosionOffset(floorIndex: number): number {
    if (this.floorExplosion <= 0) return 0;
    return this.floorExplosion * (floorIndex + 1) * 4.5;
  }

  private floorColor(floorIndex: number): string {
    if (this.floorSelected === floorIndex) return "#00f3ff";
    const level = this.floorSpec?.levels.find((l) => l.floorIndex === floorIndex);
    return level?.floorCode === "B1" || level?.floorCode === "G" ? "#2FA37A" : "#188f9a";
  }

  private floorAlpha(floorIndex: number): number {
    if (this.floorSelected === floorIndex) return 0.9;
    if (this.floorSelected !== null) return 0.18;
    return this.floorExplosion > 0.05 ? 0.75 : 0.55;
  }

  /** Explosion 0..1 plus the highlighted floor; repaints slabs in place. */
  setFloorExplosion(factor: number, selectedFloorIndex: number | null): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    this.floorExplosion = Math.min(1, Math.max(0, factor));
    this.floorSelected = selectedFloorIndex;
    if (!this.floorSpec || this.floorEntities.length === 0) return;
    // Ground was sampled once when the stack was created - dragging the slider
    // must never fire a fresh terrain sample per frame.
    this.repositionFloors(this.floorGroundM ?? 0);
  }

  private repositionFloors(groundM: number): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer || !this.floorSpec) return;
    for (const level of this.floorSpec.levels) {
      const entity = viewer.entities.getById(`floor:${level.floorIndex}`);
      if (!entity?.polygon) continue;
      const base = groundM + level.baseM + this.explosionOffset(level.floorIndex);
      entity.polygon.height = new C.ConstantProperty(base);
      entity.polygon.extrudedHeight = new C.ConstantProperty(base + level.heightM);
      if (entity.polygon.material instanceof C.ColorMaterialProperty) {
        entity.polygon.material.color = new C.ConstantProperty(
          C.Color.fromCssColorString(this.floorColor(level.floorIndex)).withAlpha(
            this.floorAlpha(level.floorIndex),
          ),
        );
      }
      if (entity.polygon.outlineColor)
        (entity.polygon.outlineColor as import("cesium").ConstantProperty).setValue(
          C.Color.fromCssColorString(
            this.floorSelected === level.floorIndex ? "#ffffff" : "#E7B84B",
          ).withAlpha(this.floorSelected === level.floorIndex ? 0.95 : 0.5),
        );
      if (entity.label?.show)
        (entity.label.show as import("cesium").ConstantProperty).setValue(
          this.floorExplosion > 0.05 || this.floorSelected !== null,
        );
    }
    this.requestRender();
  }

  private clearFloorStack(): void {
    const viewer = this.viewer;
    if (viewer) for (const id of this.floorEntities) viewer.entities.removeById(id);
    this.floorEntities = [];
    this.floorSpec = null;
    this.floorExplosion = 0;
    this.floorSelected = null;
    this.floorGroundM = null;
  }

  /* ---------------------------------------------------------- highlight */

  private hover(pos: import("cesium").Cartesian2): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const picked = viewer.scene.pick(pos) as
      | { id?: { id?: string; name?: string; properties?: Record<string, unknown> } }
      | import("cesium").Cesium3DTileFeature
      | undefined;
    const feature = this.asTilesetFeature(picked);
    const entityId = feature
      ? null
      : ((picked as { id?: { id?: string } } | undefined)?.id?.id ?? null);

    if (entityId !== this.hoveredId) {
      this.setHighlight(this.hoveredId, false);
      this.hoveredId = entityId;
      this.setHighlight(entityId, true);
      this.requestRender();
    }
    const cursorOn = entityId !== null || feature !== null;
    if (cursorOn !== this.hoverCursorOn) {
      this.hoverCursorOn = cursorOn;
      (viewer.container as HTMLElement).style.cursor = cursorOn ? "pointer" : "";
    }

    const info = feature
      ? this.featureReadout(feature)
      : entityId
        ? this.entityReadout(entityId)
        : null;
    const key = info ? `${info.title}|${info.detail ?? ""}` : "";
    const prev = this.lastHover;
    const moved = !prev || Math.abs(prev.x - pos.x) > 6 || Math.abs(prev.y - pos.y) > 6;
    if (prev && !moved && prev.key === key) return;
    this.lastHover = { x: pos.x, y: pos.y, key };
    this.hooks.onHover?.(
      info ? { x: pos.x, y: pos.y, title: info.title, detail: info.detail } : null,
    );
  }

  /** A `scene.pick` result is a tileset feature only when it came from our tileset. */
  private asTilesetFeature(picked: unknown): import("cesium").Cesium3DTileFeature | null {
    const f = picked as import("cesium").Cesium3DTileFeature | undefined;
    if (!f || typeof f.getProperty !== "function") return null;
    if (this.tileset && f.primitive !== this.tileset) return null;
    return f;
  }

  /**
   * A real tagged height, or null.
   *
   * `cesium#estimatedHeight` is deliberately NOT trusted: Ion's OSM Buildings
   * reports the same 3 m for every feature, so treating it as a measurement
   * made every building look identical (and gave every building one floor).
   * Only OSM's own `height` / `building:height` tags count as a measurement.
   */
  private featureHeightM(feature: import("cesium").Cesium3DTileFeature): number | null {
    for (const key of ["height", "building:height"]) {
      const value = Number(feature.getProperty(key));
      if (Number.isFinite(value) && value > 1 && value < 1000) return value;
    }
    return null;
  }

  private featureReadout(feature: import("cesium").Cesium3DTileFeature): {
    title: string;
    detail: string | null;
  } {
    const name = feature.getProperty("name");
    const title = typeof name === "string" && name.trim() ? name.trim() : "Building";
    const height = this.featureHeightM(feature);
    const levels = Number(feature.getProperty("building:levels"));
    // Every building gets a storey count: the real one when OSM tagged it,
    // otherwise one derived (or, with no data at all, a modelled stand-in).
    // The asterisk marks anything that is not the tagged value.
    const floors = resolveFloors(
      Number.isFinite(levels) && levels > 0 ? levels : null,
      height,
      feature.featureId,
    );
    const bits: string[] = [];
    if (height !== null) bits.push(`~${Math.round(height)} m`);
    const word = floors.floors === 1 ? "floor" : "floors";
    bits.push(floors.basis === "tagged" ? `${floors.floors} ${word}` : `${floors.floors} ${word}*`);
    return { title, detail: bits.length ? bits.join(" · ") : "height not tagged" };
  }

  private entityReadout(id: string): { title: string; detail: string | null } | null {
    const entity = this.viewer?.entities.getById(id);
    if (!entity) return null;
    const raw = (entity.properties ?? {}) as Record<string, unknown>;
    const read = (k: string): unknown => {
      const v = raw[k];
      return v && typeof (v as { getValue?: () => unknown }).getValue === "function"
        ? (v as { getValue: () => unknown }).getValue()
        : v;
    };
    const name =
      entity.name ?? (typeof read("name") === "string" ? (read("name") as string) : null) ?? null;
    const kind = typeof read("kind") === "string" ? (read("kind") as string) : "";
    const osmKind = typeof read("osmKind") === "string" ? (read("osmKind") as string) : "";
    // Entities built from footprints carry no name - fall back to what they
    // actually are rather than showing a raw id at the cursor.
    const title =
      name ??
      (kind === "building"
        ? "Building"
        : kind === "parcel"
          ? "Land parcel"
          : kind === "region"
            ? "Policy region"
            : kind === "osm"
              ? osmKind === "roads"
                ? "Road"
                : osmKind === "water"
                  ? "Water body"
                  : osmKind === "protected"
                    ? "Protected area"
                    : "OpenStreetMap feature"
              : null);
    if (!title) return null;
    const height = read("heightM");
    const detail =
      typeof height === "number" && height > 0
        ? `~${height.toFixed(1)} m tagged`
        : kind === "building"
          ? "height not tagged"
          : null;
    return { title, detail };
  }

  private setHighlight(id: string | null, on: boolean): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer || !id) return;
    const entity = viewer.entities.getById(id);
    if (!entity) return;
    if (entity.polygon) {
      entity.polygon.outlineWidth = new C.ConstantProperty(on ? 3 : 1.5);
      if (entity.polygon.outlineColor)
        (entity.polygon.outlineColor as import("cesium").ConstantProperty).setValue(
          C.Color.fromCssColorString(on ? "#004e2b" : "#3d5a45"),
        );
    }
  }

  private pick(pos: import("cesium").Cartesian2): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    // A click always hands control back to the user.
    this.stopOrbit();
    const picked = viewer.scene.pick(pos) as
      | { id?: { id?: string; properties?: Record<string, unknown> } }
      | import("cesium").Cesium3DTileFeature
      | undefined;
    const feature = this.asTilesetFeature(picked);
    const entity = feature
      ? undefined
      : (picked as { id?: { id?: string; properties?: Record<string, unknown> } } | undefined)?.id;
    const world = viewer.camera.pickEllipsoid(pos);
    const carto = world ? C.Cartographic.fromCartesian(world) : null;
    const lon = carto ? C.Math.toDegrees(carto.longitude) : 0;
    const lat = carto ? C.Math.toDegrees(carto.latitude) : 0;

    // 3D tiles: pick the actual surface point so the camera can orbit the
    // clicked spot rather than the ground far behind it.
    if (feature) {
      let focusLon = lon;
      let focusLat = lat;
      let focusM = 0;
      if (viewer.scene.pickPositionSupported) {
        const surface = viewer.scene.pickPosition(pos);
        if (surface) {
          const scarto = C.Cartographic.fromCartesian(surface);
          focusLon = C.Math.toDegrees(scarto.longitude);
          focusLat = C.Math.toDegrees(scarto.latitude);
          focusM = scarto.height;
        }
      }
      const osmId = feature.getProperty("osm_id") ?? feature.getProperty("id");
      const levels = Number(feature.getProperty("building:levels"));
      const name = feature.getProperty("name");
      /* Ion's OSM Buildings reports the same estimated height (3 m) for every
         feature and carries no per-feature tags, so the floor count is derived
         from a stable per-feature seed and labelled MODELLED - a cosmetic
         stand-in until a source with real building:levels is wired in. */
      const taggedHeight = this.featureHeightM(feature);
      const heightM = taggedHeight;
      const floors = resolveFloors(
        Number.isFinite(levels) && levels > 0 ? levels : null,
        heightM,
        feature.featureId,
      );
      this.selectedFeature = feature;
      this.tintRefresh = 0;
      this.focusTarget = { lon: focusLon, lat: focusLat, height: focusM };
      this.hooks.onPick({
        kind: "building",
        id: `tileset:${osmId ?? feature.featureId}`,
        lat: focusLat,
        lon: focusLon,
        properties: {
          kind: "building",
          name: typeof name === "string" && name.trim() ? name.trim() : "Building",
          heightM,
          levels: Number.isFinite(levels) && levels > 0 ? levels : null,
          floors: floors.floors,
          floorBasis: floors.basis,
          floorNote: floors.note,
          osmId: osmId === undefined || osmId === null ? null : String(osmId),
          source: "OpenStreetMap 3D Buildings tileset (Cesium)",
          origin: "tileset-feature",
          focusLon,
          focusLat,
          focusM,
        },
      });
      return;
    }

    if (!entity?.id) {
      // State outlines are polylines, so a click on the land between them hits
      // nothing - resolve the point against the in-repo state rings instead of
      // leaving the evidence card empty.
      const state = carto ? this.stateAt(lon, lat) : null;
      if (state) {
        this.hooks.onPick({
          kind: "state",
          id: `state:${state}`,
          lat,
          lon,
          properties: { name: state },
        });
        return;
      }
      this.hooks.onPick(null);
      return;
    }

    if (entity.id.startsWith("admin:")) {
      const state = carto ? this.stateAt(lon, lat) : null;
      if (state) {
        this.hooks.onPick({
          kind: "state",
          id: `state:${state}`,
          lat,
          lon,
          properties: { name: state },
        });
        return;
      }
    }

    const raw = entity.properties ?? {};
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      properties[k] = (v as { getValue?: () => unknown })?.getValue
        ? (v as { getValue: () => unknown }).getValue()
        : v;
    }
    const kind = (properties["kind"] as string | undefined) ?? "none";
    this.focusTarget = { lon, lat, height: 0 };
    properties["focusLon"] = lon;
    properties["focusLat"] = lat;
    properties["focusM"] = 0;
    this.hooks.onPick({
      kind: (kind === "none" ? "place" : kind) as GlobePick["kind"],
      id: entity.id,
      lat,
      lon,
      properties,
    });
  }

  private stateAt(lon: number, lat: number): string | null {
    for (const admin of this.adminRings) {
      let crossings = 0;
      for (const ring of admin.rings) {
        if (pointInRing(ring, lon, lat)) crossings++;
      }
      if (crossings % 2 === 1) return admin.name;
    }
    return null;
  }

  /* -------------------------------------------------------------- camera */

  /* ------------------------------------------- camera presets & orbiting */

  /** Preset / orbit centre: the last picked point, else the ground below camera. */
  private orbitTarget(): { lon: number; lat: number; height: number } | null {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return null;
    if (this.focusTarget) return this.focusTarget;
    const carto = viewer.camera.positionCartographic;
    if (!carto) return null;
    return {
      lon: C.Math.toDegrees(carto.longitude),
      lat: C.Math.toDegrees(carto.latitude),
      height: 0,
    };
  }

  private emitCamera(): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer || !this.hooks.onCamera) return;
    const twoPi = Math.PI * 2;
    let heading = Math.round((((viewer.camera.heading % twoPi) + twoPi) % twoPi) * (180 / Math.PI));
    // Rounding a heading of 359.7° gives 360 - fold it back to 0.
    if (heading >= 360) heading -= 360;
    this.hooks.onCamera({
      headingDeg: heading,
      pitchDeg: Math.round(C.Math.toDegrees(viewer.camera.pitch)),
      orbiting: this.orbiting,
    });
  }

  private rangeTo(target: { lon: number; lat: number; height: number }): number {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return 400;
    const center = C.Cartesian3.fromDegrees(target.lon, target.lat, target.height);
    const distance = C.Cartesian3.distance(viewer.camera.position, center);
    return Math.min(Math.max(distance, 60), 40_000);
  }

  /**
   * Shared path behind every preset and every ±45° step: one
   * `flyToBoundingSphere` around the current target, ending with an identity
   * transform so later camera maths stays in world space.
   */
  private orient(opts: {
    pitchDeg: number;
    headingDeg?: number;
    range?: number;
    duration?: number;
  }): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const target = this.orbitTarget();
    if (!target) return;
    this.stopOrbit();
    const center = C.Cartesian3.fromDegrees(target.lon, target.lat, target.height);
    const range = opts.range ?? this.rangeTo(target);
    const heading = opts.headingDeg ?? C.Math.toDegrees(viewer.camera.heading);
    const finish = () => {
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      this.emitCamera();
    };
    viewer.camera.flyToBoundingSphere(new C.BoundingSphere(center, 0), {
      duration: opts.duration ?? 1.0,
      offset: new C.HeadingPitchRange(
        C.Math.toRadians(heading),
        C.Math.toRadians(opts.pitchDeg),
        range,
      ),
      endTransform: C.Matrix4.IDENTITY,
      complete: finish,
      cancel: finish,
    });
    this.emitCamera();
  }

  /** NORTH / TOP / 45° / ISOMETRIC camera presets. */
  setViewPreset(preset: "north" | "top" | "oblique45" | "isometric"): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const pitch = Math.round(C.Math.toDegrees(viewer.camera.pitch));
    if (preset === "top") {
      this.orient({ pitchDeg: -90, headingDeg: 0 });
      return;
    }
    if (preset === "oblique45") {
      this.orient({ pitchDeg: -45 });
      return;
    }
    if (preset === "isometric") {
      this.orient({ pitchDeg: -30, headingDeg: 45 });
      return;
    }
    // North keeps the current tilt unless we are looking straight down.
    this.orient({ pitchDeg: pitch < -75 ? -45 : pitch, headingDeg: 0 });
  }

  /** ±45° step rotation around the current target. */
  stepHeading(deltaDeg: number): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const pitch = Math.max(-89, Math.round(C.Math.toDegrees(viewer.camera.pitch)));
    this.orient({
      headingDeg: C.Math.toDegrees(viewer.camera.heading) + deltaDeg,
      pitchDeg: pitch,
      duration: 0.55,
    });
  }

  /**
   * True 360° turntable: a requestAnimationFrame loop that recentres the camera
   * on the target every frame. Returns the resulting state.
   */
  setOrbit(on: boolean): boolean {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return false;
    if (!on || this.orbiting) {
      this.stopOrbit();
      return false;
    }
    const target = this.orbitTarget();
    if (!target) return false;
    const center = C.Cartesian3.fromDegrees(target.lon, target.lat, target.height);
    let heading = viewer.camera.heading;
    let pitch = viewer.camera.pitch;
    // A nadir or horizon pitch reads badly while turning - settle it first.
    if (pitch < -1.4) pitch = -1.0;
    else if (pitch > -0.15) pitch = -0.5;
    const range = Math.min(
      Math.max(C.Cartesian3.distance(viewer.camera.position, center), 65),
      8_000,
    );

    this.orbiting = true;
    this.emitCamera();
    let lastTick = 0;
    const loop = () => {
      if (!this.orbiting || this.destroyed || !this.viewer) return;
      heading = (heading + 0.006) % (Math.PI * 2);
      this.viewer.camera.lookAt(center, new C.HeadingPitchRange(heading, pitch, range));
      this.viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      this.viewer.scene.requestRender();
      // The heading readout would otherwise freeze for the whole turntable.
      const now = performance.now();
      if (now - lastTick > 200) {
        lastTick = now;
        this.emitCamera();
      }
      this.orbitFrame = requestAnimationFrame(loop);
    };
    this.orbitFrame = requestAnimationFrame(loop);
    return true;
  }

  private stopOrbit(): void {
    if (this.orbitFrame !== null) {
      cancelAnimationFrame(this.orbitFrame);
      this.orbitFrame = null;
    }
    if (!this.orbiting) return;
    this.orbiting = false;
    if (this.viewer && this.C) this.viewer.camera.lookAtTransform(this.C.Matrix4.IDENTITY);
    this.emitCamera();
  }

  flyTo(lon: number, lat: number, rangeMeters: number, tiltDeg = -55, duration = 2.2): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    this.stopOrbit();
    this.focusTarget = { lon, lat, height: 0 };
    const target = C.Cartesian3.fromDegrees(lon, lat, 0);
    viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target, Math.max(50, rangeMeters)), {
      duration,
      offset: new C.HeadingPitchRange(
        C.Math.toRadians(0),
        C.Math.toRadians(this.mode === "2d" ? -89 : tiltDeg),
        Math.max(50, rangeMeters),
      ),
    });
  }
  flyToBBox(bbox: [number, number, number, number], duration = 2.2): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const rect = C.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]);
    viewer.camera.flyTo({ destination: rect, duration });
  }

  zoomStep(direction: 1 | -1): void {
    const viewer = this.viewer;
    if (!viewer) return;
    const camera = viewer.camera;
    camera.cancelFlight();
    const height = camera.positionCartographic?.height ?? 0;
    const amount = Math.max(40, height * 0.4);
    if (direction > 0) camera.zoomOut(amount);
    else camera.zoomIn(amount);
    viewer.scene.requestRender();
    this.emitViewport();
  }

  flyHome(duration = 2.4): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    const destination = C.Cartesian3.fromDegrees(82.0, 22.5, 7_500_000);
    const orientation = {
      heading: 0,
      pitch: C.Math.toRadians(-90),
      roll: 0,
    };
    // A zero-length fly interpolation leaves the camera in a bad frame, so the
    // instant case jumps with setView instead.
    if (duration <= 0) {
      viewer.camera.setView({ destination, orientation });
      viewer.scene.requestRender();
      return;
    }
    viewer.camera.flyTo({ destination, orientation, duration });
  }

  resetBearing(duration = 1.2): void {
    const viewer = this.viewer;
    const C = this.C;
    if (!viewer || !C) return;
    const carto = viewer.camera.positionCartographic;
    if (!carto) return;
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
      orientation: { heading: 0, pitch: viewer.camera.pitch, roll: 0 },
      duration,
    });
  }

  setMode(mode: "2d" | "3d", duration = 1.2): void {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer) return;
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === "2d") viewer.scene.morphTo2D(duration);
    else viewer.scene.morphTo3D(duration);
    setTimeout(() => this.requestRender(), duration * 1000 + 100);
  }

  /** Best-effort device geolocation â†’ fly there. Returns false when denied. */
  async locateMe(): Promise<boolean> {
    if (!navigator.geolocation) return false;
    const pos = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { timeout: 8000, maximumAge: 300_000 },
      );
    });
    if (!pos) return false;
    this.flyTo(pos.coords.longitude, pos.coords.latitude, 1500, -60, 1.8);
    return true;
  }

  setPerf(mode: PerfMode): void {
    const viewer = this.viewer;
    if (!viewer) return;
    this.perf = mode;
    const sse = mode === "high" ? 8 : mode === "medium" ? 16 : 32;
    viewer.scene.globe.maximumScreenSpaceError = sse;
    viewer.resolutionScale =
      mode === "high" ? Math.min(window.devicePixelRatio || 1, 1.5) : mode === "medium" ? 1 : 0.75;
    if (this.tileset)
      this.tileset.maximumScreenSpaceError = mode === "high" ? 8 : mode === "medium" ? 16 : 32;
    viewer.scene.globe.tileCacheSize = mode === "low" ? 40 : mode === "medium" ? 80 : 120;
    this.requestRender();
  }

  getPerf(): PerfMode {
    return this.perf;
  }

  resize(): void {
    try {
      this.viewer?.resize();
    } catch {
      /* container not measured yet */
    }
  }

  /* ------------------------------------------------------- ground height */

  /**
   * Sample terrain under a set of positions. Returns nulls when there is no
   * real terrain, so callers keep height 0 (ellipsoid) instead of inventing
   * an elevation.
   */
  async sampleGround(lons: number[], lats: number[]): Promise<(number | null)[]> {
    const C = this.C;
    const viewer = this.viewer;
    if (!C || !viewer || this.status.terrain !== "real") return lons.map(() => null);
    try {
      const positions = lons.map((lon, i) => C.Cartesian3.fromDegrees(lon, lats[i] ?? lon));
      const scene = viewer.scene as unknown as {
        sampleHeightMostDetailed?: (p: import("cesium").Cartesian3[]) => Promise<number[]>;
      };
      const heights = await scene.sampleHeightMostDetailed?.(positions);
      if (!heights) return lons.map(() => null);
      return heights.map((h) => (Number.isFinite(h) && h > -500 ? h : null));
    } catch {
      return lons.map(() => null);
    }
  }

  /** True when the camera is low enough for extruded detail to be worth loading. */
  isNear(): boolean {
    return (this.viewer?.camera.positionCartographic?.height ?? 1e9) < 90_000;
  }
}

function ensureWidgetsCss(href: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-gis3d-cesium]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-gis3d-cesium", "1");
  document.head.appendChild(link);
}

function pointInRing(ring: number[][], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const xi = a[0];
    const yi = a[1];
    const xj = b[0];
    const yj = b[1];
    if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) continue;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
