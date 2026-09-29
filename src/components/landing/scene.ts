/**
 * The landing page's 3D cadastre.
 *
 * One continuous scene: India's real state outlines (src/data/india-states.json)
 * extruded as a slab, Maharashtra raised, and inside it the 2,457 real BhuNaksha
 * plot outlines of Vadnerbhairav (public/landing/vadnerbhairav.json). Scroll
 * progress (0..1) drives a single camera path from the subcontinent down to the
 * village, where the plots rise in a wave and take the colour of their real
 * map-vs-7/12 gap. A logarithmic depth buffer lets a 3,000 km country and a
 * 20 m plot share one scene.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import statesGeoJSON from "@/data/india-states.json";

// ---------------------------------------------------------------------------
// Geography → scene units (1 unit = 1 degree, equirectangular around India)
// ---------------------------------------------------------------------------

const LON0 = 80;
const LAT0 = 22;
const K = Math.cos((LAT0 * Math.PI) / 180);
const px = (lon: number) => (lon - LON0) * K;
const pz = (lat: number) => -(lat - LAT0);

const SLAB = 0.32; // India slab thickness
const MH_LIFT = 0.18; // Maharashtra stands proud of the slab
const VILLAGE: [number, number] = [74.0328, 20.2601];

export const GAP_COLORS = ["#39c47a", "#e3a832", "#e0553d", "#8c978f"] as const; // match · 10–30 % · ≥30 % · no record

type Parcels = {
  origin: [number, number];
  extent: [number, number];
  counts: { match: number; gap: number; wide: number; norecord: number };
  plots: { r: number[]; a: number; g: number }[];
};

// ---------------------------------------------------------------------------
// Shaders — plots rise in a wave and recolour by their gap class
// ---------------------------------------------------------------------------

const PLOT_VERT = /* glsl */ `
  attribute float aDelay;
  attribute float aHeight;
  attribute vec3 aColor;
  uniform float uRise;
  uniform float uTint;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vTop;
  varying float vTint;
  varying float vRise;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    float t = clamp((uRise * 1.7 - aDelay) / 0.7, 0.0, 1.0);
    float rise = t * t * (3.0 - 2.0 * t);
    vec3 p = position;
    vTop = step(0.5, p.y);
    p.y *= aHeight * mix(0.04, 1.0, rise);
    float ct = clamp((uTint * 1.7 - aDelay) / 0.7, 0.0, 1.0);
    vTint = ct * ct * (3.0 - 2.0 * ct);
    vRise = rise;
    vNormal = normalize(normalMatrix * normal);
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const PLOT_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vTop;
  varying float vTint;
  varying float vRise;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec3 l = normalize(vec3(0.45, 0.85, 0.35));
    float diff = max(dot(normalize(vNormal), l), 0.0);
    vec3 col = mix(uBase, vColor, vTint);
    float shade = 0.42 + 0.58 * diff;
    col *= shade;
    col += vTop * vTint * vColor * 0.18;          // lit roofs glow a little
    col = mix(col, col * 0.55, (1.0 - vTop) * 0.35); // darker walls read as depth
    gl_FragColor = vec4(col, uOpacity * mix(0.55, 1.0, vRise));
  }
`;

// ---------------------------------------------------------------------------

type Key = { pos: THREE.Vector3; look: THREE.Vector3; fov: number };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export class CadastreScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private india = new THREE.Group();
  private indiaMat: THREE.MeshStandardMaterial;
  private mhMat: THREE.MeshStandardMaterial;
  private borderMat: THREE.LineBasicMaterial;
  private mhBorderMat: THREE.LineBasicMaterial;
  private village = new THREE.Group();
  private plotMat: THREE.ShaderMaterial | null = null;
  private outlineMat: THREE.LineBasicMaterial | null = null;
  private dust: THREE.Points;
  private marker = new THREE.Group();
  private markerMat = new THREE.MeshBasicMaterial({
    color: 0xf2b45a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private keys: Key[] = [];
  private progress = 0;
  private pointer = new THREE.Vector2();
  private pointerEased = new THREE.Vector2();
  private t0 = performance.now();
  private raf = 0;
  private running = false;
  private disposed = false;
  parcels: Parcels | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.00005, 200);
    this.scene.fog = new THREE.FogExp2(0x03110a, 0.018);

    this.scene.add(new THREE.HemisphereLight(0xcfeede, 0x06170e, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
    sun.position.set(-6, 14, 8);
    this.scene.add(sun);

    this.indiaMat = new THREE.MeshStandardMaterial({
      color: 0x0c2b1c,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 1,
    });
    this.mhMat = new THREE.MeshStandardMaterial({
      color: 0x0f5a36,
      emissive: 0x0a3d22,
      emissiveIntensity: 0.6,
      roughness: 0.6,
      transparent: true,
      opacity: 1,
    });
    this.borderMat = new THREE.LineBasicMaterial({
      color: 0x3fae78,
      transparent: true,
      opacity: 0.45,
    });
    this.mhBorderMat = new THREE.LineBasicMaterial({
      color: 0xf2b45a,
      transparent: true,
      opacity: 0.95,
    });
    this.buildIndia();
    this.scene.add(this.india);
    this.scene.add(this.village);
    this.dust = this.buildDust();
    this.scene.add(this.dust);
    this.buildMarker();
    this.buildKeys();
    this.resize();
  }

  // --- India slab ---------------------------------------------------------

  private buildIndia() {
    const fc = statesGeoJSON as unknown as {
      features: {
        properties: { name: string };
        geometry: { type: string; coordinates: number[][][] | number[][][][] };
      }[];
    };
    const land: THREE.BufferGeometry[] = [];
    const mh: THREE.BufferGeometry[] = [];
    const borders: number[] = [];
    const mhBorders: number[] = [];
    for (const f of fc.features) {
      const isMH = f.properties.name === "Maharashtra";
      const polys = (
        f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]
      ) as number[][][][];
      for (const poly of polys) {
        const outer = poly[0];
        if (!outer || outer.length < 4) continue;
        const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(px(x!), -pz(y!))));
        for (const hole of poly.slice(1))
          shape.holes.push(
            new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(px(x!), -pz(y!)))),
          );
        const depth = isMH ? SLAB + MH_LIFT : SLAB;
        const g = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: false,
          curveSegments: 1,
        });
        g.rotateX(-Math.PI / 2);
        (isMH ? mh : land).push(g);
        const y = depth + 0.002;
        const target = isMH ? mhBorders : borders;
        for (let i = 0; i < outer.length - 1; i++) {
          const a = outer[i]!;
          const b = outer[i + 1]!;
          target.push(px(a[0]!), y, pz(a[1]!), px(b[0]!), y, pz(b[1]!));
        }
      }
    }
    this.india.add(new THREE.Mesh(mergeGeometries(land), this.indiaMat));
    this.india.add(new THREE.Mesh(mergeGeometries(mh), this.mhMat));
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute(borders, 3));
    this.india.add(new THREE.LineSegments(bg, this.borderMat));
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.Float32BufferAttribute(mhBorders, 3));
    this.india.add(new THREE.LineSegments(mg, this.mhBorderMat));
  }

  private buildDust() {
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 12 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0x9fe0bd,
        size: 0.045,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
  }

  // A pulsing pin on Vadnerbhairav: where the dive is headed
  private buildMarker() {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 48), this.markerMat);
    ring.rotation.x = -Math.PI / 2;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 32), this.markerMat);
    dot.rotation.x = -Math.PI / 2;
    this.marker.add(ring, dot);
    this.marker.position.set(px(VILLAGE[0]), SLAB + MH_LIFT + 0.004, pz(VILLAGE[1]));
    this.scene.add(this.marker);
  }

  // --- Camera path --------------------------------------------------------

  private buildKeys() {
    const vx = px(VILLAGE[0]);
    const vz = pz(VILLAGE[1]);
    const top = SLAB + MH_LIFT;
    this.keys = [
      { pos: new THREE.Vector3(2.5, 26, 27), look: new THREE.Vector3(0.5, 0, 1.2), fov: 38 }, // subcontinent
      {
        pos: new THREE.Vector3(px(75.2), 12.5, pz(15.6)),
        look: new THREE.Vector3(px(76.2), top, pz(19.4)),
        fov: 36,
      }, // Maharashtra
      {
        pos: new THREE.Vector3(vx - 0.05, top + 0.55, vz + 0.62),
        look: new THREE.Vector3(vx, top, vz),
        fov: 34,
      }, // Nashik
      {
        pos: new THREE.Vector3(vx - 0.035, top + 0.045, vz + 0.075),
        look: new THREE.Vector3(vx, top, vz),
        fov: 34,
      }, // the village
      {
        pos: new THREE.Vector3(vx + 0.078, top + 0.058, vz + 0.064),
        look: new THREE.Vector3(vx - 0.004, top + 0.001, vz - 0.004),
        fov: 36,
      }, // three-quarter orbit
    ];
  }

  private cameraAt(p: number) {
    // piecewise over the keys, eased per segment
    const stops = [0, 0.3, 0.5, 0.72, 1];
    let i = 0;
    while (i < stops.length - 2 && p > stops[i + 1]!) i++;
    const t = ease(seg(p, stops[i]!, stops[i + 1]!));
    const a = this.keys[i]!;
    const b = this.keys[i + 1]!;
    return {
      pos: a.pos.clone().lerp(b.pos, t),
      look: a.look.clone().lerp(b.look, t),
      fov: a.fov + (b.fov - a.fov) * t,
    };
  }

  // --- Village plots ------------------------------------------------------

  async loadParcels(url: string) {
    const res = await fetch(url);
    const data = (await res.json()) as Parcels;
    if (this.disposed) return;
    this.parcels = data;
    const [ox, oy] = data.origin;
    const [ex, ey] = data.extent;
    const cx = ox + ex / 2;
    const cy = oy + ey / 2;
    const maxR = Math.hypot(ex * K, ey) / 2;
    const geoms: THREE.BufferGeometry[] = [];
    const outline: number[] = [];
    const top = SLAB + MH_LIFT;
    const colors = GAP_COLORS.map((c) => new THREE.Color(c));

    for (const plot of data.plots) {
      const pts: THREE.Vector2[] = [];
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < plot.r.length; i += 2) {
        const lon = ox + plot.r[i]! / 1e6;
        const lat = oy + plot.r[i + 1]! / 1e6;
        pts.push(new THREE.Vector2(px(lon), -pz(lat)));
        sx += lon;
        sy += lat;
      }
      if (pts.length < 3) continue;
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
        depth: 1,
        bevelEnabled: false,
        curveSegments: 1,
      });
      g.rotateX(-Math.PI / 2);
      const n = g.attributes["position"]!.count;
      const clon = sx / (pts.length || 1);
      const clat = sy / (pts.length || 1);
      const dist = Math.hypot((clon - cx) * K, clat - cy) / maxR;
      const delay = Math.min(1, dist) * 0.9 + Math.random() * 0.1;
      // height from the real drawn area (sqrt → gentle skyline), in scene units
      const h = 0.0006 + Math.min(0.0045, Math.sqrt(plot.a) * 0.000022);
      const col = colors[plot.g < 0 ? 3 : plot.g]!;
      const aDelay = new Float32Array(n).fill(delay);
      const aHeight = new Float32Array(n).fill(h);
      const aColor = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) {
        aColor[v * 3] = col.r;
        aColor[v * 3 + 1] = col.g;
        aColor[v * 3 + 2] = col.b;
      }
      g.setAttribute("aDelay", new THREE.BufferAttribute(aDelay, 1));
      g.setAttribute("aHeight", new THREE.BufferAttribute(aHeight, 1));
      g.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
      g.deleteAttribute("uv");
      geoms.push(g);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        outline.push(a.x, top + 0.00005, -a.y, b.x, top + 0.00005, -b.y);
      }
    }
    const merged = mergeGeometries(geoms);
    this.plotMat = new THREE.ShaderMaterial({
      vertexShader: PLOT_VERT,
      fragmentShader: PLOT_FRAG,
      uniforms: {
        uRise: { value: 0 },
        uTint: { value: 0 },
        uBase: { value: new THREE.Color("#c9d6c4") },
        uOpacity: { value: 0 },
      },
      transparent: true,
    });
    const plotsMesh = new THREE.Mesh(merged, this.plotMat);
    plotsMesh.position.y = top; // shader scales heights from 0..1, so the mesh sits on the slab
    plotsMesh.frustumCulled = false;
    this.village.add(plotsMesh);
    const og = new THREE.BufferGeometry();
    og.setAttribute("position", new THREE.Float32BufferAttribute(outline, 3));
    this.outlineMat = new THREE.LineBasicMaterial({
      color: 0xf2d9a2,
      transparent: true,
      opacity: 0,
    });
    this.village.add(new THREE.LineSegments(og, this.outlineMat));
    this.apply();
  }

  // --- Frame --------------------------------------------------------------

  setProgress(p: number) {
    this.progress = clamp01(p);
    if (!this.running) this.render();
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  private apply() {
    const p = this.progress;
    const cam = this.cameraAt(p);
    // idle drift + pointer parallax, strongest on the opening view
    const t = (performance.now() - this.t0) / 1000;
    this.pointerEased.lerp(this.pointer, 0.05);
    const sway = 1 - seg(p, 0, 0.3);
    cam.pos.x += (Math.sin(t * 0.12) * 1.4 + this.pointerEased.x * 2.2) * sway;
    cam.pos.y += this.pointerEased.y * 1.2 * sway;
    this.camera.position.copy(cam.pos);
    this.camera.fov = cam.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(cam.look);

    // India recedes once we're inside Maharashtra
    const fade = 1 - seg(p, 0.46, 0.62);
    this.indiaMat.opacity = 0.25 + 0.75 * fade;
    this.borderMat.opacity = 0.45 * fade;
    this.mhMat.opacity = 0.35 + 0.65 * fade;
    this.mhBorderMat.opacity = 0.95 * (0.3 + 0.7 * fade);
    this.mhMat.emissiveIntensity = 0.6 + 0.6 * seg(p, 0.18, 0.32);
    this.markerMat.opacity = seg(p, 0.14, 0.22) * (1 - seg(p, 0.4, 0.47));
    const pulse = 1 + 0.35 * Math.sin(t * 3.2);
    this.marker.children[0]!.scale.setScalar(pulse * (1 - 0.6 * seg(p, 0.3, 0.45)));
    this.marker.children[1]!.scale.setScalar(1 - 0.6 * seg(p, 0.3, 0.45));
    (this.dust.material as THREE.PointsMaterial).opacity = 0.35 * (1 - seg(p, 0.45, 0.6));
    this.dust.rotation.y = t * 0.01;
    (this.scene.fog as THREE.FogExp2).density = 0.018 + 1.2 * seg(p, 0.5, 0.72);

    if (this.plotMat && this.outlineMat) {
      this.outlineMat.opacity = seg(p, 0.46, 0.56) * (1 - 0.6 * seg(p, 0.66, 0.8));
      this.plotMat.uniforms["uOpacity"]!.value = seg(p, 0.5, 0.58);
      this.plotMat.uniforms["uRise"]!.value = seg(p, 0.55, 0.74);
      this.plotMat.uniforms["uTint"]!.value = seg(p, 0.72, 0.9);
    }
  }

  private render() {
    this.apply();
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep India framed on tall/narrow screens
    this.camera.zoom = w / h < 1 ? Math.max(0.55, w / h) : 1;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.render();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}
