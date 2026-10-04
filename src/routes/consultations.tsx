import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { Consultations } from "@/components/citizen/Consultations";

export const Route = createFileRoute("/consultations")({
  head: () => ({
    meta: [
      { title: "Public Consultations — NIRVANA" },
      { name: "description", content: "Participate in open public consultations on land policy, legislation and proposed changes." },
    ],
  }),
  component: ConsultationsRoute,
});

function ConsultationsRoute() {
  return (
    <RoleGate allow={["citizen", "policymaker", "researcher", "officer", "state_owner", "innovator"]}>
      <PortalPageShell activeItem="Consultations">
        <Consultations />
      </PortalPageShell>
    </RoleGate>
  );
}
