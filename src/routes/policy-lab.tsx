import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { LabMode } from "@/components/policy-lab/PolicyLab";

const PolicyLab = lazy(() =>
  import("@/components/policy-lab/PolicyLab").then((m) => ({ default: m.PolicyLab })),
);

const MODES: LabMode[] = ["overview", "existing", "new"];

export const Route = createFileRoute("/policy-lab")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: MODES.includes(search["mode"] as LabMode) ? (search["mode"] as LabMode) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Policy Lab — NIRVANA Land Governance" },
      {
        name: "description",
        content:
          "Evaluate an implemented land policy against simulated historical data, or configure a hypothetical policy and simulate its modelled effects.",
      },
      { property: "og:title", content: "Policy Lab — NIRVANA" },
      {
        property: "og:description",
        content: "Policy evaluation and scenario simulation for land governance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PolicyLabRoute,
});

function PolicyLabRoute() {
  const { mode } = Route.useSearch();
  return <PolicyLab {...(mode ? { initialMode: mode } : {})} />;
}
