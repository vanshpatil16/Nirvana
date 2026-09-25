import { createFileRoute } from "@tanstack/react-router";
import { InnovationPortal } from "@/components/innovation/InnovationPortal";

export const Route = createFileRoute("/innovation-portal")({
  validateSearch: (search: Record<string, unknown>) => ({
    challenge: typeof search["challenge"] === "string" && (search["challenge"] as string).length > 0 ? (search["challenge"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Innovation Portal — BHUMI-NITI Land Governance" },
      { name: "description", content: "Hackathons, research grants, pilot projects and knowledge competitions for evidence-based land governance." },
      { property: "og:title", content: "Innovation Portal — BHUMI-NITI" },
      { property: "og:description", content: "People, ideas, real impact for land governance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InnovationPortalRoute,
});

function InnovationPortalRoute() {
  const { challenge } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <InnovationPortal
      deepLinkId={challenge}
      onDeepLinkChange={(id) => navigate({ search: { challenge: id ?? undefined }, replace: true })}
    />
  );
}
