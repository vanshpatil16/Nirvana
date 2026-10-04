import { useState } from "react";
import { Bell, ChevronDown, Command, Menu, Moon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/AppSidebar";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import { ProfileMenu } from "@/components/ProfileMenu";

/**
 * The Innovation Portal is reachable at both /innovation (the spec route) and
 * /innovation-portal (the legacy entry point, which redirects). Treat both as
 * the same nav destination so the item stays highlighted on every child screen.
 */
function isNavActive(href: string, path: string): boolean {
  if (href === "/innovation-portal") return path.startsWith("/innovation");
  return path === href || path.startsWith(`${href}/`);
}

/**
 * Sidebar + top header shared by every Innovation Portal screen, so the module
 * keeps one continuous frame as the user moves between home, challenges, a
 * challenge brief, the submission wizard and a project workspace.
 */
export function InnovationShell({
  children,
  /** Query text held by the caller so a search can span screens. */
  query,
  onQuery,
  /** Extra navigation entries appended under the main items. */
  subNav,
  /** Right-aligned actions rendered in the header. */
  headerActions,
}: {
  children: React.ReactNode;
  query: string;
  onQuery: (value: string) => void;
  subNav?: { label: string; href: string; active?: boolean }[];
  headerActions?: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const activeHref = typeof window === "undefined" ? "" : window.location.pathname;

  return (
    <TooltipProvider>
      <div className="dashboard-shell">
        <AppSidebar open={drawer} close={() => setDrawer(false)} activeItem="Innovation Portal">
          {subNav && subNav.length > 0 && (
            <nav className="inno-subnav" aria-label="Innovation Portal sections">
              <span className="inno-subnav-label">Innovation Portal</span>
              {subNav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={item.active ? "active" : ""}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </AppSidebar>

        <main>
          <header className="top-header">
            <Button
              variant="ghost"
              size="icon"
              className="menu-button"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <label className="global-search">
              <Search />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search challenges, datasets, projects, evidence, institutions..."
                aria-label="Search the innovation portal"
              />
              <kbd>
                <Command /> K
              </kbd>
            </label>
            <div className="header-tools">
              {headerActions}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Theme settings">
                    <Moon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Light appearance</TooltipContent>
              </Tooltip>
              <button className="lang">
                EN <ChevronDown />
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="notification"
                aria-label="Notifications"
              >
                <Bell />
                <i />
              </Button>
              <ProfileMenu />
            </div>
          </header>
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
