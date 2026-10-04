import { ArrowRight, Check, ChevronDown, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/context/RoleContext";

const USER = { name: "Omkar Kudalkar", initials: "OK" };

/** Header profile button with the 6-role switcher, driving the active portal. */
export function ProfileMenu() {
  const { roleId, role, roles, switchRole } = useRole();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="profile" aria-label={`${USER.name}, ${role.label}. Switch role`}>
          <span
            style={{
              background: `color-mix(in oklab, ${role.color} 16%, white)`,
              color: role.color,
            }}
          >
            {USER.initials}
          </span>
          <div>
            <strong>{USER.name}</strong>
            <small>{role.label}</small>
          </div>
          <ChevronDown />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="profile-menu w-[340px] p-0">
        <div className="profile-menu-head">
          <span style={{ background: role.color }}>{USER.initials}</span>
          <div>
            <strong>{USER.name}</strong>
            <small>
              {role.label} · {role.persona}
            </small>
          </div>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuLabel className="profile-menu-label">View platform as</DropdownMenuLabel>
        <div className="profile-menu-list">
          {roles.map((r) => {
            const Icon = r.icon;
            const active = r.id === roleId;
            return (
              <DropdownMenuItem
                key={r.id}
                className={`profile-role${active ? " active" : ""}`}
                onSelect={() => {
                  switchRole(r.id);
                }}
              >
                <i
                  style={{
                    background: `color-mix(in oklab, ${r.color} 14%, white)`,
                    color: r.color,
                  }}
                >
                  <Icon />
                </i>
                <span>
                  <b>{r.label}</b>
                  <small>{r.persona}</small>
                </span>
                {active && <Check className="tick" />}
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="profile-menu-go">
          <a href={role.landingRoute}>
            Open {role.label} Workspace <ArrowRight />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="profile-menu-go">
          <a href="/choose-role">
            Choose a role <ArrowRight />
          </a>
        </DropdownMenuItem>
        <p className="profile-menu-note">
          <Info /> Demo roles — switching sets your active view, landing route & scoped access.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
