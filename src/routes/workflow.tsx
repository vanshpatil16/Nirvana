import { lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const Workbench = lazy(() =>
  import("@/components/workflow/Workbench").then((m) => ({ default: m.Workbench })),
);

export const Route = createFileRoute("/workflow")({
  head: () => ({
    meta: [
      { title: "Evidence Workflow — Verify · Protect · Simulate · Prove | NIRVANA" },
      {
        name: "description",
        content:
          "NIRVANA four-step evidence workflow: land-record integrity verification, cited AI copilot, policy sandbox simulation and pre-registered causal proof.",
      },
      { property: "og:title", content: "Evidence Workflow — NIRVANA" },
      {
        property: "og:description",
        content: "Verify → Protect → Simulate → Prove: from mismatch signal to packaged evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workbench,
});
