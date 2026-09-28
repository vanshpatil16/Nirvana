import { createFileRoute } from "@tanstack/react-router";
import { InnovationPilots } from "@/components/innovation/pilots/InnovationPilots";

export const Route = createFileRoute("/innovation/pilots")({
  head: () => ({
    meta: [
      { title: "Pilots & Experiments — BHUMI-NITI Innovation Portal" },
      {
        name: "description",
        content:
          "National pilot map and experiment tracker, with difference-in-differences evaluation, methodology and assumptions visible.",
      },
    ],
  }),
  component: InnovationPilots,
});
