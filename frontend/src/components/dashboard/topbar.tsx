"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DashboardUser } from "@/components/dashboard/shell";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const CRUMBS: Record<string, string> = {
  "/dashboard": "overview",
  "/dashboard/visibility": "ai visibility",
  "/dashboard/ranks": "rank tracker",
  "/dashboard/keywords": "keyword research",
  "/dashboard/competitors": "competitor analysis",
  "/dashboard/local": "local seo",
  "/dashboard/audit": "site audit",
  "/dashboard/crawlers": "ai crawler check",
  "/dashboard/content": "content studio",
  "/dashboard/settings": "settings",
};

export function DashboardTopbar({ user }: { user: DashboardUser }) {
  const pathname = usePathname();
  const crumb = CRUMBS[pathname] ?? "overview";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="sticky top-0 z-40 hidden h-14 items-center justify-between gap-4 border-b border-line bg-ink-950/85 px-8 backdrop-blur lg:flex">
      <nav aria-label="Breadcrumb" className="font-mono text-xs text-mist-dim">
        <span className="text-mist">{user.name.split(" ")[0].toLowerCase()}</span>
        <span className="mx-2 opacity-50">/</span>
        <span className="text-chalk">{crumb}</span>
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden rounded-full border border-iris/40 bg-iris/10 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-chalk sm:inline">
          Demo data
        </span>

        <ThemeToggle />

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-2.5 rounded-full border border-line py-1 pl-1 pr-3 transition-colors hover:border-line-strong"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-iris/40 to-aqua/25 font-mono text-[0.6rem] text-chalk">
              {initials}
            </span>
            <span className="text-xs text-mist">{user.name}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="text-mist-dim">
              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-line bg-ink-900 p-2 shadow-2xl">
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-sm text-chalk">{user.email}</p>
                <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">
                  {user.plan} plan · Northwind Labs
                </p>
              </div>
              <Link
                href="/dashboard/settings"
                className="block rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:bg-surface-2 hover:text-chalk"
                onClick={() => setOpen(false)}
              >
                Settings
              </Link>
              <Link
                href="/"
                className="block rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:bg-surface-2 hover:text-chalk"
                onClick={() => setOpen(false)}
              >
                ← Back to marketing site
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-coral transition-colors hover:bg-coral/10"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
