import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

type Status = "loading" | "ready" | "error";

export const Route = createFileRoute("/secret")({
  head: () => ({
    meta: [
      { title: "Profile views — NIRVANA" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Internal view of how many people have visited this site.",
      },
    ],
  }),
  component: SecretRoute,
});

function SecretRoute() {
  const [status, setStatus] = useState<Status>("loading");
  const [count, setCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/views", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`counter responded ${response.status}`);
      const payload = (await response.json()) as { count: number | null };
      if (typeof payload.count !== "number") throw new Error("counter unavailable");
      setCount(payload.count);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#07080a] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, rgba(22,163,74,0.18), transparent 70%), radial-gradient(50% 40% at 80% 100%, rgba(56,189,248,0.10), transparent 70%)",
        }}
      />

      <header className="relative flex items-center justify-between px-6 py-5 text-[11px] tracking-[0.2em] text-white/40 uppercase sm:px-10">
        <span>NIRVANA · internal</span>
        <Link
          to="/"
          className="text-white/50 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
        >
          exit →
        </Link>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="mb-8 text-[11px] tracking-[0.35em] text-white/40 uppercase">profile views</p>

        {status === "loading" && (
          <div
            className="h-[clamp(4rem,16vw,9rem)] w-[clamp(6rem,34vw,20rem)] animate-pulse rounded-lg bg-white/10"
            aria-label="Loading view count"
          />
        )}

        {status === "error" && (
          <div className="max-w-sm">
            <p className="text-[clamp(1.75rem,5vw,3rem)] font-semibold tracking-tight text-white/70">
              counter offline
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/40">
              The tally service didn't answer. Nothing is lost — try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-7 rounded-full border border-white/20 px-6 py-2.5 text-xs tracking-[0.2em] uppercase transition-colors hover:border-white/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            >
              retry
            </button>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="flex items-end justify-center gap-2 sm:gap-3">
              {String(count ?? 0)
                .split("")
                .map((digit, index) => (
                  <span
                    key={`${index}-${digit}`}
                    className="flex h-[clamp(4rem,15vw,8.5rem)] w-[clamp(2.75rem,10vw,6rem)] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] font-semibold tabular-nums text-[clamp(2.25rem,9vw,5rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    {digit}
                  </span>
                ))}
            </div>

            <p className="mt-8 max-w-md text-sm leading-relaxed text-white/45">
              people have opened this site — counted once per browser, ever.
            </p>

            <button
              type="button"
              onClick={() => void load()}
              className="mt-7 text-[11px] tracking-[0.25em] text-white/35 uppercase transition-colors hover:text-white/70 focus-visible:text-white/70 focus-visible:outline-none"
            >
              refresh
            </button>
          </>
        )}
      </main>

      <footer className="relative px-6 pb-8 text-center text-[11px] tracking-[0.2em] text-white/25 uppercase sm:px-10">
        nobody else can see this page
      </footer>
    </div>
  );
}
