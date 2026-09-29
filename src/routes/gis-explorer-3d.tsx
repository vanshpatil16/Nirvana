import { lazy } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

/* CesiumJS is the heaviest chunk in the app - load it only when this route is
   opened, and let the shared loader cover the wait. */
const GisExplorer3D = lazy(() =>
  import("@/components/gis3d/GisExplorer3D").then((m) => ({ default: m.GisExplorer3D })),
);

export const Route = createFileRoute("/gis-explorer-3d")({
  validateSearch: (search: Record<string, unknown>) => ({
    state:
      typeof search["state"] === "string" && (search["state"] as string).length > 0
        ? (search["state"] as string)
        : undefined,
    layer:
      typeof search["layer"] === "string" && (search["layer"] as string).length > 0
        ? (search["layer"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "3D GIS Explorer — BHUMI-NITI" },
      {
        name: "description",
        content:
          "CesiumJS globe for India-scale land intelligence: imagery time machine, cadastral parcels, administrative drill-down, thematic choropleths and policy scenarios — every layer source-labelled.",
      },
    ],
  }),
  component: GisExplorer3DPage,
});

function GisExplorer3DPage() {
  const search = Route.useSearch();
  return (
    <>
      <GisExplorer3D search={search} />
      {/* Fallback for crawlers and for browsers without JavaScript. */}
      <noscript>
        <p style={{ padding: 16 }}>
          The 3D GIS Explorer needs JavaScript. Open{" "}
          <Link to="/dashboard">the 2D national map</Link> instead.
        </p>
      </noscript>
    </>
  );
}
