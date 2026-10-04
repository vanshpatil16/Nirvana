import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { ParcelVerificationTask } from "@/components/officer/ParcelVerificationTask";

export const Route = createFileRoute("/parcel")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Parcel Inspection & Field Task — NIRVANA" },
      {
        name: "description",
        content: "Parcel-level verification task, evidence capture, and exception resolution.",
      },
    ],
  }),
  component: ParcelRoute,
});

function ParcelRoute() {
  const { id } = Route.useSearch();

  return (
    <RoleGate allow={["officer", "policymaker", "state_owner"]}>
      <PortalPageShell activeItem="Verification Queue">
        <ParcelVerificationTask {...(id !== undefined ? { parcelId: id } : {})} />
      </PortalPageShell>
    </RoleGate>
  );
}
