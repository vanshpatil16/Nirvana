import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useRole } from "@/context/RoleContext";

export function RouteAccessGuard() {
  const { role, getAccess, ready } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ready) return;

    const checkRoute = () => {
      const pathname = window.location.pathname;
      // Landing page and root are always accessible
      if (pathname === "/" || pathname === "") return;

      const access = getAccess(pathname);
      if (access === "hidden") {
        if (window.location.pathname !== role.landingRoute) {
          router.navigate({ href: role.landingRoute });
        }
      }
    };

    checkRoute();

    // Also check on popstate/navigation
    window.addEventListener("popstate", checkRoute);
    return () => {
      window.removeEventListener("popstate", checkRoute);
    };
  }, [role.id, role.landingRoute, role.label, getAccess, ready]);

  return null;
}
