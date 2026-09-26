/** Non-component helpers shared by Research Hub views (kept apart so React Fast Refresh works). */
import { baselineShares, regionOutcome, type ScenarioDeltas } from "@/data/land-scenario";
import type { HubView } from "./hub-context";

/** Which research-lifecycle stage each view belongs to (-1 = none). */
export const STAGE_OF_VIEW: Record<HubView, number> = {
  overview: -1,
  discover: 0,
  "my-research": 1,
  workspaces: 2,
  network: 2,
  gis: 3,
  datasets: 3,
  gaps: 3,
  experiments: 4,
  publications: 5,
  "policy-evidence": 6,
  manuscript: 5,
};

export interface ExperimentVars {
  agri: number;
  urban: number;
  forest: number;
  water: number;
}
export const PRESERVATION_ZONE: ExperimentVars = { agri: 10, urban: -8, forest: 5, water: 0 };

// Variables are % changes relative to today's share; the model works in percentage points
export function experimentDeltas(state: string, v: ExperimentVars): ScenarioDeltas {
  const b = baselineShares(state);
  return {
    agri: (b.agri * v.agri) / 100,
    built: (b.built * v.urban) / 100,
    forest: (b.forest * v.forest) / 100,
    water: (b.water * v.water) / 100,
  };
}

export function experimentOutcome(state: string, v: ExperimentVars) {
  const o = regionOutcome(state, "2024", experimentDeltas(state, v), {
    protectForest: v.forest > 0,
  });
  const pct = (a: number, b: number) => (a === 0 ? 0 : ((b - a) / a) * 100);
  return [
    {
      label: "Climate risk",
      value: pct(o.baseline.climateRisk, o.scenario.climateRisk),
      goodWhenDown: true,
    },
    {
      label: "Water stress",
      value: pct(o.baseline.waterStress, o.scenario.waterStress),
      goodWhenDown: true,
    },
    {
      label: "Agricultural land",
      value: pct(o.baseline.shares.agri, o.scenario.shares.agri),
      goodWhenDown: false,
    },
    {
      label: "Built-up expansion",
      value: pct(o.baseline.shares.built, o.scenario.shares.built),
      goodWhenDown: true,
    },
    {
      label: "Forest cover",
      value: pct(o.baseline.shares.forest, o.scenario.shares.forest),
      goodWhenDown: false,
    },
    {
      label: "Land disputes",
      value: pct(o.baseline.disputes, o.scenario.disputes),
      goodWhenDown: true,
    },
  ];
}
