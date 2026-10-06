import { useEffect } from "react";

const LAST_VIEW_KEY = "nirvana:last-view";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Bumps GET/POST /api/views once per browser per calendar day, so the tally on
 * /secret approximates "people who have seen the site" instead of raw reloads.
 * Renders nothing; mounted once from the root route.
 */
export function ViewTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (window.localStorage.getItem(LAST_VIEW_KEY) === todayKey()) return;
      window.localStorage.setItem(LAST_VIEW_KEY, todayKey());
    } catch {
      // Storage blocked (private mode / disabled) — count the raw view instead.
    }

    void fetch("/api/views", { method: "POST", keepalive: true }).catch(() => {
      // Counter unreachable: never surface this to the visitor.
    });
  }, []);

  return null;
}
