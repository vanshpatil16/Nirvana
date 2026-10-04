import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { VerificationQueue } from "@/components/officer/VerificationQueue";

export const Route = createFileRoute("/verification-queue")({
  head: () => ({
    meta: [
      { title: "Verification Queue — NIRVANA Land Intelligence" },
      {
        name: "description",
        content: "Ranked list of parcels for field verification and defect screening.",
      },
    ],
  }),
  component: VerificationQueueRoute,
});

function VerificationQueueRoute() {
  return (
    <RoleGate allow={["officer", "policymaker", "state_owner"]}>
      <PortalPageShell activeItem="Verification Queue">
        <VerificationQueue />
      </PortalPageShell>
    </RoleGate>
  );
}
