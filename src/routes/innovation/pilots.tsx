import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const InnovationPilots = lazy(() =>
  import("@/components/innovation/pilots/InnovationPilots").then((m) => ({
    default: m.InnovationPilots,
  })),
);

export const Route = createFileRoute("/innovation/pilots")({
  head: () => ({
    meta: [
      { title: "Pilots & Experiments — NIRVANA Innovation Portal" },
      {
        name: "description",
        content:
          "National pilot map and experiment tracker, with difference-in-differences evaluation, methodology and assumptions visible.",
      },
    ],
  }),
  component: InnovationPilots,
});
