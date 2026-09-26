import { createFileRoute } from "@tanstack/react-router";
import { Workbench } from "@/components/workflow/Workbench";

export const Route = createFileRoute("/workflow")({
  head: () => ({
    meta: [
      { title: "Evidence Workflow — Verify · Protect · Simulate · Prove | BHU-NITI" },
      {
        name: "description",
        content:
          "BHU-NITI four-step evidence workflow: land-record integrity verification, cited AI copilot, policy sandbox simulation and pre-registered causal proof.",
      },
      { property: "og:title", content: "Evidence Workflow — BHU-NITI" },
      { property: "og:description", content: "Verify → Protect → Simulate → Prove: from mismatch signal to packaged evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workbench,
});
