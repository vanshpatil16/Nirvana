import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const Landing = lazy(() =>
  import("@/components/landing/Landing").then((m) => ({ default: m.Landing })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NIRVANA — Every plot of land has two stories" },
      {
        name: "description",
        content:
          "Nirvana reads the land record and the satellite side by side, finds where they disagree, and turns the fix into evidence — in English, हिंदी and मराठी.",
      },
      { property: "og:title", content: "NIRVANA — Every plot of land has two stories" },
      {
        property: "og:description",
        content:
          "Evidence infrastructure for Indian land governance: verify, ask, protect, simulate, prove.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&display=swap",
      },
      {
        rel: "preload",
        href: "/landing/vadnerbhairav.json",
        as: "fetch",
        crossOrigin: "anonymous",
      },
    ],
  }),
  component: Landing,
});
