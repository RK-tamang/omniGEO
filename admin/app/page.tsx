"use client";

import { SectionHeader, KpiCard, EmptyState, StatusChip, DataTable } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { getUsers, getWorkspaces, getBilling } from "@/lib/api";
import { useEffect, useState } from "react";

export default function OverviewPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [u, w, b] = await Promise.all([
          getUsers(5, 0).catch(() => ({ users: [] })),
          getWorkspaces(5, 0).catch(() => ({ workspaces: [] })),
          getBilling().catch(() => null),
        ]);
        if (!active) return;
        setUsers(u.users ?? []);
        setWorkspaces(w.workspaces ?? []);
        setBilling(b);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <AdminShell>
        <SectionHeader title="Platform overview" sub="Loading platform metrics…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <KpiCard key={i} label="Loading" value="—" delta={0} trend="neutral" sub="" />
          ))}
        </div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <SectionHeader title="Platform overview" sub="Unable to reach the backend API." />
        <EmptyState title="Backend unreachable" sub={error} />
      </AdminShell>
    );
  }

  const totalMonthly = billing?.total_monthly_microusd ?? 0;
  const mrr = (totalMonthly / 1_000_000).toFixed(2);

  return (
    <AdminShell>
      <SectionHeader title="Platform overview" sub="High-level health of the OmniGEO platform across all workspaces." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active workspaces" value={workspaces.length} delta={0} trend="neutral" sub="Workspaces tracked in admin" color="iris" />
        <KpiCard label="Registered users" value={users.length} delta={0} trend="neutral" sub="Users across all workspaces" color="aqua" />
        <KpiCard label="MRR" value={`$${mrr}`} delta={0} trend="neutral" sub="Monthly recurring revenue" color="mint" />
        <KpiCard label="AI providers" value={5} delta={0} trend="neutral" sub="ChatGPT, Gemini, Claude, Perplexity, OpenAI" color="gold" />
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface/60 backdrop-blur-xl elevate p-5">
          <h2 className="text-sm font-semibold text-chalk">Recent workspaces</h2>
          {workspaces.length === 0 ? (
            <EmptyState title="No workspaces" sub="Workspaces will appear here once tracked." />
          ) : (
            <DataTable
              columns={[
                { key: "name", label: "Name" },
                { key: "plan", label: "Plan" },
                { key: "status", label: "Status" },
                { key: "user_count", label: "Users" },
              ]}
              rows={workspaces.map((w) => ({ ...w, status: <StatusChip status={String(w.status ?? "Active")} /> }))}
            />
          )}
        </section>
        <section className="rounded-2xl border border-border bg-surface/60 backdrop-blur-xl elevate p-5">
          <h2 className="text-sm font-semibold text-chalk">Recent users</h2>
          {users.length === 0 ? (
            <EmptyState title="No users" sub="Users will appear here once tracked." />
          ) : (
            <DataTable
              columns={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "role", label: "Role" },
                { key: "status", label: "Status" },
              ]}
              rows={users.map((u) => ({ ...u, status: <StatusChip status={String(u.status ?? "Active")} /> }))}
            />
          )}
        </section>
      </section>
    </AdminShell>
  );
}
