import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Layers3, MapPin } from "lucide-react";
import { THEMES, type ThemeId } from "@/data/state-intelligence";

const THEME_IDS = new Set<string>(["land-use-change", "disputes", "climate-risk", "socio-economic"]);

export const Route = createFileRoute("/gis-explorer")({
  validateSearch: (search: Record<string, unknown>) => ({
    state: typeof search["state"] === "string" && (search["state"] as string).length > 0 ? (search["state"] as string) : undefined,
    layer: typeof search["layer"] === "string" && THEME_IDS.has(search["layer"] as string) ? (search["layer"] as ThemeId) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "GIS Explorer — BHUMI-NITI Spatial Analysis" },
      { name: "description", content: "Detailed spatial analysis workspace for India's land intelligence." },
    ],
  }),
  component: GisExplorer,
});

function GisExplorer() {
  const { state, layer } = Route.useSearch();
  const theme = layer ? THEMES[layer] : undefined;

  return (
    <div className="gis-shell">
      <header className="gis-head">
        <Link className="gis-back" to="/dashboard">
          <ArrowLeft /> Dashboard
        </Link>
        <div>
          <span>SPATIAL ANALYSIS WORKSPACE</span>
          <h1>GIS Explorer</h1>
        </div>
      </header>

      {(state || theme) && (
        <div className="gis-context" aria-label="Drill-down context from dashboard">
          {state && (
            <span className="gis-chip">
              <MapPin /> {state}
            </span>
          )}
          {theme && (
            <span className="gis-chip">
              <Layers3 /> {theme.label}
            </span>
          )}
        </div>
      )}

      <section className="gis-body" aria-label="GIS Explorer workspace">
        <h2>Detailed spatial investigation lives here.</h2>
        <p>
          {state
            ? `${state} selected${theme ? ` with the ${theme.label} layer active` : ""}. Layering, parcel tools and temporal analysis arrive in the next milestone.`
            : theme
              ? `The ${theme.label} layer is queued for analysis. Layering, parcel tools and temporal analysis arrive in the next milestone.`
              : "Layering, parcel tools and temporal analysis arrive in the next milestone. Drill in from the dashboard map to carry state and theme context here."}
        </p>
        <Link className="gis-cta" to="/dashboard">
          Back to national overview
        </Link>
      </section>
    </div>
  );
}
