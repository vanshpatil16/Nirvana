import { createFileRoute } from "@tanstack/react-router";
import { InnovationSubmit } from "@/components/innovation/submit/InnovationSubmit";

export const Route = createFileRoute("/innovation/submit")({
  validateSearch: (search: Record<string, unknown>) => ({
    challenge:
      typeof search["challenge"] === "string" && (search["challenge"] as string).length > 0
        ? (search["challenge"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Submit a Solution — BHUMI-NITI Innovation Portal" },
      {
        name: "description",
        content:
          "A six-step autosaving submission: problem and approach, team, evidence and data, solution, pilot plan and measurement.",
      },
    ],
  }),
  component: InnovationSubmitRoute,
});

function InnovationSubmitRoute() {
  const { challenge } = Route.useSearch();
  return <InnovationSubmit challengeId={challenge} />;
}
