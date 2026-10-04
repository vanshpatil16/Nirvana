import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RoutePending } from "@/components/ui/loading";

const TimeMachinePage = lazy(() =>
  import("@/components/time-machine/TimeMachinePage").then((m) => ({
    default: m.TimeMachinePage,
  })),
);

export const Route = createFileRoute("/time-machine")({
  head: () => ({
    meta: [
      { title: "NIRVANA — Time Machine" },
      {
        name: "description",
        content:
          "Travel the history of a piece of land: satellite change, parcels, events and evidence over 2018–2024.",
      },
    ],
  }),
  component: () => (
    <Suspense fallback={<RoutePending />}>
      <TimeMachinePage />
    </Suspense>
  ),
});
