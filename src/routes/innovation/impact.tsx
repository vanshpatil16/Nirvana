import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const InnovationImpact = lazy(() =>
  import("@/components/innovation/impact/ImpactDashboard").then((m) => ({
    default: m.InnovationImpact,
  })),
);

export const Route = createFileRoute("/innovation/impact")({
  head: () => ({
    meta: [
      { title: "Impact & Outcomes — NIRVANA Innovation Portal" },
      {
        name: "description",
        content:
          "Ecosystem outcomes: pilots by state, research-to-pilot conversion, policy experiments with difference-in-differences evaluation, and documented KPI outcomes.",
      },
    ],
  }),
  component: InnovationImpact,
});
