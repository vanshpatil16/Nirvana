# Innovation Portal — Implementation Notes

> National digital platform for research, policy innovation and evidence-based land governance.
> Built to `BHUMI_NITI_Innovation_Portal_Specification.docx`.

The Innovation Portal is the execution layer between the BHUMI-NITI Research Hub, GIS intelligence,
datasets, policy simulations and the multilingual AI Copilot. It is deliberately **not** a hackathon
page: challenges, evidence, builds, pilots, measurements and policy learning are one connected
lifecycle rather than a set of unrelated cards.

**Status:** P0 and P1 complete — full lifecycle, collaborative workspace, evidence-first AI
assistant, causal evaluation, impact dashboard and national pilot tracker.
**Scale:** 10 challenges · 4 project workspaces · 13 modules each · 6 pilot sites · 2 policy
experiments (1 evaluable, 1 blocked) · 8 impact metrics · 6 submission steps.
**Verified:** `tsc --noEmit` clean · ESLint clean on all new files · production build succeeds ·
57 route/module combinations return HTTP 200 · all 8 assistant capabilities live-tested, 41/41
citations verified and 0 dropped.

**How to read the section numbers.** `§n` after an item refers to a section of the
*specification*, so any claim here can be checked against the source document. "See *X* below"
refers to a section of *this* file. The two numberings are deliberately kept distinct.

---

## 1. Running it

```bash
bun install          # 436 packages
bun run dev          # → http://localhost:8080
```

| Command | Purpose |
| --- | --- |
| `bun run dev` | Dev server with SSR + `/api/*` handlers → `http://localhost:8080` |
| `bun run build` | Production build (client + SSR + nitro Cloudflare bundle) |
| `bun run preview` | Preview the production build locally |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint over the whole repo |

With `OPENROUTER_API_KEY` configured (see **Configuration** below) both AI endpoints are live. Without a key each
returns a graceful `503` and its UI shows the error rather than failing silently — everything else
(map, parcels, weather, dashboard, and the whole Innovation Portal) works offline-first in demo
mode.

> **Environment note.** This workspace has no Node in WSL; the toolchain lives on the Windows side,
> so the dev server runs as a Windows `bun.exe` process. Consequently `http://localhost:8080` works
> from the Windows browser, but from WSL you must use the host address
> (`http://172.23.16.1:8080`) because WSL does not forward `localhost` to Windows.

---

## 2. Routes

| Route | Spec § | Purpose |
| --- | --- | --- |
| `/innovation` | §3 | Innovation home — hero, live pulse, pipeline, featured challenge, research bridge, pilot map, impact stories |
| `/innovation/challenges` | §2 | Searchable, filterable challenge discovery |
| `/innovation/challenges/:id` | §4 | Government-style challenge brief |
| `/innovation/submit` | §5 | Six-step autosaving submission wizard |
| `/innovation/workspace/:id` | §6, §7 | Collaborative project workspace (13 modules) |
| `/innovation/pilots` | §2, §9 | National pilot map + experiment tracker |
| `/innovation/impact` | §10 | Impact and outcome dashboard |
| `/innovation-portal` | — | Legacy entry point; **307 redirects** to `/innovation` |

### Workspace modules

`/innovation/workspace/:id?module=<id>` — all 13 ids are valid:

| Module | Spec § | Module | Spec § |
| --- | --- | --- | --- |
| `overview` | §6 | `experiments` | §6 |
| `evidence` | §6 | `pilots` | §6 |
| `research` | §6 | `decisions` | §6 |
| `gis` | §9 | `review` | §6 |
| `tasks` | §6 | `team` | §7 |
| `discussion` | §6 | `evaluation` | §9 |
| | | `assistant` | §8 |

### API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/innovation/ai` | Evidence assistant (§8). Needs `OPENROUTER_API_KEY`; returns `503` without it |
| `POST /api/ai` | Land-intelligence copilot (pre-existing) |

### URL state

Two pieces of state live in the query string so a view can be shared or bookmarked:

- `/innovation/challenges?q=&track=&state=&status=&stage=` — discovery filters.
- `/innovation/workspace/:id?module=` — the active workspace module, so a reviewer can be linked
  straight to the evidence locker, task board or decision log.

Unknown `:id` values return a real **404** (see *Notable implementation decisions* below).

---

## 3. File structure

```
src/
├── data/innovation/               # data layer — no component imports these concerns back
│   ├── challenges.ts              # challenge briefs + the evaluation rubric   (§4)
│   ├── ecosystem.ts               # lifecycle pipeline, pulse, bridge, stories (§3)
│   ├── workspace.ts               # projects, team roles, all workspace modules (§6, §7)
│   ├── submission.ts              # wizard step definitions + draft autosave    (§5)
│   ├── evaluation.ts              # DiD experiments + computeDid()             (§9)
│   ├── impact.ts                  # impact metrics, funnel, outcomes           (§10)
│   └── index.ts                   # barrel
├── components/innovation/
│   ├── InnovationShell.tsx        # shared sidebar + header frame
│   ├── InnovationPilotMap.tsx     # SSR-safe SVG map of India
│   ├── parts.tsx                  # Chip, StatusPill, SectionHead, Stat, Avatar, …
│   ├── home/InnovationHome.tsx
│   ├── challenges/InnovationChallenges.tsx
│   ├── challenge/InnovationChallengeDetail.tsx
│   ├── submit/InnovationSubmit.tsx
│   ├── evaluation/DidChart.tsx    # DiD chart + methodology (§9)
│   ├── pilots/InnovationPilots.tsx
│   ├── impact/ImpactDashboard.tsx
│   └── workspace/
│       ├── InnovationWorkspace.tsx
│       ├── workspaceModules.tsx   # the core module panels
│       └── AssistantPanel.tsx     # AI Research Assistant (§8)
└── routes/innovation/
    ├── index.tsx
    ├── challenges/index.tsx
    ├── challenges/$challengeId.tsx
    ├── submit.tsx
    ├── pilots.tsx
    ├── impact.tsx
    └── workspace/$projectId.tsx

src/server/innovation-ai.ts         # evidence assistant endpoint + citation verification

src/styles.css                     # appended "Innovation Portal (spec: /innovation/*)" block
```

The previous single `InnovationPortal.tsx` (822 lines, hackathon-style) and the flat
`src/data/innovation.ts` were removed. `routeTree.gen.ts` is generated — never edit it by hand.

---

## 4. The connected lifecycle

The spec's spine runs through the whole portal, and the labels are shared so the language never
drifts between screens:

```
Challenge → Evidence → Build → Review → Pilot → Measure → Policy Learning → Scale
```

- The home hero animates it as a node strip.
- `LIFECYCLE_PIPELINE` drives the status pipeline with a per-stage count and an explicit exit
  condition.
- Each challenge records its own `stage`, shown as a progress track on the brief.

---

## 5. Data model highlights

**Challenge** (§4) — a brief, not a card: `problemStatement`, `whyItMatters`, `geography`
(India/state/district/pilot blocks), a full `evidence` panel, `expectedOutputs`, `eligibility`,
`teamRequirements`, `timeline`, `evaluationCriteria`, and `resources`.

**Evidence panel** — every factual claim on a brief traces to one of: `ResearchPaper` (with a
stable `ref`), `EvidenceDataset` (provider, coverage, variables, **limitations**),
`GisLayerRef`, `landRecords`, `PolicyDoc`. Citations render verbatim so a reviewer can re-check them.

**Evaluation rubric** — `EVALUATION_CRITERIA`, weights summing to 100:
Evidence quality 25 · Governance value 20 · Measurable impact 20 · Feasibility 15 ·
Scalability 10 · Explainability 10. Published in advance; submissions are scored against exactly
these six.

**Workspace** (§6) — `Project` carries the overview, plus `evidence` (locker), `researchNotes`,
`tasks`, `threads`, `experiments`, `pilots`, `decisions`, `reviews` and `milestones`. The **task
board is interactive**: cards drag between columns (and each card has a select as a
keyboard/touch-accessible equivalent — drag-and-drop alone is not accessible).

Four workspaces ship: `proj-illegal-change` (ChangeShield, active pilot), `proj-mutation-delay`
(StageLag, measuring), `proj-flood-planning` (CharSuit, in build) and `proj-drone-cadastral`
(AerialParv, completed). In-app edits are **not** persisted — see *Known issues* below.

**Team roles** (§7) — all eight, including the restricted reviewer and read-only public viewer.
`Member.restricted` exists so review material can later be scoped to reviewers only.

**Policy experiment** (§9) — `DifferenceInDifferences` carries both arms as a `DidSeries`
(`periods` + `values`), plus `method`, `assumptions`, `parallelTrendCheck` and `threatsToValidity`.
`computeDid()` derives the effect from the four cell means and returns
`computable: false` with a reason when either arm lacks post-period data. Two experiments ship: one
evaluable, one deliberately blocked.

Missing post-period values are written as `Number.NaN` rather than `0` or a null placeholder, so an
absent measurement cannot be silently averaged as if it were a real zero.

**Impact metrics** (§10) — `ImpactMetric` pairs each value with a `viz` discriminator
(`counter | map | funnel | duration | percentage | experiments | outcomes | kpi-charts`) and the
spec's stated `purpose`. The dashboard dispatches on `viz` instead of hand-laying-out eight blocks.
Conversion rate and evidence-link rate are computed from the data layer, so the funnel cannot
disagree with the pipeline on the home page.

**Submission draft** (§5) — autosaved to `localStorage` under
`bhumi-niti.innovation.submission-draft.v1`. `loadDraft()` tolerates corrupt or partial stored
state (a schema change cannot break an in-progress submission), and `saveDraft()` swallows quota
errors because autosave is a convenience, not a requirement.

---

## 6. Notable implementation decisions

**Reused the existing design tokens instead of the spec's hex palette.** §11 names
`#006B46` / `#17231D` / `#F8F7F1` / `#EAF5EF` / `#E7B84B`. The app already implements that identity
as `--primary` (forest green), ivory ground, Newsreader display + Manrope sans. Reusing them keeps
the portal consistent with the other routes, so §11's palette is satisfied *by reference* rather
than hardcoded. Blue is used only for research/data states; red is reserved for warnings and
genuinely urgent deadlines (`daysLeft <= 30`).

**The pilot map is hand-projected SVG, not MapLibre.** The dashboard's `IndiaMap` needs a WebGL
context and a tile provider; the portal is server-rendered, so it must not. `InnovationPilotMap`
projects the same `india-states.json` GeoJSON to SVG with a standard-parallel cosine correction —
dependency-free, SSR-safe, and it degrades to keyboard-focusable `<path role="button">` states.
Interactive mapping stays in GIS Explorer, which the workspace links to (§9).

**Data lookups live in route `loaders`, not components.** Throwing `notFound()` from inside a
component produced a **200 with a blank body** that only failed after hydration. Moving the lookup
into a loader yields a real 404 status and the root `NotFoundComponent`, and removes the need for
non-null assertions on the data.

**Cross-links use plain `<a>`, not `<Link>`.** In this TanStack version `MakeRequiredSearchParams`
makes `search` **required** on `<Link>` for any route declaring `validateSearch` — including
pre-existing ones like `/gis-explorer`. Rather than thread a `search` prop through every call site,
secondary navigation uses `<a href>`, matching how `navItems` already works in the shell. `<Link>`
is kept where the target has no `validateSearch` (notably challenge briefs).

**Module selection is a real registry.** `WORKSPACE_MODULES` is the single source for the left nav,
the router's `MODULE_IDS` validation and the panel switch. Adding a module to one place wires all
three. (`Team & Roles` was initially a hardcoded extra button and silently fell back to Overview —
the registry avoids that class of bug.)

**The AI trust rule is enforced in code, not just prompted.** §8 requires that "AI should assist
discovery and synthesis, not invent evidence" and that factual claims expose their source. Two
mechanisms do that work in `src/server/innovation-ai.ts`:

1. The model only ever receives a bounded **source pack** — the challenge brief, the project's
   evidence locker, research notes, experiments, pilots, decisions and reviews — and is told to cite
   by source id and to declare anything it cannot answer.
2. Every returned citation is **validated against that same list**. A citation naming a source that
   was never supplied is dropped, and the response reports how many were dropped.

The UI renders that report verbatim: verified citations become clickable `[ref]` chips, and any
unverified reference is struck through. A hallucinated citation cannot survive to the screen. Verified
live, the assistant correctly refused an unanswerable question ("who won the 2019 election in
Chhattisgarh") and routed it to `cannotAnswer` rather than guessing, while still answering the part
it could.

**Difference-in-Differences effects are derived, never typed in.** `computeDid()` calculates
(treatedPost − treatedPre) − (controlPost − controlPre) from the four cell means. A project's own
before/after change is *not* the DiD effect, and conflating the two overstates the intervention.

This exposed a real error in the first pass of the demo data: the StageLag experiment log reported a
"DiD effect" of −15.1 days when −15 was the *treated arm's own change*. The correct DiD is −8 days
(treated −15, comparison −7). Both the experiment log and the new evaluation module now state all
three numbers and label which is which.

**Blocked experiments stay blocked.** `computeDid()` returns `computable: false` when either arm is
missing post-period data, and the chart refuses to draw an effect. The ChangeShield experiment is
deliberately in this state: Nashik has alerts, the Ahmednagar comparison arm has only a pre-period
baseline, so the counterfactual trend is unknown. The UI shows the treated arm's −64 day
before/after change *and* an explicit warning that it must not be reported as the intervention
effect — because that is precisely the failure mode a land-governance platform must not have.

**Filter facets show what you will actually get.** The challenge discovery stage bar originally printed
`LIFECYCLE_PIPELINE[].count` (18 / 14 / 27 …) while the filter matched `challenge.stage` against the 10
challenge briefs — so clicking a chip promising "18" showed 2 results. Two different populations were
being presented as one number. Facet counts are now **derived from the challenge set** under the other
active filters, excluding the facet's own dimension (standard faceted search), so the number on a chip
always equals the number of results you get. A stage with no matches renders at reduced opacity with
"0" rather than being hidden.

**Pipeline counts are cumulative, not per-stage.** `LIFECYCLE_PIPELINE[].count` means "reached at
least this stage", which keeps the series monotonic and therefore valid as the Research → Pilot
conversion funnel on the impact page. The earlier values (Build 27 > Challenge 18) described items
*sitting* at each stage, which cannot be drawn as a funnel — a "conversion" that grows at the Build
stage is not a conversion.

**Impact sections are titled from the metric's own label, not its `purpose`.** §10 pairs each metric
with a visualisation and a purpose, and the two are easy to confuse: "Average pilot duration" is the
*metric*, "Implementation speed" is its *purpose*. The first pass titled the section from `purpose`,
so the spec's metric name never appeared on the page. Section headings now use `label` and the
`purpose` is shown as the description.

**`Chip`/`StatusPill` encode urgency, not decoration.** `daysLeft <= 30` flips the pill to red so
approaching deadlines stand out without spamming red elsewhere.

---

## 7. Spec coverage

### Delivered — P0 and P1 complete

- [x] Innovation home — hero, live statistics, featured challenges, pipeline, research-to-innovation bridge, India pilot map, impact stories (§3)
- [x] Challenges discovery with search + filters (§2)
- [x] Challenge detail brief — PS, geography, evidence, datasets, GIS layers, eligibility, team requirements, timeline, evaluation criteria, resources, CTAs (§4)
- [x] Six-step autosaving submission wizard with a visible completion indicator (§5)
- [x] Collaborative workspace — 13 modules: overview, evidence locker, research board, GIS, kanban, discussion, experiment log, pilot tracker, decision log, review, team roles, policy experiment, AI assistant (§6, §7)
- [x] Team roles incl. restricted reviewer and public viewer (§7)
- [x] **Evidence-first AI assistant** (§8) — all 8 capabilities behind `POST /api/innovation/ai`, grounded in a source pack, with server-side citation verification
- [x] **Policy experimentation & DiD** (§9) — `Difference-in-Differences` charts with methodology, assumptions, parallel-trend check and threats to validity always visible; blocked experiments reported as blocked
- [x] **Standalone `/innovation/pilots`** (§2) — national pilot map, pilot list, experiment tracker
- [x] **Impact dashboard** (§10) — all 8 specified metrics, each with its required visualisation
- [x] GIS integration — attached layers, study regions, links to GIS Explorer and `/landdifference`
- [x] Research-resource linking — papers, datasets, policy documents and layers attached to challenges
- [x] Collaboration — discussion threads with `@mentions` linked into the decision log

### Not built (P2/P3)

- [ ] Grants & fellowship management as a first-class module (calls and eligibility exist as
      challenge data, but there is no application workflow)
- [ ] Recommendations engine
- [ ] Policy-experiment *templates* (the evaluation model exists; no template library)
- [ ] External APIs, institutional integrations, digital-twin and federated-data workflows

### Known scope gaps inside delivered features

- Assistant responses are **not stored**, so an answer cannot be re-read, cited later, or promoted
  into the decision log. Deliberately omitted: there is no persistence layer at all (see *Known issues* below), and
  session history on top of in-memory state would create a second thing that silently loses data.
- `find_evidence` and `similar_pilots` are the only two actions that widen the source pack to include
  other workspaces and the research bridge. The other six see one project's evidence and the
  challenge brief — a deliberate limit so the model is never handed a wider view than the task
  warrants.
- The 8 assistant capabilities are complete; what is *not* built is a grants/fellowship module, a
  recommendations engine, policy-experiment templates, and the P3 external integrations.

---

## 8. Accessibility notes

- Every map state is a keyboard-focusable `role="button"` with an `aria-label` naming its counts.
- Kanban cards expose a `<select>` column picker so the board is operable without drag-and-drop.
- Filters use `aria-pressed`; the pipeline filter row and wizard step rail use `aria-current="step"`.
- The wizard completion bar is a real `role="progressbar"` with `aria-valuenow`.
- Status and live-region messaging (`Draft saved…`, wizard errors) is announced politely / via
  `role="alert"`.
- `prefers-reduced-motion` disables the pulse animation, card hover elevation and transitions.
- Every assistant capability is a real `<button>` with `aria-pressed`; the grounding report uses an
  icon plus text, never colour alone. Unverified citations are struck through *and* titled.
- The DiD chart exposes an `aria-label` summarising the outcome, and every number in it is also
  present as text (effect, both arm changes, the difference) — the SVG is never the only carrier of
  the result.
- Impact counters state their trend as `+12%` / `−3%` text alongside the arrow icon.

---

## 9. Demo data — read this before demoing

Every figure is illustrative. Nothing here is official government data, and the UI says so on
screen.

- `DemoNote` markers appear on the innovation pulse, challenge briefs, the evidence locker, the
  pilot tracker and the map legend.
- Impact stories carry a `prototype` flag. The Assam flood story is explicitly labelled
  **"Modelled — not yet measured"**, and its decision log records the rule that no outcome claim is
  made until crop-loss validation completes.
- The spec's own trust rule (§8) is honoured structurally rather than cosmetically: the evidence
  locker keeps each item's `caveat` visible, the experiment log records `assumptions` beside every
  metric, and the review panel marks a "Revision requested" state.
- `INNOVATION_PULSE`, `LIFECYCLE_PIPELINE` counts, KPI values, reviewer scores and the GIS layer
  list are all invented for interface development.
- All 10 challenges, 4 workspaces, 6 pilot sites and both policy experiments are fictional. The
  institutions named (Department of Land Resources, NITI Aayog, Survey of India, Ministry of Tribal
  Affairs, Department of Justice) are real bodies, but the specific challenges, datasets, deadlines,
  funding figures and outcomes attributed to them are not real and must not be presented as
  government announcements.
- The impact dashboard mixes the two honestly: derived figures (conversion rate, evidence-link rate)
  are computed from the demo data, while the pilot-duration distribution and completed-pilot outcome
  cards are authored values and would need a real analytics source in production.
- The assistant is the one component that is NOT demo data — it makes real model calls over real
  source packs. Its *answers* are still model output and still need review, which is why every one
  is labelled "AI-generated" and why the grounding report is rendered next to it.

---

## 10. Configuration

The evidence assistant and the existing copilot both read the same two variables:

```bash
OPENROUTER_API_KEY=sk-or-v1-…
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Store them in `.env` at the repo root (gitignored; only `.env.example` is tracked). `vite.config.ts`
copies `.env` into `process.env` for the dev/build process, so the server routes can read the key
without it ever reaching the client bundle. On a deployed edge runtime the key arrives as a plain env
binding instead and `readEnv()` prefers that.

Without a key, `POST /api/innovation/ai` returns a graceful `503` and the assistant panel shows the
error rather than failing silently. The rest of the portal is unaffected.

> **Rotate this key.** It was shared in plaintext while configuring this work. Anyone with access to
> that transcript can spend against the account.

---

## 11. Known issues

**Repository-wide CRLF lint noise.** The working tree differs from git HEAD on *every* file purely
by line endings (Windows checkout), so `bun run lint` reports ~47k pre-existing
`Delete ␍` errors. This is environmental and predates this work — it was deliberately not "fixed",
because doing so would reformat the entire repo. New files are written with LF and lint clean. Worth
addressing separately with a `.gitattributes` or an `endOfLine` setting.

**No persistence.** Submission drafts live in `localStorage` only, and `submitDraft()` resolves a
reference id locally after a delay. There is no backend for submissions, workspaces or tasks, so
refreshes discard in-app edits (kanban moves, notes) that are not in the draft. The same applies to
assistant responses: nothing is stored, so a previous answer cannot be re-read or cited later.

**Every AI call costs money and takes seconds.** The assistant makes a real OpenRouter call per
request (~1–4 s). There is no caching, rate limit or cancellation, so rapid repeated clicking will
spend tokens. `AbortSignal.timeout` bounds it at 45 s server-side.

**Assistant answers are not reproducible.** Temperature is set to 0.2 to reduce drift, but the same
question can return a different framing. Verified citations are stable because they are validated
against the source pack, not because the model is deterministic.

**Pre-existing duplicate lifecycle labels.** `LIFECYCLE_PIPELINE` uses the spec's eight-stage
spine. The old portal had a different eight-label strip; the new one is the single source of truth
and the old constant is gone.

**Funnel and KPI bars are demo aggregates.** Conversion rate, evidence-link rate, pilot-duration
distribution and completed-pilot outcomes are authored demo values. Conversion rate and
evidence-link rate are *derived* from the data layer and so stay consistent with the rest of the
portal; the duration distribution and outcome cards are not, and would need a real analytics source.

**`InnovationPilotMap` projection is approximate.** An equirectangular projection with a cosine
correction keeps India recognisable at card size but is not survey-grade — appropriate for shading
states by pilot count, not for measuring geometry. Use GIS Explorer for real spatial analysis.
