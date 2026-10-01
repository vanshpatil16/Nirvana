// Dumps the Policy Lab library evidence rows (the copilot's document corpus) for gold-set authoring.
import { POLICIES } from "../src/data/policySimulation";
const rows: unknown[] = [];
for (const p of POLICIES) {
  const ev = [...(p.evidence ?? []).map((e) => ({ e, param: null as string | null })), ...p.parameters.filter((x) => x.evidence).map((x) => ({ e: x.evidence!, param: x.label }))];
  for (const { e, param } of ev) rows.push({ policy_id: p.id, policy: p.name, short: p.shortName, year: p.sourceDocument.year, clause: e.clause, page: e.page, method: e.method, claim: e.claim, param, quote: e.quote });
}
console.log(JSON.stringify(rows));
