import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronDown, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_ROLE,
  ROLES,
  onRoleChange,
  readRole,
  roleById,
  writeRole,
  type RoleId,
} from "@/data/roles";

const USER = { name: "Omkar Kudalkar", initials: "OK" };

/** Header profile button with a demo role switcher, shared by every page. */
export function ProfileMenu() {
  // Start from the default so server and client render the same markup, then load the saved role
  const [roleId, setRoleId] = useState<RoleId>(DEFAULT_ROLE);
  useEffect(() => {
    setRoleId(readRole());
    return onRoleChange(setRoleId);
  }, []);
  const role = roleById(roleId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="profile" aria-label={`${USER.name}, ${role.title}. Switch role`}>
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
            <small>{role.title}</small>
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
              {role.title} · {role.org}
            </small>
          </div>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuLabel className="profile-menu-label">View platform as</DropdownMenuLabel>
        <div className="profile-menu-list">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const active = r.id === roleId;
            return (
              <DropdownMenuItem
                key={r.id}
                className={`profile-role${active ? " active" : ""}`}
                onSelect={() => {
                  writeRole(r.id);
                  setRoleId(r.id);
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
                  <b>{r.title}</b>
                  <small>{r.description}</small>
                </span>
                {active && <Check className="tick" />}
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="profile-menu-go">
          <a href={role.home.href}>
            Open {role.home.label} <ArrowRight />
          </a>
        </DropdownMenuItem>
        <p className="profile-menu-note">
          <Info /> Demo roles — switching changes your view, not your access.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
