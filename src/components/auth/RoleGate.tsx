import React, { useEffect } from "react";
import { type RoleId } from "@/config/roles";
import { useRole } from "@/context/RoleContext";

interface RoleGateProps {
  allow: RoleId[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGate({ allow, fallback, children }: RoleGateProps) {
  const { roleId, role, ready } = useRole();
  const isAuthorized = allow.includes(roleId);

  useEffect(() => {
    if (!isAuthorized && ready && typeof window !== "undefined") {
      // Allow slight delay so redirect cleanly
      const timer = setTimeout(() => {
        if (window.location.pathname !== role.landingRoute) {
          window.location.href = role.landingRoute;
        }
      }, 350);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAuthorized, role.landingRoute, role.label, ready]);

  if (!ready) {
    return null;
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This module is not accessible for the <strong>{role.label}</strong> persona.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href={role.landingRoute}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to {role.label} Workspace
          </a>
        </div>
      </div>
    </div>
  );
}
