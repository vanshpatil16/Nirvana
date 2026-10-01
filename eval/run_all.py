#!/usr/bin/env python3
"""Run every evaluation and write eval/results.json + eval/RESULTS.md.

    python eval/run_all.py                 # full run (needs `npm run dev` + LLM credits for items 2 and 4)
    python eval/run_all.py --reuse         # re-score cached LLM responses in eval/out/
    python eval/run_all.py --skip-build    # skip the production build in item 5

Nothing here invents a value: an item that cannot be measured is written as
NOT MEASURED together with exactly what is missing.
"""

from __future__ import annotations

import datetime as dt
import json
import subprocess
import sys

import eng_eval
import model_eval
import nlgis_eval
import rag_eval
import rules_eval
from _common import BASE_URL, EVAL, ROOT

NM = "NOT MEASURED"


def pct(count: int, of: int) -> str:
    return f"{count / of * 100:.0f}" if of else NM


def f2(x) -> str:
    return NM if x is None else f"{x:.2f}"


def git_head() -> str:
    try:
        return subprocess.run("git rev-parse --short HEAD", cwd=ROOT, shell=True, capture_output=True, text=True).stdout.strip()
    except Exception:
        return "unknown"


def panel(r: dict) -> list[str]:
    m, rag, rules, nl, eng = r["model"], r["rag"], r["rules"], r["nlgis"], r["engineering"]
    lines = []
    # 1 — conversion model
    lines.append(f"* Conversion model: AUC {NM} ± {NM} · F1 {NM} · grouped 5-fold CV by {NM} · n = {NM}")
    # 2 — cited copilot
    if rag.get("measured"):
        rg = rag["ragas"] or {}
        lines.append(
            f"* Cited copilot: RAGAS faithfulness {f2((rg.get('faithfulness') or {}).get('mean'))} · answer relevancy {f2((rg.get('answer_relevancy') or {}).get('mean'))} · "
            f"citation precision {f2(rag['deterministic']['citation_precision_clause_micro'])} · gold set of {rag['gold_set_size']} questions"
        )
    else:
        ro = rag.get("retrieval_only") or {}
        cp = f2(ro.get("citation_precision_clause_level")) if ro else NM
        lines.append(f"* Cited copilot: RAGAS faithfulness {NM} · answer relevancy {NM} · citation precision {cp} (retrieval stage only, clause level) · gold set of {rag.get('gold_set_size', NM)} questions")
    # 3 — rules
    lines.append(f"* Title Integrity rules: {NM} % recall ({NM}/60 seeded defects) · {NM} false alarms on {NM} clean parcels")
    # 4 — NL-GIS
    sql = (nl.get("sql") or {}).get("ai_written_sql_reaching_db")
    if nl.get("measured"):
        sv = nl["schema_valid"]
        lines.append(f"* Safe NL-GIS: {pct(sv['count'], sv['of'])} % valid plans ({sv['count']}/{sv['of']}) · {nl['adversarial_blocked']}/{nl['adversarial_total']} adversarial prompts blocked · AI-written SQL reaching DB: {sql}")
    else:
        lines.append(f"* Safe NL-GIS: {NM} % valid plans ({NM}/100) · {NM}/20 adversarial prompts blocked · AI-written SQL reaching DB: {sql if sql is not None else NM}")
    # 5 — engineering
    ut = eng["unit_tests"]
    ci = "yes (workflow file present; this script cannot tell whether it has run on GitHub)" if eng["ci"]["exists"] else "no"
    dc = "doesn't" if not eng["docker"]["compose_files_at_top_level"] else "untested"
    lines.append(f"* Engineering: {ut['passed']} tests passing · CI: {ci} · docker compose up: {dc}")
    return lines


def results_md(r: dict) -> str:
    m, rag, rules, nl, eng = r["model"], r["rag"], r["rules"], r["nlgis"], r["engineering"]
    o: list[str] = []
    w = o.append
    w("# Evaluation results")
    w("")
    w(f"Generated {r['generated_at']} · commit `{r['commit']}` · app under test `{r['base_url']}`")
    w("")
    w("Every number below was produced by the scripts in `eval/` against the code in this repository. Where a claim could not be measured, it says **NOT MEASURED** and names what is missing. Nothing is estimated.")
    w("")
    w("## PROOF PANEL VALUES")
    w("")
    o.extend(panel(r))
    w("")
    w("## What was measured instead, where the headline could not be")
    w("")
    ro = rag.get("retrieval_only") or {}
    if ro:
        gi, gq = ro["gold_instrument_retrieved"], ro["gold_supporting_quote_retrieved"]
        w(f"* **Copilot retrieval + citations (no LLM needed)** — gold instrument retrieved for {gi['count']}/{gi['of']} questions; exact supporting clause retrieved for {gq['count']}/{gq['of']}; citation precision {ro['citation_precision_clause_level']:.3f} at clause level and {ro['citation_precision_document_level']:.3f} at document level over {ro['citations_total']} citations.")
    va = nl.get("validation_layer_attack") or {}
    if va:
        w(f"* **Validation layer under attack (no LLM needed)** — {va['neutralised']}/{va['total']} hostile plans neutralised ({va['rejected_by_schema']} rejected by the schema, {va['repaired_by_validator']} repaired to allow-listed values); prototype pollution: {va['prototype_polluted']}.")
    part = nl.get("partial_over_answered_requests")
    if part and not nl.get("measured"):
        w(f"* **NL-GIS, partial** — of the {part['n']} requests the language model answered before the upstream failure: {part['schema_valid']} schema-valid, {part['executed']} executed, {part['intent_correct']} correct intent. Too few to report as a rate.")
    h = eng["verification_harnesses"]
    w(f"* **Verification harnesses** — `verify:sim`: {h['verify_sim'].get('checks_passed')} checks passed (exit {h['verify_sim']['exit']}); `verify:geometry`: exit {h['verify_geometry']['exit']}; typecheck: exit {eng['typecheck']['exit']}; build: {('skipped' if eng['build'].get('skipped') else 'exit ' + str(eng['build'].get('exit')))}.")
    be = eng.get("separate_backend_repo")
    if be:
        w(f"* **Separate backend repository (`landstack-api`, not this repo)** — pytest: {be['passed']} passed, {be['failed']} failed.")
    w("")

    w("## 1. Conversion model — NOT MEASURED")
    w("")
    for x in m["missing"]:
        w(f"* {x}")
    w("")
    w(m["what_the_repo_contains_instead"]["note"])
    w("")
    w("Mentions of XGBoost in the source:")
    w("")
    for x in m["what_the_repo_contains_instead"]["mentions_of_xgboost"]:
        w(f"* `{x}`")
    w("")
    w("To make it measurable: " + " ".join(m["what_would_make_this_measurable"]))
    w("")

    w(f"## 2. Cited copilot — {'measured' if rag.get('measured') else 'RAGAS NOT MEASURED; retrieval stage measured'}")
    w("")
    w("* Pipeline: `POST /api/ai` → planner → zod `validatePlan` → policy-library retrieval (`src/server/policy-context.ts`) → grounded answer.")
    w("* Retrieval is deterministic keyword scoring. **There is no BM25, vector index or knowledge graph in this repo.**")
    w("* Corpus: the Policy Lab library — 14 instruments, 152 evidence rows (68 stated explicitly in the documents). **No DILRMP documents or reports are in the corpus.**")
    w(f"* Gold set: `eval/gold_questions.jsonl`, {rag.get('gold_set_size')} questions, each tied to one instrument, one clause and the exact supporting sentence.")
    w("")
    for x in rag.get("missing") or []:
        w(f"* **Why not measured:** {x}")
    if rag.get("measured"):
        rg = rag["ragas"] or {}
        for k in ("faithfulness", "answer_relevancy", "context_precision"):
            v = rg.get(k) or {}
            w(f"* RAGAS {k}: {f2(v.get('mean'))} (scored on {v.get('n_scored')} questions)")
        w(f"* Judge: {rg.get('judge_model')} · embeddings: {rg.get('embedding_model')} · ragas {rg.get('ragas_version')}")
        w("")
        w("Five worst questions:")
        w("")
        for x in rag["worst_5"]:
            w(f"* `{x['id']}` faithfulness {f2(x.get('faithfulness'))} · context precision {f2(x.get('context_precision'))} — {x['question']}")
        for x in rag["caveats"]:
            w(f"* Caveat: {x}")
    if ro:
        w("")
        w("Retrieval stage, measured without the LLM (`eval/_retrieve.ts` runs the server's own `validatePlan` → `executePlan`):")
        w("")
        w("| Measure | Value |")
        w("|---|---|")
        w(f"| Gold instrument among retrieved sources | {gi['count']}/{gi['of']} |")
        w(f"| Exact supporting clause among retrieved sources | {gq['count']}/{gq['of']} |")
        w(f"| Questions with nothing retrieved | {ro['no_context_retrieved']} |")
        w(f"| Citation precision, clause level (cited quote is the supporting text) | {ro['citation_precision_clause_level']:.3f} ({ro['citations_total']} citations) |")
        w(f"| Citation precision, document level (cited quote is from the right instrument) | {ro['citation_precision_document_level']:.3f} |")
        w("")
        w("Clause-level precision is bounded by design: the copilot returns about three quotes per answer and usually one of them is the supporting sentence.")
        w("")
        w("Questions whose supporting clause was not retrieved:")
        w("")
        for x in ro["misses"]:
            w(f"* `{x['id']}` ({x['lang']}) expected *{x['expected']}* — got {('; '.join(x['retrieved']) or 'nothing')}")
    w("")

    w("## 3. Title Integrity rules — NOT MEASURED")
    w("")
    for x in rules["missing"]:
        w(f"* {x}")
    w("")
    w("To make it measurable: " + " ".join(rules["what_would_make_this_measurable"]))
    w("")

    w(f"## 4. Safe NL-GIS — {'measured' if nl.get('measured') else 'prompt-level run NOT MEASURED; validation layer and SQL path measured'}")
    w("")
    w(f"* Validation layer: {nl.get('validation_layer', 'zod (src/copilot/plan.ts)')}.")
    w("* There are no SQL query templates: the data layer is typed in-memory functions (`src/server/copilot-data.ts`).")
    for x in nl.get("missing") or []:
        w(f"* **Why not measured:** {x}")
    if nl.get("measured"):
        sv, ex, ic = nl["schema_valid"], nl["executed"], nl["intent_correct"]
        w(f"* Schema-valid plans: {sv['count']}/{sv['of']} · executed: {ex['count']}/{ex['of']} · correct intent: {ic['count']}/{ic['of']}")
        w(f"* Adversarial prompts blocked: {nl['adversarial_blocked']}/{nl['adversarial_total']} · not blocked: {nl['adversarial_not_blocked'] or 'none'}")
    s = nl.get("sql") or {}
    if s:
        w(f"* **AI-written SQL reaching a database: {s['ai_written_sql_reaching_db']}.** {s['basis']} ({s['source_files_scanned']} source files scanned; database dependencies: {s['database_dependencies'] or 'none'}; static .sql files: {s['static_sql_files'] or 'none'}.)")
    if va:
        w(f"* Validation-layer attack: {va['neutralised']}/{va['total']} hostile plans neutralised. {va['what']}")
        for x in va["residual_risk"]:
            w(f"* Residual risk: {x}")
    w("")

    w("## 5. Engineering")
    w("")
    ut = eng["unit_tests"]
    w(f"* Unit / integration tests in this repo: **{ut['passed']} passing, {ut['failed']} failing** — {ut['note'] or 'see eval/out/eng.json'}")
    w(f"* `npm run verify:sim`: {h['verify_sim'].get('checks_passed')} assertion checks passed (exit {h['verify_sim']['exit']}). These are harness assertions on the Policy Lab engine, not a unit-test suite.")
    w(f"* `npm run verify:geometry`: exit {h['verify_geometry']['exit']} (prints geometry statistics; it asserts nothing that can fail a count).")
    w(f"* `npm run typecheck`: exit {eng['typecheck']['exit']}.")
    b = eng["build"]
    w("* `npm run build`: " + ("skipped" if b.get("skipped") else ("timed out" if b.get("timed_out") else f"exit {b.get('exit')} in {b.get('seconds')} s")) + ".")
    w(f"* docker-compose at top level: {eng['docker']['compose_files_at_top_level'] or 'none'} · Dockerfile: {eng['docker']['dockerfiles_at_top_level'] or 'none'} → `docker compose up`: **{eng['docker']['docker_compose_up']}**.")
    w(f"* CI: {'**yes** — ' + ', '.join(eng['ci']['workflows']) + ' (the workflow file exists; whether it has ever run on GitHub is not something this script can observe)' if eng['ci']['exists'] else '**no**'}.")
    w("* `npm run lint` is not part of these results: on this repo it did not finish within 30 minutes, and it is left out of CI for that reason.")
    if be:
        w(f"* Separate backend repo `landstack-api`: pytest {be['passed']} passed / {be['failed']} failed (exit {be['exit']}). It has no docker-compose file either.")
    w("")

    w("## Reproduce")
    w("")
    w("```sh")
    w("npm install && npm run dev                       # app under test on http://localhost:8080 (needs OPENROUTER_API_KEY with credits for items 2 and 4)")
    w("python -m venv .venv-eval && .venv-eval/Scripts/pip install -r eval/requirements.txt   # RAGAS (bin/ instead of Scripts/ on macOS/Linux)")
    w("")
    w("python eval/model_eval.py                        # item 1")
    w("python eval/rag_eval.py                          # item 2 (use the .venv-eval python for RAGAS)")
    w("python eval/rules_eval.py                        # item 3")
    w("python eval/nlgis_eval.py                        # item 4")
    w("python eval/eng_eval.py                          # item 5   (LANDSTACK_API_DIR=<checkout> adds the backend pytest run)")
    w("python eval/run_all.py                           # all of the above → eval/results.json + eval/RESULTS.md")
    w("")
    w("npx tsx eval/_retrieve.ts                        # LLM-free retrieval on the gold set")
    w("npx tsx eval/_fuzz_plan.ts                       # LLM-free validation-layer attack")
    w("npm run verify:sim && npm run verify:geometry && npm run typecheck")
    w("```")
    w("")
    w("Raw responses and per-question rows are in `eval/out/`.")
    w("")
    notes = EVAL / "NOTES.md"
    if notes.exists():  # hand-written context a script cannot observe (e.g. why an upstream call failed)
        w(notes.read_text(encoding="utf-8").strip())
        w("")
    return "\n".join(o)


def main() -> None:
    if "--render-only" in sys.argv:  # rebuild RESULTS.md from the last results.json without re-running anything
        results = json.loads((EVAL / "results.json").read_text(encoding="utf-8"))
        results["proof_panel"] = panel(results)
        (EVAL / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        (EVAL / "RESULTS.md").write_text(results_md(results), encoding="utf-8")
        for line in results["proof_panel"]:
            print(line)
        return
    results = {
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "commit": git_head(),
        "base_url": BASE_URL,
        "model": model_eval.main(),
        "rag": rag_eval.main(),
        "rules": rules_eval.main(),
        "nlgis": nlgis_eval.main(),
        "engineering": eng_eval.main(),
    }
    results["proof_panel"] = panel(results)
    (EVAL / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    (EVAL / "RESULTS.md").write_text(results_md(results), encoding="utf-8")
    print("PROOF PANEL VALUES")
    print("\n".join(results["proof_panel"]))
    print(f"\nwrote {EVAL / 'results.json'} and {EVAL / 'RESULTS.md'}")


if __name__ == "__main__":
    main()
