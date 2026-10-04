import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { FederationConsole } from "@/components/state-owner/FederationConsole";

export const Route = createFileRoute("/federation-console")({
  head: () => ({
    meta: [
      { title: "Federation & Privacy Console — NIRVANA" },
      { name: "description", content: "Manage state data nodes, privacy budgets and access requests for federated land data." },
    ],
  }),
  component: FederationConsoleRoute,
});

function FederationConsoleRoute() {
  return (
    <RoleGate allow={["state_owner", "policymaker"]}>
      <PortalPageShell activeItem="Federation & Privacy Console">
        <FederationConsole />
      </PortalPageShell>
    </RoleGate>
  );
}
