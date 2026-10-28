"use client";

import Link from "next/link";
import { SectionHeader } from "@/components/ui";
import { AdminShell } from "@/components/shell";

const shortcuts = [
  { title: "Overview", desc: "Platform KPIs and recent activity", href: "/", icon: "layout-dashboard", color: "iris" },
  { title: "Users", desc: "Manage platform users", href: "/users", icon: "users", color: "aqua" },
  { title: "Workspaces", desc: "Manage workspaces and plans", href: "/workspaces", icon: "building", color: "mint" },
  { title: "Billing", desc: "MRR and organization billing", href: "/billing", icon: "credit-card", color: "gold" },
  { title: "Invoices", desc: "Billing invoices", href: "/invoices", icon: "file-text", color: "coral" },
  { title: "Teams", desc: "Team management", href: "/teams", icon: "layers", color: "iris" },
  { title: "Domains", desc: "Whitelisted domains", href: "/domains", icon: "globe", color: "aqua" },
  { title: "AI Providers", desc: "Enable/disable AI providers", href: "/providers", icon: "link-2", color: "mint" },
  { title: "Settings", desc: "System configuration", href: "/settings", icon: "settings", color: "gold" },
  { title: "Audit Log", desc: "Admin action history", href: "/audit-log", icon: "file-search", color: "coral" },
];

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, React.ReactNode> = {
    "layout-dashboard": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>),
    "users": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
    "building": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><rect x="3" y="21" width="18" height="3" rx="1" /><path d="M7 21V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12" /><rect x="5" y="12" width="2" height="6" /><rect x="11" y="9" width="2" height="9" /><rect x="17" y="15" width="2" height="3" /></svg>),
    "credit-card": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>),
    "file-text": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="12" y2="18" /></svg>),
    "layers": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><polygon points="12 2 2 7 2 17 12 22 22 17 22 7" /><path d="M12 22v-10" /><path d="M2 12l10-5" /><path d="M22 12l-10 5" /></svg>),
    "globe": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>),
    "link-2": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>),
    "settings": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 1 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1 1.51 1.65 1.65 0 0 1-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 1 .33-1.82V3a2 2 0 0 1 2-2 2 2 0 0 1-2-2h-.09A1.65 1.65 0 0 0 15.4 3a1.65 1.65 0 0 0-1.82-.33l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H15a1.65 1.65 0 0 1-1 1.51z" /></svg>),
    "file-search": (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...common}><path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><circle cx="11.5" cy="11.5" r="2.5" /><line x1="14" y1="14" x2="17.5" y2="17.5" /></svg>),
  };
  return <div className="size-4 flex-shrink-0">{icons[name] ?? <span>?</span>}</div>;
}

export default function DashboardPage() {
  return (
    <AdminShell>
      <SectionHeader title="Admin shortcuts" sub="Quick access to every admin control area." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <section className="rounded-2xl border border-border bg-surface/60 backdrop-blur-xl elevate p-5 hover:border-iris/50 hover:shadow-lg hover:shadow-iris/10 transition-all">
              <div className="flex items-start justify-between">
                <div className="size-8 rounded-xl border border-border/60 bg-surface-2 flex items-center justify-center text-xl">
                  <Icon name={s.icon} />
                </div>
                <span className="text-xs font-mono text-muted-dim">Open →</span>
              </div>
              <h3 className="mt-4 font-medium text-chalk">{s.title}</h3>
              <p className="mt-1 text-xs text-muted-dim">{s.desc}</p>
            </section>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
