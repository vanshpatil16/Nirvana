import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/dashboard" }); },
  head: () => ({
    meta: [
      { title: "BHUMI-NITI — National Platform for Land Governance" },
      { name: "description", content: "India’s evidence-based platform for land intelligence, research and policy innovation." },
      { property: "og:title", content: "BHUMI-NITI — National Platform for Land Governance" },
      { property: "og:description", content: "Land data, GIS intelligence, evidence and policy innovation for a stronger India." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
