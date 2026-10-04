import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import { useRole } from "@/context/RoleContext";

interface AppSidebarProps {
  open: boolean;
  close: () => void;
  activeItem?: string;
  className?: string;
  children?: React.ReactNode;
}

export function AppSidebar({ open, close, activeItem, className = "", children }: AppSidebarProps) {
  const { role } = useRole();

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""} ${className}`} aria-label={`${role.label} navigation`}>
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <img src={logo} alt="NIRVANA Logo" width={38} height={38} />
            </span>
            <div>
              <strong>NIRVANA</strong>
              <b>निर्वाण</b>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-close"
            onClick={close}
            aria-label="Close navigation"
          >
            <X />
          </Button>
          <p>National Platform for Research & Policy Innovation in Land Governance</p>
        </div>

        <nav aria-label="Main navigation">
          {role.sidebar.map(({ label, icon: Icon, route, badge }) => {
            const isActive =
              label === activeItem ||
              currentPath === route ||
              (route !== "/" && route !== "/dashboard" && currentPath.startsWith(route));

            return (
              <a
                key={label}
                href={route}
                className={isActive ? "active" : ""}
                aria-current={isActive ? "page" : undefined}
                title={`${label} — ${role.label} view`}
              >
                <Icon />
                <span>{label}</span>
                {badge && (
                  <span
                    className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded tracking-wide ${
                      badge === "Limited"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                        : badge === "Public"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {children}

        <div className="sidebar-bottom">
          <img
            src={sidenavBottom}
            alt="Same Land, More Clarity, Better Decisions — Government of India, Ministry of Rural Development, Department of Land Resources"
          />
        </div>
      </aside>

      {open && (
        <button
          className="drawer-backdrop fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-label="Close navigation"
        />
      )}
    </>
  );
}
