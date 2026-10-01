# Master prompt: build what is missing, then measure it

Paste everything below this line into the AI builder, with the repository open.

---

You are working in the repository for NIRVANA (earlier named BHUMI-NITI), a land-governance platform built for Smart India Hackathon 2026. Our pitch deck makes five technical claims. A previous evaluation pass found that only parts of them can be measured today, because some of the components the deck describes do not exist as code. Your job is to build the missing components that genuinely belong in this product, then measure all five claims and report the numbers.

The numbers go on a slide that judges will question us about, so they must be real. A small honest number is useful to us. An impressive number we cannot reproduce in front of a judge is worse than no number.

## Ground rules

These apply to everything you do.

1. Never invent, estimate, or round up a number. Every value you report must come from a script in `eval/` that anyone can re-run, with a fixed random seed where randomness is involved.
2. If something cannot be measured, write `NOT MEASURED`, say exactly what is missing, and stop for that item. Do not substitute a proxy and report it under the original name.
3. Never fabricate government data. Do not generate fake parcel polygons, fake ownership records, or fake legal text and present them as real. Synthetic test fixtures are allowed only where this prompt says so, and they must be labelled synthetic in the file, in the code, and in the report.
4. Never serve or store owner or holder names. The platform does not expose personal data, and the evaluation must not introduce any.
5. Do not tune a component on the same examples you report its score on. Where you improve something against a test set, split the set first and report the held-out part, or say plainly that the score is on a set the component was tuned against.
6. Do not add a technology only because the deck names it. If the deck says Neo4j, PostGIS, Pydantic, or BM25 and the product works without it, leave it out and tell us to change the deck wording. Section "What to tell us about the deck" covers this.
7. Git: this project is connected to Lovable, and commits on `main` sync to the live editor. Work on a new branch named `eval-build`. Never force-push, rebase, amend, or squash commits that are already pushed. Do not push to `main`. Keep the branch building at every commit.
8. Secrets: API keys live in `.env`, which is git-ignored. Load them from the environment, never print them, never copy them into a file that is tracked.
9. Match the existing code style. The TypeScript is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`), and `npm run typecheck` must pass after every change.

## What the repository actually is

Read this before you trust anything the deck says.

- A TypeScript app: TanStack Start, React 19, Vite, MapLibre, CesiumJS, Tailwind. Server code runs as edge handlers defined in `src/server.ts`. Start it with `npm run dev`; it serves on `http://localhost:8080`.
- There is no database. Data is read from typed in-memory modules and from live public APIs.
- A separate repository, `landstack-api`, holds a FastAPI data gateway. It has 67 passing pytest tests and contains no model, rule engine, or retrieval code. It is out of scope unless you are told otherwise.
- The copilot lives at `POST /api/ai`, implemented in `src/server/ai-agent.ts`. Its pipeline is: detect language, force the language model to emit a query plan as a tool call, validate the plan with zod in `src/copilot/plan.ts`, run the plan with typed runners in `src/server/copilot-data.ts`, then ask the model to explain the result. The model is `openai/gpt-4o-mini` through OpenRouter.
- Policy retrieval is `src/server/policy-context.ts`: deterministic keyword scoring over the Policy Lab library in `src/data/policySimulation/library/`, which holds 14 instruments and 152 evidence rows.
- Real cadastral geometry: `src/data/cadastral/vadnerbhairav-chandwad.json`, 2,457 plots for Vadnerbhairav village, Chandwad taluka, Nashik district, with a map-area versus record-area comparison per plot. It carries no ownership or transaction history.
- The `/workflow` route (`src/components/workflow/`) is a demo story. Its numbers are hard-coded display values: a list of failed integrity checks, a score of 82, "RAGAS 0.94", and a probability surface computed from a hand-written formula. The header of `src/components/workflow/data.ts` says these are simulated.
- `npm run verify:sim` (288 checks) and `npm run verify:geometry` are check scripts, not unit tests. There is no test runner and there are no test files.

## What already exists in `eval/`

Read `eval/RESULTS.md` first. It records the last run and the reasons each item is incomplete. Reuse this harness; do not start a second one.

- `eval/_common.py`: shared helpers, including `ask()` for calling the copilot and `llm_failed()` for detecting a reply the model did not actually produce.
- `eval/rag_eval.py` with `eval/gold_questions.jsonl` (50 questions with a reference answer and the supporting clause) and `eval/_retrieve.ts` (retrieval without the model).
- `eval/nlgis_eval.py` (100 normal prompts and 20 adversarial prompts) with `eval/_fuzz_plan.ts` (hostile plans fed straight to the validator).
- `eval/eng_eval.py`: tests, typecheck, build, Docker, CI.
- `eval/model_eval.py` and `eval/rules_eval.py`: today these only search for the component and report that it is absent. You will replace their bodies with real evaluations once the components exist.
- `eval/run_all.py`: runs all five and writes `eval/results.json` and `eval/RESULTS.md`.
- `eval/requirements.txt`: a pinned RAGAS set that imports cleanly on Python 3.13. Newer RAGAS with newer LangChain fails on import, so keep the pins unless you verify a replacement.

The copilot API reports `degraded: true`, `planner.status`, and `answerGenerated: false` when the language model did not answer. The evaluators treat any such reply as "not answered" and refuse to score a run that contains one. Keep that behaviour. The last run stopped because the OpenRouter key had no credits and returned HTTP 402.

## Before you build: check the language model works

Send one request to `POST /api/ai` and confirm `degraded` is false. If it is true, stop and tell us the model is unreachable and why. Items 2 and 4 cannot be completed without it. Do not switch to a different model or provider on your own, because the number must describe the model the product ships with. If we tell you to switch, change it in the product, not only in the evaluation.

## The five items

For each item: decide whether the component belongs in the product, build it if it does, then measure it. Where this prompt gives a recommendation, follow it unless what you find in the repository contradicts it, and tell us if it does.

### 1. Conversion model

Claim: a model predicts which land is likely to convert from agricultural to built-up use.

Belongs in the product: yes, if and only if real labels can be built. The app already uses Esri Sentinel-2 land cover for 2019 and 2024; find how it is accessed in the repository before you plan anything.

Build:
- A labelled table of spatial units (villages or grid cells) in Maharashtra, where the label is observed conversion from cropland to built area between an earlier and a later land-cover year. The label must come from the real land-cover data.
- Features that were knowable before the label period: distance to roads and towns, earlier land-cover shares, population, and whatever else the repository already has access to. Record the source of every feature.
- A gradient-boosted classifier (XGBoost) trained by a script in a new top-level `ml/` directory, with the dataset build and the training as separate, re-runnable scripts.

Watch for leakage, which is the main way this number goes wrong: no feature may be derived from the later land-cover year, and neighbouring cells must not be split across training and test folds.

Measure: grouped 5-fold cross-validation, grouped by taluka or district so that a whole area is held out together. Report AUC as mean and standard deviation across folds, F1 at a threshold chosen inside the training folds, the number of rows, the positive rate, and the grouping key. Also report the AUC of a trivial baseline (for example, distance to the nearest town alone) so the judges can see what the model adds.

If real labels cannot be built from data we can legitimately access, stop and report `NOT MEASURED` with the exact obstacle. Do not train on synthetic labels.

### 2. Cited copilot

Claim: the copilot answers policy questions from the source documents and cites them.

Belongs in the product: it already exists. Measure it first, improve it second.

Measure first, changing nothing: run `eval/rag_eval.py` to get RAGAS faithfulness and answer relevancy, and citation precision, on the 50 gold questions. Record those numbers as the baseline.

Then improve, if you choose to: the last retrieval-only run found the exact supporting clause for 43 of 50 questions and had clause-level citation precision of 0.325, because the copilot cites several clauses per answer and most are from the right document but the wrong section. The misses were questions q03, q04, q09, q14, q15, q23, and q39; q23 is in Marathi and retrieved nothing. Before changing retrieval, split the gold set into a development half and a held-out half, tune only on the development half, and report the held-out half. Add a second retrieval method (BM25 or embeddings) only if it raises the held-out numbers; report both before and after.

Do not add documents to the corpus unless they are official public texts with a source URL recorded beside them. If you extend the corpus, add gold questions for the new documents written from the text, not from the copilot's own answers.

### 3. Title Integrity rules

Claim: six rules detect defects in a parcel's title chain.

Belongs in the product: yes. The Verify chapter of the product story depends on it, and today it is a hard-coded list.

Build: a deterministic rule engine as a TypeScript module (suggested location `src/integrity/`), with one pure function per rule and a typed record-chain input. The six rules named in the product are orphan deed, ghost transfer, temporal inversion, dormant succession, over-allocation, and partition area mismatch. Read `src/components/workflow/data.ts` for how each is described to users, write a precise definition of each rule in the module, and ask us if a definition is ambiguous. Use an in-memory graph; do not add a graph database.

Then wire the `/workflow` Verify screen to call the engine on its demo record, so the screen shows what the engine computes.

Test data: we have no real transaction or mutation history and must not invent any that looks real. Build a synthetic fixture, clearly labelled synthetic, with anonymous party identifiers such as `P-0001` and no names. It needs three parts:
- clean parcel chains with no defect;
- 60 seeded defects, 10 for each of the six rules;
- near-miss chains that resemble a defect but are legitimate, such as a transfer recorded one day after the deed it depends on. Without these, recall is trivially perfect and the number means nothing.

The script that seeds defects must be written separately from the rule code and must not import it, so the detector is not graded against its own logic. Fix the random seed. Where the real cadastral file gives you real values (parcel identifiers, areas), use them for the parcel side of the fixture.

Measure: recall overall and per rule out of the 60 seeded defects, false alarms on the clean chains, and false alarms on the near-miss chains reported separately. State in the report that the fixture is synthetic and that performance on real records is unknown.

### 4. Safe natural-language GIS

Claim: the copilot turns a question into a validated query plan, and no model-written query text reaches a data store.

Belongs in the product: it already exists.

Measure: run `eval/nlgis_eval.py` for the share of 100 normal prompts that yield a schema-valid plan, and the number of 20 adversarial prompts blocked. The pass criteria are written at the top of that script; do not loosen them after seeing results. The static scan that counts model-written SQL reaching a database currently finds 0, because there is no database. Keep reporting it that way, with that reason.

Fix one known weakness, then re-measure: hostile text in a free-text slot of the plan (a place name or topic) is passed through as text into result labels and into the prompt for the explanation step. It is never executed, but it is a prompt-injection path. Constrain or neutralise those slots, add cases for it to `eval/_fuzz_plan.ts`, and report the result before and after.

### 5. Engineering

Claim: the project is tested, has CI, and starts with one command.

Build:
- A unit test suite with Vitest. Cover the code where a bug would change what a user is told: plan validation (`src/copilot/plan.ts`), policy retrieval (`src/server/policy-context.ts`), the parcel store (`src/server/parcel-store.ts`), and the new rule engine. Tests must assert behaviour; do not write tests that only check a function exists.
- A `Dockerfile` and a `docker-compose.yml` at the top level, so `docker compose up` builds and serves the app. Verify it by running it and requesting a page. If Docker is not available where you are working, say so and report `docker compose up: not verified`.
- `.github/workflows/ci.yml` exists but has never run on GitHub. Add the test step to it and confirm one green run, or report that you could not confirm it.
- `npm run lint` did not finish in 30 minutes on the last attempt. Find out why (start with what ESLint is being asked to traverse), fix it, and add lint to CI once it finishes in reasonable time.

Measure: number of tests passing and failing, whether CI has a green run, and whether `docker compose up` served a page.

## After measuring: make the product tell the truth

Replace the hard-coded figures on `/workflow` ("RAGAS 0.94", the score of 82, any AUC or accuracy) with values read from `eval/results.json`, or mark them on screen as illustrative. A judge who sees one number on the slide and a different one in the product will stop trusting both.

## What to tell us about the deck

The deck names Pydantic, SQL templates, Neo4j, PostGIS, and BM25 plus vector retrieval. The product uses zod, typed in-memory runners, no database, and keyword retrieval. For each of these, either build it because it measurably improves the product, or give us the corrected wording for the slide. List these as a short table: what the deck says, what is true, and the sentence we should use instead.

## Deliverables

1. The components above, on branch `eval-build`, with typecheck, tests, and build passing.
2. `eval/` updated so `python eval/run_all.py` reproduces every number, writing `eval/results.json` and `eval/RESULTS.md`.
3. A final report, in this order:
   - where each component lives, as file paths;
   - the block below, in exactly this format, with only measured values and `NOT MEASURED` wherever a value is missing;
   - everything you could not measure and the exact reason;
   - the exact commands to reproduce every number;
   - the deck wording table;
   - anything you changed in the product outside `eval/`, `ml/`, and the new modules.

```
PROOF PANEL VALUES
* Conversion model: AUC __ ± __ · F1 __ · grouped 5-fold CV by __ · n = __
* Cited copilot: RAGAS faithfulness __ · answer relevancy __ · citation precision __ · gold set of __ questions
* Title Integrity rules: __ % recall (__/60 seeded defects) · __ false alarms on __ clean parcels
* Safe NL-GIS: __ % valid plans (__/100) · __/20 adversarial prompts blocked · AI-written SQL reaching DB: __
* Engineering: __ tests passing · CI: yes/no · docker compose up: works/doesn't
```

Work through the items in this order: 5 (tests and CI first, so later work is protected), 3, 4, 2, 1. Item 1 is the largest and the most likely to end in `NOT MEASURED`; do not let it delay the others. Report after each item with what you built and what you measured, then continue to the next one without waiting.

A note on the environment: the machine is Windows. Shell heredocs there corrupt backslash sequences, so write scripts to files and run them. Very deep directory paths break `pip`, so create Python virtual environments in a short path.
