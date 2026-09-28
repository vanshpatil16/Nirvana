import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The Innovation Portal originally lived at this single path. It is now a set
 * of screens under /innovation, so this entry point redirects rather than
 * disappearing — the sidebar link and any existing bookmark keep working.
 */
export const Route = createFileRoute("/innovation-portal")({
  beforeLoad: () => {
    throw redirect({ to: "/innovation" });
  },
});
