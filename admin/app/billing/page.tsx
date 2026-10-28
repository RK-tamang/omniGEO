"use client";

import { SectionHeader, KpiCard, EmptyState, StatusChip, Select } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { getBilling, updateBilling } from "@/lib/api";
import { useEffect, useState } from "react";

export default function BillingPage() {
  const [billing, setBilling] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBilling();
        if (!active) return;
        setBilling(data.billing ?? []);
        setTotal(data.total_monthly_microusd ?? 0);
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

  async function handleUpdate(orgId: string, field: string, value: string) {
    setSaving((prev) => new Set([...prev, orgId]));
    try {
      await updateBilling(orgId, { [field]: value });
      setBilling((prev) => prev.map((b) => (b.organization_id === orgId ? { ...b, [field]: value } : b)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(orgId); return n; });
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <SectionHeader title="Billing & plans" sub="Loading billing data…" />
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <SectionHeader title="Billing & plans" sub="Unable to load billing data." />
        <EmptyState title="Backend unreachable" sub={error} />
      </AdminShell>
    );
  }

  const mrr = (total / 1_000_000).toFixed(2);

  return (
    <AdminShell>
      <SectionHeader title="Billing & plans" sub="Subscription plans, pricing and monthly recurring revenue across the platform." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="MRR" value={`$${mrr}`} delta={0} trend="neutral" sub="Monthly recurring revenue" color="mint" />
        <KpiCard label="Total billing" value={billing.length} delta={0} trend="neutral" sub="Organizations on record" color="iris" />
        <KpiCard label="Starter" value={billing.filter((b) => b.plan === "starter").length} delta={0} trend="neutral" sub="Organizations" color="aqua" />
        <KpiCard label="Pro + Enterprise" value={billing.filter((b) => b.plan !== "starter").length} delta={0} trend="neutral" sub="Organizations" color="gold" />
      </div>
      <section className="mt-8 rounded-2xl border border-border bg-surface/60 backdrop-blur-xl elevate p-5">
        <h2 className="text-sm font-semibold text-chalk">Organization billing</h2>
        {billing.length === 0 ? (
          <EmptyState title="No billing records" sub="Billing records will appear here once tracked." />
        ) : (
          <div className="space-y-3">
            {billing.map((b) => (
              <div key={b.organization_id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-surface-1 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-chalk truncate max-w-[120px]">{String(b.organization_id).slice(0, 8)}…</span>
                  <Select
                    value={b.plan ?? "starter"}
                    onChange={(v) => handleUpdate(b.organization_id as string, "plan", v)}
                    disabled={saving.has(b.organization_id as string)}
                    options={[
                      { label: "Starter", value: "starter" },
                      { label: "Pro", value: "pro" },
                      { label: "Enterprise", value: "enterprise" },
                    ]}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-dim">Status</span>
                  <Select
                    value={b.status ?? "active"}
                    onChange={(v) => handleUpdate(b.organization_id as string, "status", v)}
                    disabled={saving.has(b.organization_id as string)}
                    options={[
                      { label: "Active", value: "active" },
                      { label: "Past due", value: "past_due" },
                      { label: "Canceled", value: "canceled" },
                    ]}
                  />
                </div>
                <span className="font-mono text-sm text-chalk">
                  ${(b.monthly_revenue_microusd ?? 0) / 1_000_000}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
