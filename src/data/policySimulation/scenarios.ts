import { RULE_PACKS, type RulePackPreset } from "./rulePacks";
import type { ParamValues, Policy } from "./types";

/**
 * Scenario presets, derived from the rule packs.
 *
 * A preset used to be a bundle of overrides tagged with a policy id, which
 * meant adding an instrument meant writing its presets by hand. Presets belong
 * to the pack — the parameters they override are the pack's parameters — so
 * every policy built on a pack inherits the same three-way comparison: the
 * instrument's own stated figures, a permissive case and a restrictive case.
 *
 * The engine ignores override keys a policy does not declare, so a preset
 * written for one pack is still safe if it is ever shown alongside another.
 */

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  /** the pack whose parameters this preset overrides */
  packId: string;
  overrides: ParamValues;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = RULE_PACKS.flatMap((pack) =>
  pack.presets.map((preset: RulePackPreset) => ({
    id: `${pack.id}:${preset.id}`,
    name: preset.name,
    description: preset.description,
    packId: pack.id,
    overrides: preset.overrides,
  })),
);

const INDEX = new Map(SCENARIO_PRESETS.map((s) => [s.id, s]));

/**
 * Presets available for a policy — those of its own pack, plus the explicitly
 * "relaxed" and "strict" cases a reader wants to see side by side.
 */
export const scenarioPresetsFor = (policy: Policy): ScenarioPreset[] => {
  if (!policy.rulePackId) return [];
  return SCENARIO_PRESETS.filter((s) => s.packId === policy.rulePackId);
};

/**
 * The preset that reproduces the instrument's own figures, where the pack
 * declares one. Every pack ships a `stated-rule` preset, so this is the value
 * the New Policy screen opens on — the honest starting point, since every figure
 * in it traces to a clause.
 */
export const statedRulePreset = (policy: Policy): ScenarioPreset | undefined =>
  scenarioPresetsFor(policy).find((s) => s.id.endsWith(":stated-rule"));

/** Default parameter bundle for a template. */
export const defaultParameters = (
  parameters: { id: string; default: number | string | boolean | string[] }[],
): ParamValues =>
  parameters.reduce<ParamValues>((acc, p) => {
    acc[p.id] = p.default;
    return acc;
  }, {});

export const applyPreset = (
  parameters: { id: string; default: number | string | boolean | string[] }[],
  presetId: string | null,
): ParamValues => {
  const base = defaultParameters(parameters);
  const preset = presetId ? INDEX.get(presetId) : undefined;
  if (!preset) return base;
  const ids = new Set(parameters.map((p) => p.id));
  for (const [key, value] of Object.entries(preset.overrides)) {
    if (ids.has(key)) base[key] = value;
  }
  return base;
};
