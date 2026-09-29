import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const RecordVsReality = lazy(() =>
  import("@/components/record-reality/RecordVsReality").then((m) => ({
    default: m.RecordVsReality,
  })),
);

export const Route = createFileRoute("/record-vs-reality")({
  head: () => ({
    meta: [
      { title: "Record vs Reality — BHUMI-NITI Land Intelligence" },
      {
        name: "description",
        content:
          "Compare official land records with real-world satellite imagery, field data and ground reports.",
      },
      { property: "og:title", content: "Record vs Reality — BHUMI-NITI" },
      {
        property: "og:description",
        content: "Official land record vs satellite reality comparison engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecordVsReality,
});
