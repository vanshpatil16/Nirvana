import { createFileRoute } from "@tanstack/react-router";
import { InnovationImpact } from "@/components/innovation/impact/ImpactDashboard";

export const Route = createFileRoute("/innovation/impact")({
  head: () => ({
    meta: [
      { title: "Impact & Outcomes — BHUMI-NITI Innovation Portal" },
      {
        name: "description",
        content:
          "Ecosystem outcomes: pilots by state, research-to-pilot conversion, policy experiments with difference-in-differences evaluation, and documented KPI outcomes.",
      },
    ],
  }),
  component: InnovationImpact,
});
