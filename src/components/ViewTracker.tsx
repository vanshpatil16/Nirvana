import { useEffect } from "react";

const VIEWER_ID_KEY = "nirvana:viewer-id";

function newViewerId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the timestamp id below
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Bumps POST /api/views exactly once per browser, forever: the first visit
 * mints a random viewer id into localStorage, and any later visit sees that id
 * and stops. That is as close to "unique viewers" as a counter gets without a
 * login or an analytics backend — the server never sees the id, so nothing
 * identifies a person across devices.
 *
 * Renders nothing; mounted once from the root route.
 */
export function ViewTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (window.localStorage.getItem(VIEWER_ID_KEY)) return;
      // Set before the request so a StrictMode double-run can't double count.
      window.localStorage.setItem(VIEWER_ID_KEY, newViewerId());
    } catch {
      // Storage blocked (private mode / disabled) — count the raw view instead.
    }

    void fetch("/api/views", { method: "POST", keepalive: true }).catch(() => {
      // Counter unreachable: never surface this to the visitor.
    });
  }, []);

  return null;
}
