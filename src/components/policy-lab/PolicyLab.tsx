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
import { OverviewView } from "./views/OverviewView";
import { Toast } from "./parts/States";
import "./policy-lab.css";

const ACTIVE_ITEM = "Policy Lab";

export type LabMode = "overview" | "existing" | "new";

const SUBNAV: { mode: LabMode; label: string; icon: typeof Home }[] = [
  { mode: "overview", label: "Overview", icon: Home },
  { mode: "existing", label: "Existing Policy", icon: BarChart3 },
  { mode: "new", label: "New Policy", icon: FlaskConical },
];

// ---------------------------------------------------------------------------
// Shell — same global sidebar + header as the rest of the product
// ---------------------------------------------------------------------------

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
            onClick={close}
            aria-label="Close navigation"
          >
            <X />
          </Button>
          <p>National Platform for Research & Policy Innovation in Land Governance</p>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive = label === ACTIVE_ITEM;
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
        <div className="sidebar-bottom">
          <img
            src={sidenavBottom}
            alt="Same Land, More Clarity, Better Decisions — Government of India, Ministry of Rural Development, Department of Land Resources"
          />
        </div>
      </aside>
      {drawer && (
        <button className="drawer-backdrop" onClick={close} aria-label="Close navigation" />
      )}
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
        <button className="profile">
          <span>OK</span>
          <div>
            <strong>Omkar Kudalkar</strong>
            <small>Researcher</small>
          </div>
          <ChevronDown />
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------

export function PolicyLab({ initialMode }: { initialMode?: LabMode }) {
  const [drawer, setDrawer] = useState(false);
  const [mode, setMode] = useState<LabMode>(initialMode ?? "overview");
  const [toast, setToast] = useState<string | null>(null);

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
                {mode === "overview" && <OverviewView onMode={go} />}
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
