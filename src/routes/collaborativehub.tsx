import { createFileRoute } from "@tanstack/react-router";
import { ResearchHub } from "@/components/research-hub/ResearchHub";
import type { HubView } from "@/components/research-hub/hub-context";

// Views reachable from the Collaborative Hub (others still work via links inside it)
const VIEWS: HubView[] = [
  "overview",
  "workspaces",
  "manuscript",
  "my-research",
  "network",
  "discover",
  "datasets",
  "gis",
];

export const Route = createFileRoute("/collaborativehub")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: VIEWS.includes(search["view"] as HubView) ? (search["view"] as HubView) : undefined,
    ws:
      typeof search["ws"] === "string" && search["ws"].length > 0
        ? (search["ws"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Collaborative Hub — BHUMI-NITI Land Governance" },
      {
        name: "description",
        content:
          "Shared research workspaces where researchers, officials and GIS analysts co-write, analyse and review land-governance evidence together.",
      },
      { property: "og:title", content: "Collaborative Hub — BHUMI-NITI" },
      { property: "og:description", content: "Build land-governance research together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollaborativeHubRoute,
});

function CollaborativeHubRoute() {
  const { view, ws } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ResearchHub
      variant="collab"
      view={view}
      workspaceId={ws}
      onNavigate={(next, wsId) =>
        navigate({
          search: { view: next === "overview" ? undefined : next, ws: wsId },
          replace: false,
        })
      }
    />
  );
}
