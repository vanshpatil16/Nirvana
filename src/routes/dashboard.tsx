import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const Dashboard = lazy(() =>
  import("@/components/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })),
);

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "BHUMI-NITI Dashboard — National Land Intelligence" },
      {
        name: "description",
        content:
          "Evidence-based land intelligence, GIS analysis, research and policy insights for India.",
      },
      { property: "og:title", content: "BHUMI-NITI — India’s Land Intelligence Platform" },
      {
        property: "og:description",
        content: "A national digital platform connecting land data, evidence, policy and research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
