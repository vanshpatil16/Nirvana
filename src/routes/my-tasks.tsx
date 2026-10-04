import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/auth/RoleGate";
import { PortalPageShell } from "@/components/layout/PortalPageShell";
import { MyTasks } from "@/components/officer/MyTasks";

export const Route = createFileRoute("/my-tasks")({
  head: () => ({
    meta: [
      { title: "My Tasks — NIRVANA Land Operations" },
      {
        name: "description",
        content: "Operational task inbox for field staff, collectors and state owners.",
      },
    ],
  }),
  component: MyTasksRoute,
});

function MyTasksRoute() {
  return (
    <RoleGate allow={["officer", "state_owner", "policymaker"]}>
      <PortalPageShell activeItem="My Tasks">
        <MyTasks />
      </PortalPageShell>
    </RoleGate>
  );
}
