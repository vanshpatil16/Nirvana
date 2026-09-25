import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LandDifference = lazy(() => import("@/components/land-difference/LandDifference").then(m => ({ default: m.LandDifference })));

export const Route = createFileRoute("/landdifference")({
  head: () => ({
    meta: [
      { title: "Land Difference Intelligence — BHUMI-NITI" },
      { name: "description", content: "Compare land-use change across time and geography using satellite imagery, parcel boundaries and policy context." },
      { property: "og:title", content: "Land Difference Intelligence — BHUMI-NITI" },
      { property: "og:description", content: "AI-assisted detection and analysis of land-use change using satellite imagery and land records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--background)', color: 'var(--muted-foreground)', fontSize: 12 }}>
        Loading Land Difference Intelligence…
      </div>
    }>
      <LandDifference />
    </Suspense>
  ),
});
