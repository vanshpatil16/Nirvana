import { createFileRoute } from "@tanstack/react-router";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { ChooseRole } from "@/components/choose-role/ChooseRole";

export const Route = createFileRoute("/choose-role")({
  head: () => ({
    meta: [
      { title: "Choose your role — NIRVANA" },
      {
        name: "description",
        content:
          "Pick a persona — Officer, Policymaker, Researcher, State Data Owner, Citizen or Industry — to open its scoped NIRVANA workspace.",
      },
    ],
  }),
  component: ChooseRoleRoute,
});

function ChooseRoleRoute() {
  return (
    <PortalPageShell activeItem="Dashboard">
      <ChooseRole />
    </PortalPageShell>
  );
}
