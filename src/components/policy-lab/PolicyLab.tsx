import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  Command,
  FlaskConical,
  Home,
  Menu,
  Moon,
  Plus,
  Scale,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { navItems } from "@/data/dashboard";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import { ExistingPolicyView } from "./views/ExistingPolicyView";
import { NewPolicyView } from "./views/NewPolicyView";
import { OverviewView, type CorpusCounts } from "./views/OverviewView";
import { StatutorySearchView } from "./views/StatutorySearchView";
import { Toast } from "./parts/States";
import "./policy-lab.css";

const ACTIVE_ITEM = "Policy Lab";

export type LabMode = "overview" | "statute" | "existing" | "new";

/**
 * Real corpus counts, fetched once here and handed to OverviewView.
 *
 * Lives at the shell so the hero has numbers on first paint rather than
 * animating up from em dashes, and so the request is not repeated per tab.
 */
function useCorpusCounts(): CorpusCounts | null {
  const [counts, setCounts] = useState<CorpusCounts | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/policies/source-status");
        if (!res.ok) return;
        const body = (await res.json()) as CorpusCounts;
        // available:false means the artefacts are missing. Stay null so the UI
        // says "not installed" instead of showing zero as if it were a finding.
        if (live && body.available !== false) setCounts(body);
      } catch {
        /* offline or route absent: the hero falls back to em dashes */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return counts;
}

const SUBNAV: { mode: LabMode; label: string; icon: typeof Home }[] = [
  { mode: "overview", label: "Overview", icon: Home },
  // First, because it is the only tab backed entirely by real data.
  { mode: "statute", label: "Statutory Search", icon: Scale },
  { mode: "existing", label: "Existing Policy", icon: BarChart3 },
  { mode: "new", label: "New Policy", icon: FlaskConical },
];

// ---------------------------------------------------------------------------
// Shell — same global sidebar + header as the rest of the product
// ---------------------------------------------------------------------------

import { AppSidebar } from "@/components/layout/AppSidebar";
import { ProfileMenu } from "@/components/ProfileMenu";

function Shell({
  drawer,
  close,
  children,
}: {
  drawer: boolean;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <AppSidebar open={drawer} close={close} activeItem={ACTIVE_ITEM} />
      {children}
    </>
  );
}

function PageHeader({ openMenu, onSearch }: { openMenu: () => void; onSearch: () => void }) {
  return (
    <header className="top-header">
      <Button
        variant="ghost"
        size="icon"
        className="menu-button"
        onClick={openMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <label className="global-search">
        <Search />
        <input
          placeholder="Search policies, indicators, datasets, units…"
          aria-label="Search the Policy Lab"
          onFocus={onSearch}
          readOnly
        />
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
  );
}

// ---------------------------------------------------------------------------

export function PolicyLab({ initialMode }: { initialMode?: LabMode }) {
  const [drawer, setDrawer] = useState(false);
  const [mode, setMode] = useState<LabMode>(initialMode ?? "statute");
  const [toast, setToast] = useState<string | null>(null);
  const corpus = useCorpusCounts();

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const go = useCallback((m: LabMode) => {
    setMode(m);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <TooltipProvider>
      <div className="dashboard-shell">
        <Shell drawer={drawer} close={() => setDrawer(false)}>
          <main>
            <PageHeader openMenu={() => setDrawer(true)} onSearch={() => go("overview")} />
            <div className="dashboard-content pl">
              <div className="pl-subnav">
                <div className="pl-subnav-title">
                  <FlaskConical /> Policy Lab
                </div>
                <nav aria-label="Policy Lab sections">
                  {SUBNAV.map((s) => (
                    <button
                      key={s.mode}
                      className={mode === s.mode ? "active" : ""}
                      aria-current={mode === s.mode ? "page" : undefined}
                      onClick={() => go(s.mode)}
                    >
                      {s.label}
                    </button>
                  ))}
                </nav>
                <div className="pl-subnav-aside">
                  <button className="pl-btn sm" onClick={() => go("new")}>
                    <Plus />
                    New scenario
                  </button>
                </div>
              </div>

              <div style={{ paddingTop: 24 }}>
                {mode === "overview" && <OverviewView onMode={go} corpus={corpus} />}
                {mode === "statute" && <StatutorySearchView />}
                {mode === "existing" && <ExistingPolicyView />}
                {mode === "new" && <NewPolicyView onToast={setToast} />}
              </div>
            </div>
          </main>
        </Shell>
        {toast && <Toast message={toast} />}
      </div>
    </TooltipProvider>
  );
}
