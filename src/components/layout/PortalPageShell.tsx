import React, { useState } from "react";
import {
  Bell,
  ChevronDown,
  Command,
  Menu,
  Moon,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ProfileMenu } from "@/components/ProfileMenu";

interface PortalPageShellProps {
  children: React.ReactNode;
  activeItem: string;
}

export function PortalPageShell({ children, activeItem }: PortalPageShellProps) {
  const [drawer, setDrawer] = useState(false);

  return (
    <TooltipProvider>
      <div className="dashboard-shell">
        <AppSidebar open={drawer} close={() => setDrawer(false)} activeItem={activeItem} />
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
              <input placeholder="Search villages, parcels, surveys, policies, datasets…" />
              <kbd>
                <Command /> K
              </kbd>
            </label>
            <div className="header-tools">
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
              <Button variant="ghost" size="icon" className="notification" aria-label="Notifications">
                <Bell />
                <i />
              </Button>
              <ProfileMenu />
            </div>
          </header>
          <div className="dashboard-content">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
