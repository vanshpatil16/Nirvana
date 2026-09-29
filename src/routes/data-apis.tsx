import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const DataApisPage = lazy(() =>
  import("@/components/data-apis/DataApisPage").then((m) => ({ default: m.DataApisPage })),
);

export const Route = createFileRoute("/data-apis")({
  head: () => ({
    meta: [
      { title: "Data & APIs — NIRVANA" },
      {
        name: "description",
        content:
          "The Land Stack API integration gateway: OGC API - Features and STAC API over Indian land evidence, with source health, licences and known limitations for every dataset.",
      },
    ],
  }),
  component: DataApisPage,
});
