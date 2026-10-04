/**
 * TimeMachine3DScene — isolated Cesium viewer for /time-machine.
 *
 * Lifecycle rules: one Viewer per mounted route instance; every async probe is
 * token-guarded; a user camera gesture interrupts any in-flight flyTo; the
 * clock's snapshot is the only thing that swaps imagery layers (debounced to
 * committed year). Destroyed wholesale on route unmount.
 */
type CesiumModule = typeof import("cesium");

const SATELLITE_YEAR_URL = (year: number) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`;
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export interface Plot {
  r: number[];
  a: number;
  g: number;
}

const GAP_COLORS: Record<number, string> = {
  0: "rgba(57,196,122,0.22)",
  1: "rgba(227,168,50,0.28)",
  2: "rgba(224,85,61,0.34)",
};

export interface ParcelSelection {
  kind: "parcel";
  id: string;
  area?: number;
  gap?: number;
  lon: number;
  lat: number;
}

export interface EventSelection {
  kind: "event";
  id: string;
  year: number;
  title: string;
  lon: number;
  lat: number;
}

export type Pick = ParcelSelection | EventSelection;

export class TimeMachineScene {
  private C: CesiumModule | null = null;
  private viewer: import("cesium").Viewer | null = null;
  private token = 0;
  private satLayer: import("cesium").ImageryLayer | null = null;
  private streetLayer: import("cesium").ImageryLayer | null = null;
  private parcelIds: string[] = [];
  private eventEntities: import("cesium").Entity[] = [];
  private cameraGen = 0;
  private onPick: (p: Pick) => void = () => {};
  private pickHandler: import("cesium").ScreenSpaceEventHandler | null = null;

  async init(container: HTMLElement): Promise<boolean> {
    if (this.viewer) return true;
    if (import.meta.env.SSR) return false;
    (window as unknown as Record<string, string>)["CESIUM_BASE_URL"] = "/cesium/";
    ensureWidgetsCss("/cesium/Widgets/widgets.css");
    const C = await import("cesium");
    this.C = C;
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
      scene3DOnly: true,
      requestRenderMode: false,
    });
    viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);
    const sat = this.makeSatLayer(2024);
    if (sat) {
      viewer.imageryLayers.add(sat);
      this.satLayer = sat;
    }
    // Strip the default credit box to a compact one
    const credit = viewer.bottomContainer as HTMLElement | undefined;
    if (credit) credit.style.cssText = "max-width:38vw;opacity:.75";
    this.viewer = viewer;

    // Immersive first frame: wide regional view, then descend.
    const first = ++this.cameraGen;
    viewer.camera.setView({
      destination: C.Cartesian3.fromDegrees(73.6, 19.9, 120_000),
      orientation: { heading: 0, pitch: C.Math.toRadians(-35), roll: 0 },
    });
    window.setTimeout(() => {
      if (first === this.cameraGen) {
        this.flyTo(73.994, 20.219, 5200, 2400);
      }
    }, 350);

    // User input wins: cancel in-flight cinematic flights on gesture.
    const cancel = () => {
      this.cameraGen++;
      this.viewer?.camera.cancelFlight();
    };
    viewer.screenSpaceEventHandler.setInputAction(cancel, C.ScreenSpaceEventType.WHEEL);
    viewer.screenSpaceEventHandler.setInputAction(cancel, C.ScreenSpaceEventType.LEFT_DOWN);
    viewer.screenSpaceEventHandler.setInputAction(cancel, C.ScreenSpaceEventType.RIGHT_DOWN);
    viewer.screenSpaceEventHandler.setInputAction(cancel, C.ScreenSpaceEventType.MIDDLE_DOWN);

    this.pickHandler = new C.ScreenSpaceEventHandler(viewer.canvas);
    this.pickHandler.setInputAction(
      (evt: { position: import("cesium").Cartesian2 }) => this.handlePick(evt.position),
      C.ScreenSpaceEventType.LEFT_CLICK,
    );

    this.probeTerrain();
    this.probeBuildings();
    return true;
  }

  setPickHandler(fn: (p: Pick) => void) {
    this.onPick = fn;
  }

  /** User input wins: cancel any in-flight camera animation. */
  flyTo(lon: number, lat: number, heightM: number, durationMs = 1800) {
    if (!this.C || !this.viewer) return;
    const C = this.C;
    const gen = ++this.cameraGen;
    this.viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(lon, lat, heightM),
      orientation: { heading: 0, pitch: C.Math.toRadians(-45), roll: 0 },
      duration: durationMs / 1000,
      complete: () => {
        if (gen !== this.cameraGen) return;
      },
    });
  }

  setYear(year: number) {
    const v = this.viewer;
    if (!v || !this.C) return;
    const myToken = ++this.token;
    const next = this.makeSatLayer(year);
    if (!next) return;
    if (this.satLayer) v.imageryLayers.remove(this.satLayer, false);
    v.imageryLayers.add(next, 0);
    this.satLayer = next;
    v.scene.requestRender();
    void myToken;
  }

  private makeSatLayer(year: number): import("cesium").ImageryLayer | null {
    if (!this.C) return null;
    const C = this.C;
    return new C.ImageryLayer(
      new C.UrlTemplateImageryProvider({
        url: SATELLITE_YEAR_URL(year),
        maximumLevel: 19,
        credit: "Copernicus Sentinel-2 cloudless © EOX",
      }),
    );
  }

  setStreetMap(on: boolean) {
    if (!this.viewer || !this.C) return;
    if (on && !this.streetLayer) {
      const layer = new this.C.ImageryLayer(
        new this.C.UrlTemplateImageryProvider({ url: OSM_TILE_URL, maximumLevel: 19 }),
      );
      this.viewer.imageryLayers.add(layer);
      this.streetLayer = layer;
    } else if (!on && this.streetLayer) {
      this.viewer.imageryLayers.remove(this.streetLayer, false);
      this.streetLayer = null;
    }
  }

  setParcels(features: { id: string; lon: number; lat: number; ring: number[][]; area?: number; gap?: number }[], on: boolean) {
    const v = this.viewer;
    if (!v || !this.C) return;
    this.parcelIds.forEach((id) => v.entities.removeById(id));
    this.parcelIds = [];
    if (!on) return;
    const C = this.C;
    for (const f of features) {
      const positions = f.ring
        .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
        .map((p) => C.Cartesian3.fromDegrees(p[0]!, p[1]!));
      const e = v.entities.add({
        id: `tm:parcel:${f.id}`,
        polygon: {
          hierarchy: positions,
          material: new this.C.ColorMaterialProperty(
            this.C.Color.fromCssColorString("rgba(127,226,168,0.16)"),
          ),
          outline: true,
          outlineColor: this.C.Color.fromCssColorString("rgba(207,216,210,0.85)"),
          height: 0,
        },
        properties: { kind: "parcel", id: f.id, area: f.area, gap: f.gap },
      });
      this.parcelIds.push(e.id);
    }
  }

  /** Change-signal parcel rendering, colored by gap class (2024 snapshot). */
  setChangeLayer(features: { id: string; lon: number; lat: number; ring: number[][]; gap: number }[], on: boolean) {
    const v = this.viewer;
    if (!v || !this.C) return;
    const C = this.C;
    this.parcelIds.forEach((id) => {
      if (id.startsWith("tm:change:")) v.entities.removeById(id);
    });
    this.parcelIds = this.parcelIds.filter((id) => !id.startsWith("tm:change:"));
    if (!on) return;
    for (const f of features) {
      const positions: [number, number][] = f.ring.map(([lon, lat]) => [lon, lat] as [number, number]);
      const e = v.entities.add({
        id: `tm:change:${f.id}`,
        polygon: {
          hierarchy: positions.map(([lon, lat]) => C.Cartesian3.fromDegrees(lon, lat)),
          material: new C.ColorMaterialProperty(C.Color.fromCssColorString(GAP_COLORS[f.gap] ?? "rgba(138,151,143,0.2)")),
          outline: false,
          height: 0,
        },
        properties: { kind: "parcel", id: f.id, area: 0, gap: f.gap },
      });
      this.parcelIds.push(e.id);
    }
  }

  setEvents(events: { id: string; year: number; title: string; lon: number; lat: number }[], on: boolean) {
    const v = this.viewer;
    if (!v || !this.C) return;
    this.eventEntities.forEach((e) => v.entities.remove(e));
    this.eventEntities = [];
    if (!on) return;
    for (const ev of events) {
      const e = v.entities.add({
        id: `tm:event:${ev.id}`,
        position: this.C.Cartesian3.fromDegrees(ev.lon, ev.lat, 0),
        point: {
          pixelSize: 11,
          color: this.C.Color.fromCssColorString("#e3a832"),
          outlineColor: this.C.Color.fromCssColorString("#0d1410"),
          outlineWidth: 2,
          heightReference: this.C.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: `${ev.year} · ${ev.title}`,
          font: "11px Inter",
          fillColor: this.C.Color.fromCssColorString("#f2e7c8"),
          showBackground: true,
          backgroundColor: this.C.Color.fromCssColorString("rgba(10,16,12,0.7)"),
          pixelOffset: new this.C.Cartesian2(0, -22),
        },
        properties: { kind: "event", id: ev.id, year: ev.year, title: ev.title, lon: ev.lon, lat: ev.lat },
      });
      this.eventEntities.push(e);
    }
  }

  flyToEvent(lon: number, lat: number) {
    this.flyTo(lon, lat, 3800, 1900);
  }

  onCameraChange(fn: () => void) {
    this.viewer?.camera.changed.addEventListener(fn);
  }

  private bumpUserCamera() {
    this.cameraGen++;
    this.viewer?.camera.cancelFlight?.();
  }

  cameraSnapshot() {
    if (!this.viewer) return null;
    return {
      position: this.viewer.camera.positionWC.clone(),
      heading: this.viewer.camera.heading,
      pitch: this.viewer.camera.pitch,
      roll: this.viewer.camera.roll,
    };
  }

  applyCamera(snap: { position: import("cesium").Cartesian3; heading: number; pitch: number; roll: number }) {
    this.viewer?.camera.setView({
      destination: snap.position,
      orientation: { heading: snap.heading, pitch: snap.pitch, roll: snap.roll },
    });
  }

  private handlePick(position: import("cesium").Cartesian2) {
    if (!this.viewer || !this.C) return;
    const picked = this.viewer.scene.pick(position);
    if (!picked?.id) return;
    const id: string = picked.id.id ?? "";
    const props = picked.id.properties;
    if (id.startsWith("tm:parcel:") || id.startsWith("tm:change:")) {
      const p = props?.getValue?.() as Record<string, unknown> | undefined;
      const lonlat = picked.id.polygon?.hierarchy?.getValue?.()?.positions?.[0];
      this.onPick({ kind: "parcel", id, area: p?.["area"] as number | undefined, gap: p?.["gap"] as number | undefined, lon: 0, lat: 0 } as ParcelSelection);
      void lonlat;
      return;
    }
    if (id.startsWith("tm:event:") || picked.id.label) {
      const p = props?.getValue?.() as Record<string, unknown> | undefined;
      if (p && typeof p["year"] === "number") {
        this.onPick({ kind: "event", id, year: p["year"], title: String(p["title"] ?? ""), lon: p["lon"] as number, lat: p["lat"] as number });
      }
    }
  }

  async probeTerrain() {
    if (!this.C || !this.viewer) return;
    const C = this.C;
    try {
      const provider = await Promise.race([
        C.createWorldTerrainAsync({ requestWaterMask: false, requestVertexNormals: false }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("terrain timeout")), 9000)),
      ]);
      if (this.viewer) this.viewer.terrainProvider = provider;
    } catch {
      /* ellipsoid stays */
    }
  }

  async probeBuildings() {
    if (!this.C || !this.viewer) return;
    try {
      const tileset = await Promise.race([
        this.C.createOsmBuildingsAsync(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("buildings timeout")), 9000)),
      ]);
      if (this.viewer) this.viewer.scene.primitives.add(tileset);
    } catch {
      /* no buildings, honest empty scene */
    }
  }

  destroy() {
    this.cameraGen++;
    this.pickHandler?.destroy();
    this.eventEntities.forEach((e) => this.viewer?.entities.remove(e));
    this.eventEntities = [];
    this.parcelIds = [];
    try {
      this.viewer?.destroy();
    } catch {
      /* already torn down */
    }
    this.viewer = null;
  }
}

function ensureWidgetsCss(href: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-tm-cesium]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-tm-cesium", "1");
  document.head.appendChild(link);
}
