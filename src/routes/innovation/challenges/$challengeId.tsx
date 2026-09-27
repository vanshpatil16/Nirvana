import { createFileRoute, notFound } from "@tanstack/react-router";
import { InnovationChallengeDetail } from "@/components/innovation/challenge/InnovationChallengeDetail";
import { getChallenge } from "@/data/innovation";

export const Route = createFileRoute("/innovation/challenges/$challengeId")({
  /**
   * Resolve the brief in a loader rather than inside the component: `notFound()`
   * thrown during a loader produces a real 404 status and the root
   * NotFoundComponent, whereas a throw from inside a component only surfaces
   * after hydration.
   */
  loader: ({ params }) => {
    const challenge = getChallenge(params.challengeId);
    if (!challenge) throw notFound();
    return { challenge };
  },
  head: ({ params }) => ({
    meta: [
      { title: "Challenge Brief — BHUMI-NITI Innovation Portal" },
      {
        name: "description",
        content: `Problem statement, geography, evidence panel, eligibility and evaluation criteria for challenge ${params.challengeId}.`,
      },
    ],
  }),
  component: InnovationChallengeDetailRoute,
});

function InnovationChallengeDetailRoute() {
  const { challenge } = Route.useLoaderData();
  return <InnovationChallengeDetail challenge={challenge} />;
}
