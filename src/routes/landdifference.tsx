import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const LandDifference = lazy(() =>
  import("@/components/land-difference/LandDifference").then((m) => ({
    default: m.LandDifference,
  })),
);

export const Route = createFileRoute("/landdifference")({
  head: () => ({
    meta: [
      { title: "Land Difference Intelligence — NIRVANA" },
      {
        name: "description",
        content:
          "Compare land-use change across time and geography using satellite imagery, parcel boundaries and policy context.",
      },
      { property: "og:title", content: "Land Difference Intelligence — NIRVANA" },
      {
        property: "og:description",
        content:
          "AI-assisted detection and analysis of land-use change using satellite imagery and land records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandDifference,
});
