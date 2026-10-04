import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { ReportStatus } from "@/components/citizen/ReportStatus";

export const Route = createFileRoute("/report-status")({
  head: () => ({
    meta: [
      { title: "Report Status — NIRVANA" },
      { name: "description", content: "Track the status of your submitted land mismatch reports." },
    ],
  }),
  component: ReportStatusRoute,
});

function ReportStatusRoute() {
  return (
    <RoleGate allow={["citizen", "officer", "policymaker", "researcher", "state_owner", "innovator"]}>
      <PortalPageShell activeItem="Report Status">
        <ReportStatus />
      </PortalPageShell>
    </RoleGate>
  );
}
