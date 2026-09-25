import { createFileRoute } from "@tanstack/react-router";
import { ResearchHub } from "@/components/research-hub/ResearchHub";
import type { HubView } from "@/components/research-hub/hub-context";

const VIEWS: HubView[] = [
  "overview",
  "discover",
  "my-research",
  "workspaces",
  "gis",
  "datasets",
  "publications",
  "policy-evidence",
  "copilot",
  "experiments",
  "network",
  "gaps",
];

export const Route = createFileRoute("/research-hub")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: VIEWS.includes(search["view"] as HubView) ? (search["view"] as HubView) : undefined,
    ws:
      typeof search["ws"] === "string" && search["ws"].length > 0
        ? (search["ws"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Research Hub — BHUMI-NITI Land Governance" },
      {
        name: "description",
        content:
          "Discover evidence, collaborate across institutions, analyze geospatial data, and turn land governance research into actionable policy.",
      },
      { property: "og:title", content: "Research Hub — BHUMI-NITI" },
      { property: "og:description", content: "Research that shapes better land policy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResearchHubRoute,
});

function ResearchHubRoute() {
  const { view, ws } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ResearchHub
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
