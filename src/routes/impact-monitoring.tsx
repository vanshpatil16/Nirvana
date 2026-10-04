import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { ImpactMonitoring } from "@/components/policy/ImpactMonitoring";

export const Route = createFileRoute("/impact-monitoring")({
  head: () => ({
    meta: [
      { title: "Impact & Policy Monitoring — NIRVANA" },
      { name: "description", content: "Pre-registered KPI ledger, counterfactual experiments, and policy outcome tracking." },
    ],
  }),
  component: ImpactMonitoringRoute,
});

function ImpactMonitoringRoute() {
  return (
    <RoleGate allow={["policymaker", "researcher"]}>
      <PortalPageShell activeItem="Impact & Monitoring">
        <ImpactMonitoring />
      </PortalPageShell>
    </RoleGate>
  );
}
