"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { BotStatus, CrawlerBot } from "@/lib/dashboard-config";

const statusStyles: Record<BotStatus, string> = {
  allowed: "border-mint/40 bg-mint/10 text-mint",
  blocked: "border-coral/40 bg-coral/10 text-coral",
  limited: "border-gold/40 bg-gold/10 text-gold",
};

const statusLabel: Record<BotStatus, string> = {
  allowed: "Allowed",
  blocked: "Blocked",
  limited: "Partly blocked",
};

type State = "loading" | "idle" | "checking" | "done" | "error";

export function CrawlerBots({ bots: initial, domain }: { bots?: CrawlerBot[]; domain?: string }) {
  const [bots, setBots] = useState<CrawlerBot[]>(initial ?? []);
  const [state, setState] = useState<State>(initial ? "idle" : "loading");

  const recheck = useCallback(async () => {
    setState("checking");
    try {
      const res = await fetch("/api/crawler/robots", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !Array.isArray(body?.bots)) throw new Error(body?.error ?? "Check failed");
      setBots(
        body.bots.map((b: { bot: string; owner: string; purpose: string; status: BotStatus }) => ({
          bot: b.bot,
          owner: b.owner,
          purpose: b.purpose,
          status: b.status,
          lastChecked: "just now",
        })),
      );
      setState("done");
      window.setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 4000);
    }
  }, []);

  useEffect(() => {
    if (!initial) void recheck();
  }, [initial, recheck]);

  if (state === "loading") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-line bg-surface-1" />
        ))}
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <EmptyState
        title="No crawler data yet"
        sub={
          domain
            ? `We could not read ${domain}/robots.txt yet. Set a domain on the workspace and run the check again.`
            : "Set a domain on the workspace and the check will read its real robots.txt."
        }
      />
    );
  }

  const blocked = bots.filter((b) => b.status !== "allowed").length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mist">
          {blocked === 0 ? (
            <span className="text-mint">Every tracked engine can read this site.</span>
          ) : (
            <>
              <span className="text-coral">{blocked} of {bots.length} bots are blocked or partly blocked</span>{" "}
              <span className="text-mist-dim">— including an engine that answers buyers directly.</span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={recheck}
          disabled={state === "checking"}
          className="shrink-0 rounded-full border border-line px-4 py-1.5 font-mono text-[0.62rem] uppercase tracking-widest text-mist transition-colors hover:border-line-strong hover:text-chalk disabled:opacity-60"
        >
          {state === "checking"
            ? "Checking…"
            : state === "done"
              ? "✓ Checked"
              : state === "error"
                ? "Check failed"
                : "Re-run checks"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {bots.map((b) => (
          <div
            key={b.bot}
            className={`rounded-xl border border-line bg-surface-1 p-4 transition-opacity ${
              state === "checking" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex size-8 items-center justify-center rounded-lg border ${statusStyles[b.status]}`}
                  aria-hidden
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7.5 9.5h9v8h-9zM12 6v3.5M4.5 12v3.5M19.5 12v3.5" />
                    <path d="M10.3 13h.01M13.7 13h.01" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-chalk">{b.bot}</p>
                  <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{b.owner}</p>
                </div>              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${statusStyles[b.status]}`}
              >
                {statusLabel[b.status]}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mist">{b.purpose}</p>
            {b.rule ? (
              <p className="mt-2 font-mono text-[0.58rem] text-mist-dim">rule: {b.rule}</p>
            ) : null}
            <p className="mt-2 border-t border-line pt-2 font-mono text-[0.55rem] text-mist-dim">
              checked {state === "checking" ? "…" : b.lastChecked}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
