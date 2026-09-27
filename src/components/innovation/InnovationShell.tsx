import { useState } from "react";
import { Bell, ChevronDown, Command, Menu, Moon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { navItems } from "@/data/dashboard";
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
        <aside className={`sidebar ${drawer ? "open" : ""}`}>
          <div className="sidebar-top">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                <img src={logo} alt="BHUMI-NITI Logo" width={38} height={38} />
              </span>
              <div>
                <strong>BHUMI-NITI</strong>
                <b>भूमि-नीति</b>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-close"
              onClick={() => setDrawer(false)}
              aria-label="Close navigation"
            >
              <X />
            </Button>
            <p>National Platform for Research &amp; Policy Innovation in Land Governance</p>
          </div>
          <nav aria-label="Main navigation">
            {navItems.map(({ label, icon: Icon, href }) => {
              const isActive = href ? isNavActive(href, activeHref) : false;
              if (href) {
                return (
                  <a
                    key={label}
                    href={href}
                    className={isActive ? "active" : ""}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon />
                    <span>{label}</span>
                  </a>
                );
              }
              return (
                <button
                  key={label}
                  className={isActive ? "active" : ""}
                  title={`${label} — coming soon`}
                >
                  <Icon />
                  <span>{label}</span>
                  <i>Soon</i>
                </button>
              );
            })}
          </nav>
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
          <div className="sidebar-bottom">
            <img
              src={sidenavBottom}
              alt="Same Land, More Clarity, Better Decisions — Government of India, Ministry of Rural Development, Department of Land Resources"
            />
          </div>
        </aside>
        {drawer && (
          <button
            className="drawer-backdrop"
            onClick={() => setDrawer(false)}
            aria-label="Close navigation"
          />
        )}

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
