import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const MapFirstHome = lazy(() =>
  import("@/components/home/MapFirstHome").then((m) => ({ default: m.MapFirstHome })),
);

export const Route = createFileRoute("/copilot")({
  head: () => ({
    meta: [
      { title: "Ask Bhumi — Copilot | BHUMI-NITI" },
      {
        name: "description",
        content:
          "Interactive AI-native land intelligence platform. Click any parcel or coordinate in India to inspect cadastral boundaries, land use, risk and legal regulations.",
      },
      { property: "og:title", content: "BHUMI-NITI — Map-First Land Intelligence" },
      {
        property: "og:description",
        content:
          "Interactive AI-native land intelligence platform connecting spatial GIS, legal records and AI governance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapFirstHome,
});
