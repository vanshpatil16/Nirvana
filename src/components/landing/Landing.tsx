import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import logo from "@/assets/logo.png";
import landscape from "@/assets/bhumi-landscape.jpg";
import policyVideo from "@/assets/policy_home.mp4";
import researchVideo from "@/assets/research_home.mp4";
import {
  CapsuleViz,
  CopilotViz,
  LoopViz,
  ProtectViz,
  ProveViz,
  SimulateViz,
  VerifyViz,
} from "./visuals";
import "./landing.css";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const DIVE = [
  {
    k: "01 · India",
    t: "Two in three civil cases in India are about land or property.",
    s: "DAKSH, Access to Justice Survey 2016",
    side: "left",
  },
  {
    k: "02 · Maharashtra",
    t: "43,792 villages sit on the state’s public cadastral map.",
    s: "BhuNaksha village index, enumerated by the plots-on-maps study",
    side: "right",
  },
  {
    k: "03 · Vadnerbhairav, Chandwad",
    t: "2,457 plots. Every outline rising here is a real land-record boundary.",
    s: "Maharashtra land records (BhuNaksha), via the BhuMe village bundle",
    side: "left",
  },
] as const;

const METHOD = [
  {
    id: "verify",
    verb: "Verify",
    title: "Find the break.",
    body: "Score every plot by how far its record has drifted from what the satellite sees — and send an officer before it becomes a court case.",
    Viz: VerifyViz,
  },
  {
    id: "ask",
    verb: "Ask",
    title: "Ask in your own language.",
    body: "Hindi, Marathi or English, typed or spoken. The model writes a query plan — never the answer, never the SQL.",
    Viz: CopilotViz,
  },
  {
    id: "protect",
    verb: "Protect",
    title: "Move the question, not the records.",
    body: "Plans travel to each state’s node and only aggregates return. Any cell under five parcels never leaves home.",
    Viz: ProtectViz,
  },
  {
    id: "simulate",
    verb: "Simulate",
    title: "Try the policy before you sign it.",
    body: "Pull a lever and watch who gains and who quietly loses — with the law vetoing what it must.",
    Viz: SimulateViz,
  },
  {
    id: "prove",
    verb: "Prove",
    title: "Register the target first.",
    body: "Lock the KPI, then measure against matched districts — so −10 days of hope becomes −8 days of evidence.",
    Viz: ProveViz,
  },
  {
    id: "capsule",
    verb: "Capsule",
    title: "Make it re-runnable.",
    body: "Data versions, code, parameters and citations sealed into one capsule that anyone can reproduce.",
    Viz: CapsuleViz,
  },
  {
    id: "loop",
    verb: "Loop",
    title: "Every result becomes the next question.",
    body: "The capsule lands in the research base, and the next cycle starts from better evidence than the last.",
    Viz: LoopViz,
  },
] as const;

const MODULES = [
  {
    href: "/copilot",
    name: "Ask Bhumi",
    tag: "Copilot",
    body: "Trilingual NL-GIS copilot that plans a query, reads the data, cites the Act and moves the map.",
    size: "xl",
    video: null,
  },
  {
    href: "/policy-lab",
    name: "Policy Lab",
    tag: "14 instruments · 152 citations",
    body: "Real Acts read clause by clause, with simulated impact on land use.",
    size: "tall",
    video: policyVideo,
  },
  {
    href: "/research-hub",
    name: "Research Hub",
    tag: "Evidence base",
    body: "Repository, live manuscripts and collaborative review.",
    size: "tall",
    video: researchVideo,
  },
  {
    href: "/gis-explorer-3d",
    name: "3D GIS Explorer",
    tag: "CesiumJS",
    body: "India as a 3D globe with real OSM buildings and storey-level inspection.",
    size: "wide",
    video: null,
  },
  {
    href: "/dashboard",
    name: "Dashboard",
    tag: "43 IMD stations",
    body: "National picture: live weather, climate risk, change timelines.",
    size: "sm",
    video: null,
  },
  {
    href: "/record-vs-reality",
    name: "Record vs Reality",
    tag: "Field capture",
    body: "Geo-tagged photos and a 7/12 cross-check from the ground.",
    size: "sm",
    video: null,
  },
  {
    href: "/landdifference",
    name: "Land Difference",
    tag: "2018 → 2024",
    body: "Land-use change by state, with scenario levers.",
    size: "sm",
    video: null,
  },
  {
    href: "/workflow",
    name: "Evidence Workflow",
    tag: "7 chapters",
    body: "The method on this page, as a working demo.",
    size: "sm",
    video: null,
  },
  {
    href: "/innovation-portal",
    name: "Innovation Portal",
    tag: "Challenges · pilots",
    body: "Where fixes are proposed, funded and piloted.",
    size: "sm",
    video: null,
  },
  {
    href: "/collaborativehub",
    name: "Collaborative Hub",
    tag: "Workspaces",
    body: "Researchers, officers and policymakers on one draft.",
    size: "banner",
    video: null,
  },
] as const;

const LEDGER = [
  {
    kind: "real",
    stamp: "Real",
    title: "Observed",
    rows: [
      "Sentinel-2 cloudless imagery — EOX / Copernicus",
      "10 m land cover — Esri / Impact Observatory",
      "2,457 BhuNaksha plot outlines — Vadnerbhairav",
      "Act text — 14 instruments, 152 clause citations",
      "Live weather — 43 IMD stations",
      "Buildings, roads, water — OpenStreetMap",
    ],
  },
  {
    kind: "model",
    stamp: "Modelled",
    title: "Simulated, and labelled so",
    rows: [
      "Policy Lab impact on land use",
      "Scenario model in Land Difference",
      "Federated nodes & causal panel in the workflow",
      "Dashboard KPI series",
    ],
  },
  {
    kind: "gap",
    stamp: "Not connected",
    title: "Missing — and we say so",
    rows: [
      "7/12 Record of Rights",
      "IGR registration records",
      "State RoR APIs (none publish one)",
    ],
  },
] as const;

const QUESTIONS = [
  "Which villages in Pune turned farmland into built-up since 2019?",
  "2019 से 2024 के बीच पुणे के किन गाँवों में खेती की ज़मीन बदली?",
  "कूळ कायद्यानुसार कुळाचे संरक्षण कसे होते?",
  "What does Section 42 of the Land Revenue Code allow without permission?",
  "क्या इस ज़मीन को गैर-कृषि उपयोग में बदला जा सकता है?",
  "ही जमीन अकृषिक वापरासाठी बदलता येईल का?",
];

// Real Sentinel-2 cloudless tiles, Hinjewadi / Maan (Pune), zoom 14
const TILE_X = [11545, 11546, 11547, 11548];
const TILE_Y = [7329, 7330, 7331];
const tile = (year: number, x: number, y: number) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/14/${y}/${x}.jpg`;

// ---------------------------------------------------------------------------

function Tiles({ year }: { year: number }) {
  return (
    <div className="ld-tiles" aria-hidden="true">
      {TILE_Y.map((y) =>
        TILE_X.map((x) => (
          <img key={`${x}-${y}`} src={tile(year, x, y)} alt="" loading="lazy" draggable={false} />
        )),
      )}
    </div>
  );
}

function Counter({
  id,
  to,
  color,
  label,
}: {
  id: string;
  to: number;
  color: string;
  label: string;
}) {
  return (
    <div className="ld-count">
      <i style={{ background: color }} />
      <b data-count={id} data-to={to}>
        0
      </b>
      <span>{label}</span>
    </div>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];

    void (async () => {
      const [{ gsap }, { ScrollTrigger }, { SplitText }, { CadastreScene }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/SplitText"),
        import("./scene"),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // --- 3D scene -------------------------------------------------------
      let scene: InstanceType<typeof CadastreScene> | null = null;
      try {
        scene = new CadastreScene(cv);
        void scene.loadParcels("/landing/vadnerbhairav.json");
      } catch {
        el.classList.add("no-webgl");
      }
      const onResize = () => scene?.resize();
      window.addEventListener("resize", onResize);
      const onPointer = (e: PointerEvent) =>
        scene?.setPointer(
          (e.clientX / window.innerWidth) * 2 - 1,
          -((e.clientY / window.innerHeight) * 2 - 1),
        );
      window.addEventListener("pointermove", onPointer);
      cleanups.push(() => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pointermove", onPointer);
        scene?.dispose();
      });

      // --- smooth scroll ----------------------------------------------------
      if (!reduce) {
        const { default: Lenis } = await import("lenis");
        if (disposed) return;
        const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (t: number) => lenis.raf(t * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
          a.addEventListener("click", (e) => {
            e.preventDefault();
            lenis.scrollTo(a.getAttribute("href")!, { offset: 0, duration: 1.6 });
          }),
        );
        cleanups.push(() => {
          gsap.ticker.remove(tick);
          lenis.destroy();
        });
      }

      const ctx = gsap.context(() => {
        const mm = gsap.matchMedia();

        // Page progress hairline + nav state
        gsap.to(".ld-progress i", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
        });
        ScrollTrigger.create({
          start: 120,
          end: "max",
          toggleClass: { targets: ".ld-nav", className: "is-solid" },
        });

        // Hero headline
        const split = new SplitText(".ld-hero h1", { type: "lines,words", mask: "lines" });
        gsap.from(split.words, {
          yPercent: 110,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.035,
          delay: 0.55,
        });
        gsap.from(".ld-hero .ld-fade", {
          y: 18,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
          delay: 1.05,
        });

        const counters = () => {
          const p = Number(el.dataset["p"] ?? 0);
          const k = Math.min(1, Math.max(0, (p - 0.74) / 0.14));
          el.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => {
            c.textContent = Math.round(Number(c.dataset["to"]) * k).toLocaleString("en-IN");
          });
        };

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          // --- The dive: pinned, scrubbed camera path ---------------------
          const dive = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: ".ld-dive",
              start: "top top",
              end: "+=520%",
              pin: true,
              scrub: 1.1,
              onUpdate: (st) => {
                el.dataset["p"] = String(st.progress);
                scene?.setProgress(st.progress);
                counters();
              },
              onToggle: (st) => (st.isActive ? scene?.start() : scene?.stop()),
            },
          });
          dive
            .to(".ld-hero", { opacity: 0, y: -60, duration: 0.1 }, 0.04)
            .to(".ld-cue", { opacity: 0, duration: 0.04 }, 0.02);
          const at = [0.14, 0.34, 0.53];
          DIVE.forEach((_, i) => {
            dive
              .fromTo(
                `.ld-cap-${i}`,
                { opacity: 0, y: 50 },
                { opacity: 1, y: 0, duration: 0.05 },
                at[i],
              )
              .to(`.ld-cap-${i}`, { opacity: 0, y: -40, duration: 0.05 }, at[i]! + 0.15);
          });
          dive
            .fromTo(".ld-gap", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.05 }, 0.73)
            .fromTo(".ld-legend-3d", { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.74)
            .to(".ld-gap, .ld-legend-3d", { opacity: 0, y: -30, duration: 0.04 }, 0.93)
            .fromTo(
              ".ld-punch",
              { opacity: 0, scale: 0.94 },
              { opacity: 1, scale: 1, duration: 0.05 },
              0.94,
            )
            .to({}, { duration: 0.01 }, 0.99);

          // --- Change: real Sentinel-2, 2019 → 2024 ----------------------
          const change = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: ".ld-change",
              start: "top top",
              end: "+=180%",
              pin: true,
              scrub: 0.8,
            },
          });
          change
            .fromTo(
              ".ld-after",
              { clipPath: "inset(0 0 0 100%)" },
              { clipPath: "inset(0 0 0 0%)", duration: 1 },
              0.1,
            )
            .fromTo(".ld-wipe", { left: "100%" }, { left: "0%", duration: 1 }, 0.1)
            .to(".ld-year-a", { yPercent: -100, duration: 0.3 }, 0.55)
            .to(".ld-year-b", { yPercent: -100, duration: 0.3 }, 0.55)
            .fromTo(
              ".ld-change-copy p",
              { opacity: 0.25 },
              { opacity: 1, stagger: 0.2, duration: 0.3 },
              0,
            );

          // --- Method: horizontal pinned track (desktop) ------------------
          mm.add("(min-width: 900px)", () => {
            const track = el.querySelector<HTMLElement>(".ld-track")!;
            const dist = () => track.scrollWidth - window.innerWidth;
            const move = gsap.to(track, {
              x: () => -dist(),
              ease: "none",
              scrollTrigger: {
                trigger: ".ld-method",
                start: "top top",
                end: () => `+=${dist()}`,
                pin: true,
                scrub: 1,
                invalidateOnRefresh: true,
                onUpdate: (st) => gsap.set(".ld-method-bar i", { scaleX: st.progress }),
              },
            });
            el.querySelectorAll<HTMLElement>(".ld-panel").forEach((panel, i) => {
              ScrollTrigger.create({
                trigger: panel,
                containerAnimation: move,
                start: "left 62%",
                end: "right 38%",
                toggleClass: "is-on",
                onToggle: (st) =>
                  st.isActive &&
                  el
                    .querySelectorAll(".ld-method-steps li")
                    .forEach((li, j) => li.classList.toggle("on", j === i)),
              });
              gsap.from(panel.querySelectorAll(".ld-panel-copy > *"), {
                y: 40,
                opacity: 0,
                stagger: 0.06,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: panel,
                  containerAnimation: move,
                  start: "left 85%",
                  end: "left 45%",
                  scrub: true,
                },
              });
            });
          });
          mm.add("(max-width: 899px)", () => {
            el.querySelectorAll<HTMLElement>(".ld-panel").forEach((panel) =>
              ScrollTrigger.create({
                trigger: panel,
                start: "top 70%",
                end: "bottom 30%",
                toggleClass: "is-on",
              }),
            );
          });

          // --- Platform: staggered reveal ---------------------------------
          ScrollTrigger.batch(".ld-card", {
            start: "top 88%",
            onEnter: (b) =>
              gsap.from(b, {
                y: 70,
                opacity: 0,
                rotateX: -12,
                duration: 1,
                ease: "expo.out",
                stagger: 0.07,
              }),
            once: true,
          });

          // --- Ledger stamps ------------------------------------------------
          el.querySelectorAll(".ld-ledger-col").forEach((col, i) => {
            gsap.from(col, {
              y: 60,
              opacity: 0,
              duration: 0.9,
              ease: "power3.out",
              delay: i * 0.1,
              scrollTrigger: { trigger: ".ld-ledger", start: "top 70%" },
            });
            gsap.fromTo(
              col.querySelector(".ld-stamp"),
              { scale: 2.4, opacity: 0, rotate: -24 },
              {
                scale: 1,
                opacity: 1,
                rotate: i === 1 ? 6 : -8,
                duration: 0.5,
                ease: "back.out(2.2)",
                delay: 0.5 + i * 0.18,
                scrollTrigger: { trigger: ".ld-ledger", start: "top 70%" },
              },
            );
          });

          // --- Section titles ------------------------------------------------
          el.querySelectorAll<HTMLElement>(".ld-title").forEach((t) => {
            const s = new SplitText(t, { type: "lines,words", mask: "lines" });
            gsap.from(s.words, {
              yPercent: 105,
              duration: 1,
              ease: "expo.out",
              stagger: 0.03,
              scrollTrigger: { trigger: t, start: "top 82%" },
            });
          });

          // --- CTA ------------------------------------------------------------
          const cta = new SplitText(".ld-cta h2", { type: "words,chars" });
          gsap.from(cta.chars, {
            yPercent: 120,
            rotate: 8,
            opacity: 0,
            ease: "back.out(1.6)",
            stagger: 0.018,
            duration: 0.9,
            scrollTrigger: { trigger: ".ld-cta", start: "top 70%" },
          });
          gsap.fromTo(
            ".ld-cta-bg",
            { scale: 1.25, yPercent: -8 },
            {
              scale: 1,
              yPercent: 8,
              ease: "none",
              scrollTrigger: {
                trigger: ".ld-cta",
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );
        });

        mm.add("(prefers-reduced-motion: reduce)", () => {
          scene?.setProgress(0.9);
          el.classList.add("is-static");
          el.querySelectorAll<HTMLElement>("[data-count]").forEach(
            (c) => (c.textContent = Number(c.dataset["to"]).toLocaleString("en-IN")),
          );
        });
      }, el);
      cleanups.push(() => ctx.revert());

      // intro curtain
      window.setTimeout(() => {
        if (!disposed) setReady(true);
        scene?.setProgress(0);
        ScrollTrigger.refresh();
      }, 450);
    })();

    return () => {
      disposed = true;
      cleanups.reverse().forEach((c) => c());
    };
  }, []);

  // 3D tilt on platform cards
  const tilt = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--rx", `${-y * 7}deg`);
    e.currentTarget.style.setProperty("--ry", `${x * 9}deg`);
    e.currentTarget.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  };
  const untilt = (e: React.PointerEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="ld" ref={root}>
      <div className={`ld-curtain ${ready ? "is-gone" : ""}`} aria-hidden="true">
        <img src={logo} alt="" />
        <span>निर्वाण</span>
      </div>

      <div className="ld-progress" aria-hidden="true">
        <i />
      </div>

      <nav className="ld-nav" aria-label="Landing">
        <a href="#top" className="ld-brand">
          <img src={logo} alt="" />
          <span>
            <b>NIRVANA</b>
            <small>निर्वाण</small>
          </span>
        </a>
        <div className="ld-nav-links">
          <a href="#dive">The dive</a>
          <a href="#method">The method</a>
          <a href="#platform">Platform</a>
          <a href="#ledger">Ledger</a>
        </div>
        <a href="/dashboard" className="ld-btn ld-btn-light">
          Open Dashboard <ArrowUpRight size={15} />
        </a>
      </nav>

      {/* Small screens lose the nav links at 1100px and the dashboard CTA at
          560px, which reduced the header to a bare logo. This is a compact
          scroll rail so the page stays navigable on a phone. */}
      <nav className="ld-jump" aria-label="Sections">
        <a href="#dive">Dive</a>
        <a href="#method">Method</a>
        <a href="#platform">Platform</a>
        <a href="#ledger">Ledger</a>
        <a href="/dashboard" className="ld-jump-cta">
          Open
        </a>
      </nav>

      {/* ============================ THE DIVE ============================ */}
      <section className="ld-dive" id="top">
        <span id="dive" className="ld-anchor" />
        <canvas
          ref={canvas}
          className="ld-canvas"
          aria-label="3D map: India, then Maharashtra, then 2,457 real land-record plots in Vadnerbhairav rising from the ground"
        />
        <div className="ld-vignette" aria-hidden="true" />
        <div className="ld-grain" aria-hidden="true" />

        <header className="ld-hero">
          <span className="ld-kicker ld-fade">Land · Data · Policy — भूमि · डेटा · नीति</span>
          <h1>
            Every plot of land has two stories. <em>One is written down. One is on the ground.</em>
          </h1>
          <p className="ld-fade">
            Nirvana reads the record and the satellite side by side, finds where they disagree, and
            turns the fix into evidence a policymaker can defend.
          </p>
          <div className="ld-hero-ctas ld-fade">
            <a href="/dashboard" className="ld-btn ld-btn-saffron">
              Enter the dashboard <ArrowRight size={16} />
            </a>
            <a href="#method" className="ld-btn ld-btn-ghost">
              See the method
            </a>
          </div>
        </header>

        <div className="ld-cue" aria-hidden="true">
          <span>Scroll to dive</span>
          <ArrowDown size={15} />
        </div>

        {DIVE.map((d, i) => (
          <aside key={d.k} className={`ld-cap ld-cap-${i} ${d.side}`}>
            <span className="ld-kicker">{d.k}</span>
            <p>{d.t}</p>
            <small>{d.s}</small>
          </aside>
        ))}

        <aside className="ld-gap">
          <span className="ld-kicker">04 · The gap</span>
          <p>Colour is the gap between each drawn plot and its 7/12 record.</p>
          <div className="ld-counts">
            <Counter id="match" to={1036} color="#39c47a" label="within 10 %" />
            <Counter id="gap" to={853} color="#e3a832" label="off by 10–30 %" />
            <Counter id="wide" to={557} color="#e0553d" label="off by 30 % or more" />
          </div>
          <small>
            A screening signal, not a verdict — roads, channels and pot-kharaba explain some of it.
            Telling which is our job.
          </small>
        </aside>
        <div className="ld-legend-3d" aria-hidden="true">
          Height = drawn plot area · Colour = map vs record · Real data, Vadnerbhairav
        </div>

        <div className="ld-punch">
          <p>
            This is where land disputes begin.
            <br />
            <em>We built the machine that finds them — and proves what fixes them.</em>
          </p>
        </div>
      </section>

      {/* ============================ CHANGE ============================ */}
      <section className="ld-change">
        <div className="ld-change-media">
          <Tiles year={2019} />
          <div className="ld-after">
            <Tiles year={2024} />
          </div>
          <div className="ld-wipe" aria-hidden="true" />
          <span className="ld-side l">2019</span>
          <span className="ld-side r">2024</span>
          <div className="ld-years" aria-hidden="true">
            <span className="ld-year-a">2019</span>
            <span className="ld-year-b">2024</span>
          </div>
          <span className="ld-credit">
            Hinjewadi & Maan, Pune · Sentinel-2 cloudless 2019 / 2024 · © EOX, Copernicus · real
            imagery
          </span>
        </div>
        <div className="ld-change-copy">
          <span className="ld-kicker dark">What changed</span>
          <h2 className="ld-title">Five years. The same survey numbers. A different place.</h2>
          <p>Farms on Pune’s western edge became an IT corridor between these two images.</p>
          <p>
            A satellite passes over every five days. A land record changes when someone walks into
            an office.
          </p>
          <p>
            <b>Nirvana lives in that gap.</b>
          </p>
        </div>
      </section>

      {/* ============================ METHOD ============================ */}
      <section className="ld-method" id="method">
        <div className="ld-method-head">
          <span className="ld-kicker dark">The method</span>
          <h2 className="ld-title">Seven moves from doubt to evidence.</h2>
          <ol className="ld-method-steps">
            {METHOD.map((m, i) => (
              <li key={m.id} className={i === 0 ? "on" : ""}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {m.verb}
              </li>
            ))}
          </ol>
          <div className="ld-method-bar" aria-hidden="true">
            <i />
          </div>
        </div>
        <div className="ld-track">
          {METHOD.map((m, i) => (
            <article key={m.id} className="ld-panel">
              <div className="ld-panel-copy">
                <span className="ld-panel-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="ld-kicker dark">{m.verb}</span>
                <h3>{m.title}</h3>
                <p>{m.body}</p>
                <a href="/dashboard" className="ld-link">
                  Open in the dashboard <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="ld-panel-viz">
                <m.Viz />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============================ PLATFORM ============================ */}
      <section className="ld-platform" id="platform">
        <div className="ld-section-head">
          <span className="ld-kicker">The platform</span>
          <h2 className="ld-title">One ground truth. Ten instruments.</h2>
        </div>
        <div className="ld-bento">
          {MODULES.map((m) => (
            <a
              key={m.href}
              href="/dashboard"
              className={`ld-card ${m.size}`}
              onPointerMove={tilt}
              onPointerLeave={untilt}
            >
              {m.video && (
                <video
                  className="ld-card-video"
                  src={m.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                />
              )}
              {m.size === "xl" && (
                <div className="ld-card-chat" aria-hidden="true">
                  {QUESTIONS.slice(0, 3).map((q) => (
                    <span key={q}>{q}</span>
                  ))}
                </div>
              )}
              <div className="ld-card-body">
                <span className="ld-card-tag">{m.tag}</span>
                <h3>{m.name}</h3>
                <p>{m.body}</p>
              </div>
              <span className="ld-card-go" aria-hidden="true">
                <ArrowUpRight size={18} />
              </span>
              <span className="ld-card-shine" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      {/* ============================ LEDGER ============================ */}
      <section className="ld-ledger" id="ledger">
        <div className="ld-section-head">
          <span className="ld-kicker dark">The ledger</span>
          <h2 className="ld-title">
            What’s real, what’s modelled, what’s missing. We label every one.
          </h2>
        </div>
        <div className="ld-ledger-grid">
          {LEDGER.map((c) => (
            <div key={c.kind} className={`ld-ledger-col ${c.kind}`}>
              <span className="ld-stamp">{c.stamp}</span>
              <h3>{c.title}</h3>
              <ul>
                {c.rows.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="ld-cta">
        <img className="ld-cta-bg" src={landscape} alt="" aria-hidden="true" />
        <div className="ld-cta-shade" aria-hidden="true" />
        <div className="ld-cta-inner">
          <span className="ld-kicker">English · हिंदी · मराठी</span>
          <h2>Ask the land a question.</h2>
          <div className="ld-hero-ctas">
            <a href="/dashboard" className="ld-btn ld-btn-saffron">
              Enter the dashboard <ArrowRight size={16} />
            </a>
            <a href="#method" className="ld-btn ld-btn-ghost">
              See the method
            </a>
          </div>
        </div>
        <div className="ld-marquee" aria-hidden="true">
          <div>
            {[...QUESTIONS, ...QUESTIONS].map((q, i) => (
              <span key={i}>{q}</span>
            ))}
          </div>
        </div>
      </section>

      <footer className="ld-foot">
        <div className="ld-brand">
          <img src={logo} alt="" />
          <span>
            <b>NIRVANA</b>
            <small>Same land. More clarity. Better decisions.</small>
          </span>
        </div>
        <nav>
          <a href="#dive">The dive</a>
          <a href="#method">The method</a>
          <a href="#platform">Platform</a>
          <a href="#ledger">Ledger</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
        <p>
          Prototype built for the Smart India Hackathon. Not an official land record — every screen
          says what is real, modelled or missing.
        </p>
      </footer>
    </div>
  );
}
