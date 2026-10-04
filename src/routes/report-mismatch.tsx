import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { ReportMismatch } from "@/components/citizen/ReportMismatch";

export const Route = createFileRoute("/report-mismatch")({
  head: () => ({
    meta: [
      { title: "Report a Mismatch — NIRVANA" },
      { name: "description", content: "Report a discrepancy between official land records and ground reality." },
    ],
  }),
  component: ReportMismatchRoute,
});

function ReportMismatchRoute() {
  return (
    <RoleGate allow={["citizen", "officer", "policymaker", "researcher", "state_owner", "innovator"]}>
      <PortalPageShell activeItem="Report a Mismatch">
        <ReportMismatch />
      </PortalPageShell>
    </RoleGate>
  );
}
