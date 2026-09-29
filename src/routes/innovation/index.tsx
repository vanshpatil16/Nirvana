import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const InnovationHome = lazy(() =>
  import("@/components/innovation/home/InnovationHome").then((m) => ({
    default: m.InnovationHome,
  })),
);

export const Route = createFileRoute("/innovation/")({
  head: () => ({
    meta: [
      { title: "Innovation Portal — NIRVANA" },
      {
        name: "description",
        content:
          "Where land-governance ideas become tested solutions. Discover challenges, build with evidence, pilot in the real world.",
      },
      { property: "og:title", content: "Innovation Portal — NIRVANA" },
      {
        property: "og:description",
        content: "Challenge → Evidence → Build → Pilot → Measure → Policy Learning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InnovationHome,
});
