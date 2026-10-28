"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";
import { StatusChip } from "@/components/dashboard/panel";

export default function BillingUsagePage() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const u = await api.getBillingUsage();
      if (u.ok) setUsage(u.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="Billing & Usage" sub="Manage subscription, credits, AI provider usage, and crawl quotas" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiCard key={i} label="Loading..." value="--" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Billing & Usage"
        sub="Manage subscription, credits, AI provider usage, and crawl quotas"
        aside={<Button size="sm">Manage Subscription</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Current Plan" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{usage?.plan ?? "Starter"}</p>
            <p className="mt-2 text-xs text-mist-dim">Active subscription</p>
          </div>
        </Panel>
        <Panel title="Credits Consumed" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">
              ${(usage?.credits_consumed ?? 0) / 1e6}
            </p>
            <p className="mt-2 text-xs text-mist-dim">DataForSEO provider usage</p>
          </div>
        </Panel>
        <Panel title="Monthly Budget" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">${usage?.monthly_budget_usd ?? 0}</p>
            <p className="mt-2 text-xs text-mist-dim">DataForSEO monthly cap</p>
          </div>
        </Panel>
      </div>

      <Panel title="Usage Details" level={2}>
        <div className="space-y-3">
          {[
            { name: "Total Requests", value: usage?.total_requests ?? 0, unit: "requests" },
            { name: "Successful", value: usage?.successful_requests ?? 0, unit: "requests" },
            { name: "Failed", value: usage?.failed_requests ?? 0, unit: "requests" },
            { name: "Daily Spent", value: usage?.daily_spent_usd ?? 0, unit: "USD" },
            { name: "Monthly Spent", value: usage?.monthly_spent_usd ?? 0, unit: "USD" },
          ].map((e) => (
            <div key={e.name} className="flex items-center justify-between py-2 border-b border-line/50 last:border-0">
              <span className="text-sm text-mist">{e.name}</span>
              <div className="text-right">
                <p className="font-mono text-xs text-chalk">{e.value} {e.unit}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Quota Status" level={2}>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-line/50">
            <span className="text-sm text-mist">Daily Budget</span>
            <StatusChip status={usage?.quota_exhausted ? "warning" : "good"} />
          </div>
          <div className="w-full bg-surface-2 rounded-full h-2">
            <div
              className="bg-iris h-full rounded-full"
              style={{
                width: Math.min(100, ((usage?.daily_spent_usd ?? 0) / usage?.daily_budget_usd) * 100),
              }}
            />
          </div>
          <p className="text-xs text-mist-dim">
            {usage?.quota_exhausted ? "Daily budget exhausted — no new DataForSEO tasks until reset." : "Within daily budget."}
          </p>
        </div>
      </Panel>

      <Panel title="Billing Events" level={2}>
        <EmptyState title="No billing events" sub="Usage events and invoices appear here after subscription activity." />
      </Panel>

      <Panel title="Subscription" level={2}>
        <div className="space-y-4">
          <p className="text-xs font-mono text-mist-dim uppercase tracking-widest">Change plan</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: "Free", price: "$0", desc: "Limited scans and audits" },
              { name: "Starter", price: "$29/mo", desc: "100 observations, 50 prompts" },
              { name: "Best Value", price: "$79/mo", desc: "500 observations, 200 prompts" },
            ].map((p) => (
              <Panel key={p.name} title={p.name} level={3}>
                <p className="font-mono text-sm text-chalk">{p.price}</p>
                <p className="text-xs text-mist-dim">{p.desc}</p>
                <Button size="sm" variant="outline" className="w-full mt-3">Select</Button>
              </Panel>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
