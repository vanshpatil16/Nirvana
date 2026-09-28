import { createFileRoute, notFound } from "@tanstack/react-router";
import { InnovationWorkspace } from "@/components/innovation/workspace/InnovationWorkspace";
import { WORKSPACE_MODULES, getProject } from "@/data/innovation";

const MODULE_IDS = new Set<string>(WORKSPACE_MODULES.map((m) => m.id));

export const Route = createFileRoute("/innovation/workspace/$projectId")({
  /**
   * Resolve the project in a loader so an unknown workspace id produces a real
   * 404 instead of an empty shell that only errors after hydration.
   */
  loader: ({ params }) => {
    const project = getProject(params.projectId);
    if (!project) throw notFound();
    return { project };
  },
  // The active workspace module lives in the URL so a reviewer can be linked
  // directly to the evidence locker, task board or decision log. Optional, so
  // plain `<a href>` links to this route stay valid without a query string.
  validateSearch: (search: Record<string, unknown>) => ({
    module:
      typeof search["module"] === "string" && MODULE_IDS.has(search["module"] as string)
        ? (search["module"] as string)
        : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: "Project Workspace — BHUMI-NITI Innovation Portal" },
      {
        name: "description",
        content: `Collaborative workspace for ${params.projectId}: evidence locker, task board, experiment log, pilot tracker and decision log.`,
      },
    ],
  }),
  component: InnovationWorkspaceRoute,
});

function InnovationWorkspaceRoute() {
  const { project } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <InnovationWorkspace
      project={project}
      module={search.module}
      onModuleChange={(module) => navigate({ search: { module }, replace: true })}
    />
  );
}
