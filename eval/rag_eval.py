#!/usr/bin/env python3
"""Item 2 — cited copilot.

What is actually evaluated (reported verbatim in the results):
  pipeline  POST /api/ai — planner → zod validation → policy-library retrieval
            (src/server/policy-context.ts, deterministic keyword scoring over the
            Policy Lab library; NOT BM25 / vector / knowledge-graph) → grounded answer
  corpus    src/data/policySimulation/library — 14 instruments, 152 evidence rows
  gold set  eval/gold_questions.jsonl — 50 questions, each tied to one instrument,
            one clause and the exact supporting sentence

Metrics
  RAGAS        faithfulness, answer_relevancy, context_precision (with reference)
  retrieval    gold instrument / gold supporting quote present in retrieved contexts
  citation precision
      clause level   share of cited quotes that ARE the gold supporting text
      document level share of cited quotes that come from the gold instrument

Usage:  python eval/rag_eval.py            (queries the running app, then scores)
        python eval/rag_eval.py --reuse    (re-score cached answers in eval/out/rag_runs.json)
"""

from __future__ import annotations

import json
import math
import re
import sys
import time

from _common import EVAL, OUT, BASE_URL, ask, env_value, llm_failed, preflight, run_tsx, write_json

JUDGE_MODEL = "openai/gpt-4o-mini"
EMBED_MODEL = "openai/text-embedding-3-small"


def norm(s: str) -> str:
    """Same tidy-up the server applies to quotes (src/server/policy-context.ts), then lower-case."""
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s([;,.])", lambda m: m.group(1), s)
    return s.strip().lower()


def load_gold() -> list[dict]:
    corpus = [r for r in json.loads((EVAL / "_corpus.json").read_text(encoding="utf-8")) if r["method"] == "explicit"]
    gold = [json.loads(l) for l in (EVAL / "gold_questions.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    for g in gold:
        g["gold_quotes"] = sorted(
            {norm(r["quote"]) for r in corpus if r["policy_id"] == g["policy_id"] and r["clause"] == g["clause"] and g.get("gold_snippet", "") in r["quote"]}
        )
        g["policy_name"] = next(r["policy"] for r in corpus if r["policy_id"] == g["policy_id"])
        assert g["gold_quotes"], f"{g['id']}: gold clause not found in corpus"
    return gold


def run_pipeline(gold: list[dict]) -> list[dict]:
    runs = []
    streak = 0
    for i, g in enumerate(gold, 1):
        if streak >= 3:  # upstream LLM is down: don't burn the remaining questions
            runs.append({"id": g["id"], "llm_answered": False, "ok": False, "http": None, "ms": None, "intent": None, "datasets": None, "answer": "", "summary": "", "contexts": [], "cited": [], "error": "skipped after 3 consecutive upstream LLM failures"})
            continue
        r = ask(g["question"])
        streak = streak + 1 if llm_failed(r) else 0
        reply = r.get("reply") or {}
        lib = next((d for d in r.get("data") or [] if d.get("dataset") == "policy_library"), None)
        quotes = (lib or {}).get("quotes") or []
        runs.append(
            {
                "id": g["id"],
                "llm_answered": not llm_failed(r),
                "ok": bool(r.get("ok")),
                "http": r.get("_http"),
                "ms": r.get("_ms"),
                "intent": (r.get("plan") or {}).get("intent"),
                "datasets": (r.get("plan") or {}).get("datasets"),
                "answer": " ".join([reply.get("summary") or "", *(reply.get("framework") or [])]).strip(),
                "summary": reply.get("summary") or "",
                "contexts": [{"policy": q["policy"], "clause": q["clause"], "page": q.get("page"), "method": q.get("method"), "quote": q["quote"]} for q in quotes],
                "cited": [e["label"] for e in r.get("evidence") or [] if e.get("provenance") == "document"],
                "error": r.get("error"),
            }
        )
        print(f"  [{i:02d}/{len(gold)}] {g['id']} http={r.get('_http')} contexts={len(quotes)} {r.get('_ms')}ms", flush=True)
        time.sleep(0.4)
    return runs


def deterministic(gold: list[dict], runs: list[dict]) -> tuple[dict, list[dict]]:
    rows = []
    cited_total = cited_clause = cited_doc = 0
    for g, r in zip(gold, runs):
        ctx = r["contexts"]
        is_gold = [any(norm(c["quote"]) == q or norm(c["quote"]) in q or q in norm(c["quote"]) for q in g["gold_quotes"]) for c in ctx]
        is_doc = [c["policy"] == g["policy_name"] for c in ctx]
        cited_total += len(ctx)
        cited_clause += sum(is_gold)
        cited_doc += sum(is_doc)
        rows.append(
            {
                "id": g["id"],
                "answered": r["ok"] and bool(r["summary"]),
                "n_cited": len(ctx),
                "hit_document": any(is_doc),
                "hit_supporting_quote": any(is_gold),
                "citation_precision_clause": (sum(is_gold) / len(ctx)) if ctx else None,
                "citation_precision_document": (sum(is_doc) / len(ctx)) if ctx else None,
            }
        )
    n = len(gold)
    summary = {
        "answered": sum(x["answered"] for x in rows),
        "no_context_retrieved": sum(1 for x in rows if x["n_cited"] == 0),
        "retrieval_hit_document": sum(x["hit_document"] for x in rows) / n,
        "retrieval_hit_supporting_quote": sum(x["hit_supporting_quote"] for x in rows) / n,
        "citations_total": cited_total,
        "citation_precision_clause_micro": (cited_clause / cited_total) if cited_total else None,
        "citation_precision_document_micro": (cited_doc / cited_total) if cited_total else None,
    }
    return summary, rows


def ragas_scores(gold: list[dict], runs: list[dict]) -> tuple[dict | None, list[dict], str | None]:
    try:
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings
        from ragas import EvaluationDataset, evaluate
        from ragas.embeddings import LangchainEmbeddingsWrapper
        from ragas.llms import LangchainLLMWrapper
        from ragas.metrics import Faithfulness, LLMContextPrecisionWithReference, ResponseRelevancy
        import ragas
    except Exception as e:  # not installed
        return None, [], f"RAGAS not importable ({e!r}). Install eval/requirements.txt."
    key = env_value("OPENROUTER_API_KEY")
    if not key:
        return None, [], "OPENROUTER_API_KEY missing — RAGAS needs a judge LLM and embeddings."
    base = "https://openrouter.ai/api/v1"
    llm = LangchainLLMWrapper(ChatOpenAI(model=JUDGE_MODEL, api_key=key, base_url=base, temperature=0, timeout=120, max_retries=4))
    emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model=EMBED_MODEL, api_key=key, base_url=base, check_embedding_ctx_length=False))
    samples = [
        {
            "user_input": g["question"],
            "response": r["answer"] or "(no answer)",
            "retrieved_contexts": [f"{c['policy']} — {c['clause']}: {c['quote']}" for c in r["contexts"]] or ["(no context retrieved)"],
            "reference": g["reference"],
        }
        for g, r in zip(gold, runs)
    ]
    result = evaluate(
        EvaluationDataset.from_list(samples),
        metrics=[Faithfulness(), ResponseRelevancy(), LLMContextPrecisionWithReference()],
        llm=llm,
        embeddings=emb,
        show_progress=False,
    )
    df = result.to_pandas()
    cols = {"faithfulness": "faithfulness", "answer_relevancy": "answer_relevancy", "llm_context_precision_with_reference": "context_precision"}
    per = []
    for (g, (_, row)) in zip(gold, df.iterrows()):
        per.append({"id": g["id"], **{out: (None if (v := row.get(src)) is None or (isinstance(v, float) and math.isnan(v)) else float(v)) for src, out in cols.items()}})
    means = {}
    for out in cols.values():
        vals = [p[out] for p in per if p[out] is not None]
        means[out] = {"mean": sum(vals) / len(vals) if vals else None, "n_scored": len(vals)}
    means["ragas_version"] = ragas.__version__
    means["judge_model"] = JUDGE_MODEL
    means["embedding_model"] = EMBED_MODEL
    return means, per, None


def retrieval_only(gold: list[dict]) -> dict:
    """LLM-free: the server's own validatePlan → executePlan path on every gold question."""
    ret = {r["id"]: r for r in run_tsx("_retrieve.ts")}
    write_json("retrieval_runs.json", list(ret.values()))
    runs = [{"ok": True, "summary": "-", "contexts": ret[g["id"]]["quotes"]} for g in gold]
    det, rows = deterministic(gold, runs)
    n = len(gold)
    return {
        "measured": True,
        "what": "Retrieval + citation stage only, no LLM: validatePlan(policy_research) → executePlan(question). Identical to the server path except the planner's optional English `topic` keywords are absent.",
        "n": n,
        "gold_instrument_retrieved": {"count": sum(r["hit_document"] for r in rows), "of": n},
        "gold_supporting_quote_retrieved": {"count": sum(r["hit_supporting_quote"] for r in rows), "of": n},
        "no_context_retrieved": det["no_context_retrieved"],
        "citations_total": det["citations_total"],
        "citation_precision_clause_level": det["citation_precision_clause_micro"],
        "citation_precision_document_level": det["citation_precision_document_micro"],
        "misses": [{"id": g["id"], "lang": g["lang"], "expected": f"{g['policy_name']} — {g['clause']}", "retrieved": [f"{c['policy']} — {c['clause']}" for c in ret[g["id"]]["quotes"]]} for g, r in zip(gold, rows) if not r["hit_supporting_quote"]],
    }


def main() -> dict:
    gold = load_gold()
    retrieval = retrieval_only(gold)
    cache = OUT / "rag_runs.json"
    if "--reuse" in sys.argv and cache.exists():
        runs = json.loads(cache.read_text(encoding="utf-8"))["runs"]
        print(f"re-using {len(runs)} cached answers")
    else:
        ready, why = preflight()
        if not ready:
            out = {"item": "rag", "measured": False, "missing": [why], "gold_set_size": len(gold), "retrieval_only": retrieval}
            write_json("rag.json", out)
            return out
        print(f"querying {BASE_URL}/api/ai with {len(gold)} gold questions …")
        runs = run_pipeline(gold)
        write_json("rag_runs.json", {"base_url": BASE_URL, "runs": runs})

    unanswered = [r["id"] for r in runs if not r.get("llm_answered", True)]
    if unanswered:
        out = {
            "item": "rag",
            "measured": False,
            "gold_set_size": len(gold),
            "retrieval_only": retrieval,
            "missing": [
                f"{len(unanswered)}/{len(gold)} questions were not answered by the language model (upstream LLM failure). No RAG score is reported for an incomplete run."
            ],
        }
        write_json("rag.json", out)
        return out
    det, det_rows = deterministic(gold, runs)
    means, per, ragas_err = ragas_scores(gold, runs)

    merged = []
    for g, r, d in zip(gold, runs, det_rows):
        row = {"id": g["id"], "lang": g["lang"], "question": g["question"], "expected": f"{g['policy_name']} — {g['clause']}", "answer": r["summary"], **d}
        row.update(next((p for p in per if p["id"] == g["id"]), {}))
        merged.append(row)
    worst = sorted(
        merged,
        key=lambda x: (x.get("faithfulness") if x.get("faithfulness") is not None else -1, x.get("context_precision") or 0, x.get("answer_relevancy") or 0),
    )[:5]

    out = {
        "item": "rag",
        "measured": True,
        "pipeline": "POST /api/ai → planner → zod validatePlan → policy-library keyword retrieval (src/server/policy-context.ts) → grounded answer",
        "retrieval_type": "deterministic keyword scoring — no BM25, vector index or knowledge graph exists in this repo",
        "corpus": "Policy Lab library: 14 instruments, 152 evidence rows (68 explicit). No DILRMP documents or reports are in the corpus.",
        "gold_set_size": len(gold),
        "gold_languages": {l: sum(1 for g in gold if g["lang"] == l) for l in ("en", "hi", "mr")},
        "retrieval_only": retrieval,
        "deterministic": det,
        "ragas": means,
        "ragas_error": ragas_err,
        "caveats": [
            "RAGAS judge model is the same model family that generates the answers (openai/gpt-4o-mini via OpenRouter); scores are LLM-judged, not human-judged.",
            "Gold questions were written from the corpus itself, so they measure faithfulness to retrieved text, not coverage of land law in general.",
        ],
        "worst_5": worst,
        "per_question": merged,
    }
    write_json("rag.json", out)
    return out


if __name__ == "__main__":
    res = main()
    print(json.dumps({k: v for k, v in res.items() if k not in ("per_question",)}, ensure_ascii=False, indent=2)[:3500])
