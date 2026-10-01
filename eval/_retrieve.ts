/**
 * LLM-free retrieval for the gold questions.
 *
 * Runs the server's real data-layer path — validatePlan() → executePlan() — with a
 * policy_research plan, i.e. exactly what POST /api/ai does after the planner, minus
 * the planner's optional English `topic` keywords. Prints one JSON line per question.
 *
 *   npx tsx eval/_retrieve.ts
 */
import { readFileSync } from "node:fs";
import { validatePlan } from "../src/copilot/plan";
import { evidenceFor, executePlan } from "../src/server/copilot-data";

const gold = readFileSync(new URL("./gold_questions.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as { id: string; lang: "en" | "hi" | "mr"; question: string });

const out = gold.map((g) => {
  const { plan } = validatePlan(
    { intent: "policy_research", uses_map_context: false, refers_to_previous: false },
    { language: g.lang, context: null, previous: null },
  );
  const data = executePlan(plan, g.question);
  const lib = data.find((d) => d.dataset === "policy_library");
  return {
    id: g.id,
    datasets: plan.datasets,
    quotes: (lib?.quotes ?? []).map((q) => ({
      policy: q.policy,
      clause: q.clause,
      page: q.page,
      method: q.method,
      quote: q.quote,
    })),
    cited: evidenceFor(data)
      .filter((e) => e.provenance === "document")
      .map((e) => e.label),
  };
});
console.log(JSON.stringify(out));
