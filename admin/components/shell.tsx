"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export type AdminUser = { name: string; email: string; role: string };
export type AdminWorkspace = { name: string; plan: string; users: number };

const nav = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
      { label: "Overview", href: "/", icon: "home" },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { label: "Users", href: "/users", icon: "users" },
      { label: "Teams", href: "/teams", icon: "layers" },
    ],
  },
  {
    label: "WORKSPACES",
    items: [
      { label: "All Workspaces", href: "/workspaces", icon: "building" },
      { label: "Domains", href: "/domains", icon: "globe" },
    ],
  },
  {
    label: "BILLING",
    items: [
      { label: "Plans & Pricing", href: "/billing", icon: "credit-card" },
      { label: "Invoices", href: "/invoices", icon: "file-text" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { label: "AI Providers", href: "/providers", icon: "link-2" },
      { label: "Settings", href: "/settings", icon: "settings" },
      { label: "Audit Log", href: "/audit-log", icon: "file-search" },
    ],
  },
] as const;

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, React.ReactNode> = {
    "layout-dashboard": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>),
    "home": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" /></svg>),
    "users": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
    "building": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><rect x="3" y="21" width="18" height="3" rx="1" /><path d="M7 21V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12" /><rect x="5" y="12" width="2" height="6" /><rect x="11" y="9" width="2" height="9" /><rect x="17" y="15" width="2" height="3" /></svg>),
    "globe": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>),
    "credit-card": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>),
    "file-text": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="12" y2="18" /></svg>),
    "settings": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 1 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1 1.51 1.65 1.65 0 0 1-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 1 .33-1.82V3a2 2 0 0 1 2-2 2 2 0 0 1-2-2h-.09A1.65 1.65 0 0 0 15.4 3a1.65 1.65 0 0 0-1.82-.33l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H15a1.65 1.65 0 0 1-1 1.51z" /></svg>),
    "link-2": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>),
    "file-search": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><circle cx="11.5" cy="11.5" r="2.5" /><line x1="14" y1="14" x2="17.5" y2="17.5" /></svg>),
    "layers": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><polygon points="12 2 2 7 2 17 12 22 22 17 22 7" /><path d="M12 22v-10" /><path d="M2 12l10-5" /><path d="M22 12l-10 5" /></svg>),
  };
  return <div className="size-4 flex-shrink-0">{icons[name] ?? <span>?</span>}</div>;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin navigation">
      {nav.map((group) => (
        <div key={group.label}>
          <p className="px-3 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-dim">{group.label}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm transition-all ${
                      active ? "bg-gradient-to-r from-iris/10 to-aqua/10 text-chalk shadow-[inset_0_0_0_1px_rgba(62,124,176,0.15)]" : "text-muted-dim hover:bg-surface/50 hover:text-chalk"
                    }`}>
                    <span className={active ? "text-iris" : "text-muted-dim"}>
                      <Icon name={item.icon} />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({ onNavigate, workspace }: { onNavigate?: () => void; workspace: AdminWorkspace }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" className="font-mono text-xl font-semibold tracking-tighter">
          OmniGEO<span className="text-iris">Admin</span>
        </Link>
        <Link href="/" className="text-xs text-muted-dim transition-colors hover:text-chalk">← site</Link>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="border-t border-border/50 px-4 pt-4 pb-8">
        <div className="rounded-2xl border border-iris/20 bg-gradient-to-br from-iris/5 via-surface/60 to-aqua/10 backdrop-blur-xl p-3.5 border-line">
          <div className="absolute inset-0 bg-gradient-to-br from-iris/5 to-transparent" />
          <div className="relative">
            <p className="text-[0.55rem] uppercase tracking-widest text-iris">Workspace</p>
            <p className="mt-1.5 text-sm font-medium text-chalk truncate">{workspace.name}</p>
            <p className="text-xs text-muted-dim">{workspace.plan} plan · {workspace.users} user{workspace.users === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const user: AdminUser = { name: "Admin User", email: "admin@omnigeo.example", role: "owner" };
  const workspace: AdminWorkspace = { name: "OmniGEO Platform", plan: "Enterprise", users: 12 };

  return (
    <div className="min-h-screen bg-surface text-chalk">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/50 bg-surface lg:flex">
        <SidebarInner workspace={workspace} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm onClick={() => setOpen(false)}" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex-col border-r border-border/50 bg-surface">
            <SidebarInner workspace={workspace} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 h-14 items-center justify-between gap-3 border-b border-border/50 bg-surface/95 px-4 backdrop-blur-xl lg:hidden">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Open navigation"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-border/50 text-chalk">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-mono text-lg italic tracking-tighter text-chalk">OmniGEO<span className="text-iris">Admin</span></span>
          <span className="size-9" />
        </div>

        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">{children}</div>

        <footer className="mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8">
          <p className="border-t border-border/50 pt-5 font-mono text-[0.62rem] leading-relaxed text-muted-dim">
            Platform administration. Manage users, workspaces, billing and system settings for OmniGEO.
          </p>
        </footer>
      </div>
    </div>
  );
}
