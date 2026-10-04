import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import {
  DEFAULT_ROLE_ID,
  ROLE_LIST,
  ROLES,
  getRoleConfig,
  getRouteAccessLevel,
  type AccessLevel,
  type RoleConfig,
  type RoleId,
} from "@/config/roles";

const STORAGE_KEY = "nirvana:role";
const LEGACY_STORAGE_KEY = "bhumi:role";
const ROLE_CHANGE_EVENT = "nirvana:role-change";

interface RoleContextType {
  roleId: RoleId;
  role: RoleConfig;
  roles: RoleConfig[];
  ready: boolean;
  switchRole: (newRoleId: RoleId, navigateToLanding?: boolean) => void;
  getAccess: (pathname: string) => AccessLevel;
  isAllowed: (pathname: string) => boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

function readSavedRole(): RoleId {
  if (typeof window === "undefined") {
    return DEFAULT_ROLE_ID;
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved && saved in ROLES) {
      return saved as RoleId;
    }
    // Handle old role mappings if user had one saved
    if (saved === "collector" || saved === "revenue" || saved === "gis") return "officer";
    if (saved === "policy") return "policymaker";
  } catch {
    // fallback
  }
  return DEFAULT_ROLE_ID;
}

export function RoleProvider({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate?: (path: string) => void;
}) {
  const [roleId, setRoleIdState] = useState<RoleId>(DEFAULT_ROLE_ID);
  const [ready, setReady] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const initial = readSavedRole();
    setRoleIdState(initial);
    setReady(true);

    const handleCustomChange = (e: Event) => {
      const detail = (e as CustomEvent<RoleId>).detail;
      if (detail && detail in ROLES) {
        setRoleIdState(detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY) && e.newValue && e.newValue in ROLES) {
        setRoleIdState(e.newValue as RoleId);
      }
    };

    window.addEventListener(ROLE_CHANGE_EVENT, handleCustomChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(ROLE_CHANGE_EVENT, handleCustomChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const switchRole = (newRoleId: RoleId, navigateToLanding: boolean = true) => {
    if (!ROLES[newRoleId]) return;

    startTransition(() => {
      setRoleIdState(newRoleId);
    });

    try {
      window.localStorage.setItem(STORAGE_KEY, newRoleId);
      window.localStorage.setItem(LEGACY_STORAGE_KEY, newRoleId);
    } catch {
      // storage unavailable
    }

    window.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, { detail: newRoleId }));

    if (navigateToLanding && typeof window !== "undefined") {
      const targetRole = ROLES[newRoleId];
      const currentPath = window.location.pathname;
      if (currentPath !== targetRole.landingRoute) {
        if (onNavigate) {
          onNavigate(targetRole.landingRoute);
        } else {
          window.location.href = targetRole.landingRoute;
        }
      }
    }
  };

  const getAccess = (pathname: string): AccessLevel => {
    return getRouteAccessLevel(roleId, pathname);
  };

  const isAllowed = (pathname: string): boolean => {
    const level = getRouteAccessLevel(roleId, pathname);
    return level !== "hidden";
  };

  const role = getRoleConfig(roleId);

  return (
    <RoleContext.Provider
      value={{
        roleId,
        role,
        roles: ROLE_LIST,
        ready,
        switchRole,
        getAccess,
        isAllowed,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextType {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return ctx;
}
