import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ChallengeFilters } from "@/components/innovation/challenges/InnovationChallenges";

const InnovationChallenges = lazy(() =>
  import("@/components/innovation/challenges/InnovationChallenges").then((m) => ({
    default: m.InnovationChallenges,
  })),
);

/**
 * Filter state lives in the URL so a filtered view can be shared or
 * bookmarked. Every param is optional, which keeps plain `<Link to=…>` calls
 * elsewhere in the portal valid without a `search` prop.
 */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const Route = createFileRoute("/innovation/challenges/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: str(search["q"]),
    track: str(search["track"]),
    state: str(search["state"]),
    status: str(search["status"]),
    stage: str(search["stage"]),
  }),
  head: () => ({
    meta: [
      { title: "Challenges — BHUMI-NITI Innovation Portal" },
      {
        name: "description",
        content:
          "Discover government challenges in land governance with a published problem statement, evidence panel, geography and evaluation rubric.",
      },
    ],
  }),
  component: InnovationChallengesRoute,
});

function InnovationChallengesRoute() {
  const search: ChallengeFilters = Route.useSearch();
  return <InnovationChallenges search={search} />;
}
