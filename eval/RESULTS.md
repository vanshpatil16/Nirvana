# Evaluation results

Generated 2026-10-01 14:00 UTC · commit `af59fff` · app under test `http://localhost:8080`

Every number below was produced by the scripts in `eval/` against the code in this repository. Where a claim could not be measured, it says **NOT MEASURED** and names what is missing. Nothing is estimated.

## PROOF PANEL VALUES

* Conversion model: AUC NOT MEASURED ± NOT MEASURED · F1 NOT MEASURED · grouped 5-fold CV by NOT MEASURED · n = NOT MEASURED
* Cited copilot: RAGAS faithfulness NOT MEASURED · answer relevancy NOT MEASURED · citation precision 0.33 (retrieval stage only, clause level) · gold set of 50 questions
* Title Integrity rules: NOT MEASURED % recall (NOT MEASURED/60 seeded defects) · NOT MEASURED false alarms on NOT MEASURED clean parcels
* Safe NL-GIS: NOT MEASURED % valid plans (NOT MEASURED/100) · NOT MEASURED/20 adversarial prompts blocked · AI-written SQL reaching DB: 0
* Engineering: 0 tests passing · CI: yes (workflow file present; this script cannot tell whether it has run on GitHub) · docker compose up: doesn't

## What was measured instead, where the headline could not be

* **Copilot retrieval + citations (no LLM needed)** — gold instrument retrieved for 49/50 questions; exact supporting clause retrieved for 43/50; citation precision 0.325 at clause level and 0.890 at document level over 163 citations.
* **Validation layer under attack (no LLM needed)** — 20/20 hostile plans neutralised (6 rejected by the schema, 14 repaired to allow-listed values); prototype pollution: False.
* **NL-GIS, partial** — of the 9 requests the language model answered before the upstream failure: 9 schema-valid, 9 executed, 9 correct intent. Too few to report as a rate.
* **Verification harnesses** — `verify:sim`: 288 checks passed (exit 0); `verify:geometry`: exit 0; typecheck: exit 0; build: exit 0.
* **Separate backend repository (`landstack-api`, not this repo)** — pytest: 67 passed, 0 failed.

## 1. Conversion model — NOT MEASURED

* No trained model artefact (searched *.pkl, *.joblib, *.ubj, *.bst, *.onnx, *.model, *.cbm): none found
* No training / inference code importing xgboost or scikit-learn: none found
* No labelled feature table (searched *.parquet, *.csv, *.feather): none found
* xgboost and scikit-learn are not dependencies of this repo (package.json only; no requirements.txt / pyproject.toml).

Every mention of XGBoost is display text or a comment. The 'conversion probability' surface on /workflow is a closed-form function of distance to the city centre and to four hand-placed highway segments (src/components/workflow/SimulateScreen.tsx), labelled in code as a 'Synthetic model surface (stand-in for the XGBoost output…)'. src/data/data-sources.ts states the model metrics are SIMULATED.

Mentions of XGBoost in the source:

* `src/data/data-sources.ts:560: "SIH hackathon dataset: observation bands, model metrics (XGBoost/SHAP), federation router and guardrail scores are SIMULATED and labelled as such in `
* `src/components/workflow/data.ts:10: *   SIMULATED  federation router, XGBoost/SHAP surface, RAGAS score — run in`
* `src/components/workflow/SimulateScreen.tsx:33: // Synthetic model surface (stand-in for the XGBoost output; trained labels are`
* `src/components/workflow/SimulateScreen.tsx:639: Agriculture → built-up within {applied.l.horizon} years · XGBoost, trained on real`

To make it measurable: A labelled table: one row per village/parcel with features and a 2019→2024 agriculture→built-up label, plus a taluka or district column for grouping. The label can be built from data this project already uses: Esri / Impact Observatory 10 m annual land cover for 2019 and 2024 (zonal statistics per village or per plot). Training code and a saved model, so the same features and labels the model uses can be re-loaded here.

## 2. Cited copilot — RAGAS NOT MEASURED; retrieval stage measured

* Pipeline: `POST /api/ai` → planner → zod `validatePlan` → policy-library retrieval (`src/server/policy-context.ts`) → grounded answer.
* Retrieval is deterministic keyword scoring. **There is no BM25, vector index or knowledge graph in this repo.**
* Corpus: the Policy Lab library — 14 instruments, 152 evidence rows (68 stated explicitly in the documents). **No DILRMP documents or reports are in the corpus.**
* Gold set: `eval/gold_questions.jsonl`, 50 questions, each tied to one instrument, one clause and the exact supporting sentence.

* **Why not measured:** 47/50 questions were not answered by the language model (upstream LLM failure). No RAG score is reported for an incomplete run.

Retrieval stage, measured without the LLM (`eval/_retrieve.ts` runs the server's own `validatePlan` → `executePlan`):

| Measure | Value |
|---|---|
| Gold instrument among retrieved sources | 49/50 |
| Exact supporting clause among retrieved sources | 43/50 |
| Questions with nothing retrieved | 1 |
| Citation precision, clause level (cited quote is the supporting text) | 0.325 (163 citations) |
| Citation precision, document level (cited quote is from the right instrument) | 0.890 |

Clause-level precision is bounded by design: the copilot returns about three quotes per answer and usually one of them is the supporting sentence.

Questions whose supporting clause was not retrieved:

* `q03` (en) expected *Maharashtra Land Revenue Code, 1966 — Section 42(2), provisos (a)–(c)* — got Maharashtra Land Revenue Code, 1966 — Section 42(1); Maharashtra Land Revenue Code, 1966 — Section 42(2); Maharashtra Land Revenue Code, 1966 — Section 42(1)
* `q04` (hi) expected *Maharashtra Land Revenue Code, 1966 — Section 42(2)(b)* — got Maharashtra Land Revenue Code, 1966 — Section 42(1); Maharashtra Land Revenue Code, 1966 — Section 42(2); Maharashtra Land Revenue Code, 1966 — Section 42(1)
* `q09` (en) expected *Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 2(10)* — got Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 7(1); Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 2(4); Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 6(1)
* `q14` (en) expected *Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Preamble / assent note* — got Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 7(1); Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Sections 8 and 8AA; Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 2(4)
* `q15` (en) expected *Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 15* — got Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 7(1); Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Sections 8 and 8AA; Prevention of Fragmentation and Consolidation of Holdings Act, 1947 — Section 2(4)
* `q23` (mr) expected *Maharashtra Regional and Town Planning Act, 1966 — Section 38* — got nothing
* `q39` (en) expected *Package Scheme of Incentives 2019 (Maharashtra Industrial Policy) — Table 2 — Eligibility Criteria to LSI* — got Package Scheme of Incentives 2019 (Maharashtra Industrial Policy) — Incentive conditions (e); Package Scheme of Incentives 2019 (Maharashtra Industrial Policy) — Incentive conditions (c); Package Scheme of Incentives 2019 (Maharashtra Industrial Policy) — Incentive mechanism

## 3. Title Integrity rules — NOT MEASURED

* No rule engine: no function in the repo takes an ownership chain, deed list, mutation register or share table and returns rule violations (files with rule-like functions: none).
* No ownership-chain data model: there is no deed / mutation / succession / share record type to run rules over, and no Neo4j or other graph store (the only 'Neo4j' in the repo is a label on a UI chip).
* The 8 'integrity checks' and the Title Risk Score shown on /workflow are hard-coded per parcel in src/components/workflow/data.ts (`failed: ["Orphaned deed", "Ghost transfer", …]`, `score: 82`). They are not computed.

To make it measurable: A typed ownership-chain model (deeds, mutations, successions, shares with dates and areas) and one pure function per rule returning violations. Then this script generates 200 seeded parcels, plants 10 defects per rule, and reports recall / false positives / precision against saved ground truth.

## 4. Safe NL-GIS — prompt-level run NOT MEASURED; validation layer and SQL path measured

* Validation layer: zod (src/copilot/plan.ts) — no Pydantic exists in this repo.
* There are no SQL query templates: the data layer is typed in-memory functions (`src/server/copilot-data.ts`).
* **Why not measured:** Only 9/100 normal and 0/20 adversarial requests were answered by the language model; the rest hit an upstream LLM failure. Headline rates are NOT reported for an incomplete run. Partial figures cover answered requests only.
* **AI-written SQL reaching a database: 0.** No database client in dependencies or source, and no code path executes a SQL/Cypher string; the data layer is typed in-memory functions. The .sql files are static PostGIS loader scripts emitted by scripts/import_parcels.py and are never executed by the app. (207 source files scanned; database dependencies: none; static .sql files: ['src\\data\\cadastral\\vadnerbhairav-chandwad.sql'].)
* Validation-layer attack: 20/20 hostile plans neutralised. Assumes a fully compromised planner: hostile plans are fed straight to the validation layer.
* Residual risk: 1 case(s) carried hostile text in a free-text slot (place name ≤120 chars, topic ≤200 chars). It is never executed — there is no database — but it is interpolated into result labels and into the explainer prompt, so it remains a prompt-injection surface.

## 5. Engineering

* Unit / integration tests in this repo: **0 passing, 0 failing** — This repo has no unit/integration test suite (no test runner dependency, no test files, no pytest).
* `npm run verify:sim`: 288 assertion checks passed (exit 0). These are harness assertions on the Policy Lab engine, not a unit-test suite.
* `npm run verify:geometry`: exit 0 (prints geometry statistics; it asserts nothing that can fail a count).
* `npm run typecheck`: exit 0.
* `npm run build`: exit 0 in 24.6 s.
* docker-compose at top level: none · Dockerfile: none → `docker compose up`: **not runnable — no compose file exists**.
* CI: **yes** — .github/workflows/ci.yml (the workflow file exists; whether it has ever run on GitHub is not something this script can observe).
* `npm run lint` is not part of these results: on this repo it did not finish within 30 minutes, and it is left out of CI for that reason.
* Separate backend repo `landstack-api`: pytest 67 passed / 0 failed (exit 0). It has no docker-compose file either.

## Reproduce

```sh
npm install && npm run dev                       # app under test on http://localhost:8080 (needs OPENROUTER_API_KEY with credits for items 2 and 4)
python -m venv .venv-eval && .venv-eval/Scripts/pip install -r eval/requirements.txt   # RAGAS (bin/ instead of Scripts/ on macOS/Linux)

python eval/model_eval.py                        # item 1
python eval/rag_eval.py                          # item 2 (use the .venv-eval python for RAGAS)
python eval/rules_eval.py                        # item 3
python eval/nlgis_eval.py                        # item 4
python eval/eng_eval.py                          # item 5   (LANDSTACK_API_DIR=<checkout> adds the backend pytest run)
python eval/run_all.py                           # all of the above → eval/results.json + eval/RESULTS.md

npx tsx eval/_retrieve.ts                        # LLM-free retrieval on the gold set
npx tsx eval/_fuzz_plan.ts                       # LLM-free validation-layer attack
npm run verify:sim && npm run verify:geometry && npm run typecheck
```

Raw responses and per-question rows are in `eval/out/`.

## Run notes (written by hand for the run of 2026-10-01)

* **Why items 2 and 4 are incomplete.** The app's language model is reached through OpenRouter. During this run OpenRouter answered `402 — This request would exceed your available credits`; its key endpoint reported `total_credits: 0`, `usage: 0.19`, free tier. Nine NL-GIS requests and three gold questions were answered before the cut-off; the rest fell back to the platform's no-model reply. Re-run `python eval/run_all.py` once the key has credits — expect roughly 340 model calls to `openai/gpt-4o-mini` plus the RAGAS judge and embedding calls.
* **A product fix made while evaluating.** `POST /api/ai` used to return `200 ok: true` with the model name attached even when the model had not answered. It now returns `degraded: true`, `planner.status` (`ok` / `schema_invalid` / `upstream_error`), `answerGenerated`, and a visible warning note, and no longer lists an "AI explanation" source when none was generated. The evaluation scripts depend on these fields to tell an upstream failure from a model result.
* **RAGAS environment.** `eval/requirements.txt` pins a set verified to import on Python 3.13 (ragas 0.2.15 with the 0.3-series LangChain). It was installed and imported successfully but has not produced a score, because there were no model answers to judge.
* **Lint.** `npm run lint` did not finish within 30 minutes on this machine and is not part of these results or of CI.
* **Stack named in the brief vs this repository.** The brief describes a FastAPI backend, PostGIS, Neo4j, an XGBoost model, a RAG pipeline with BM25 + vectors, Pydantic validation and six Title Integrity rules. This repository is a TypeScript app (TanStack Start) with edge handlers. Of those, it contains: an LLM planner with zod validation, a typed in-memory data layer, and keyword retrieval over a library of 14 Acts and policies. The FastAPI service is a separate repository (`landstack-api`) and is a data-source gateway — it contains no model, rules engine or RAG either.
