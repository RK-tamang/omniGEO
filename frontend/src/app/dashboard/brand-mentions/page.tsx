"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function BrandIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    api.getOverview().then((res) => {
      if (res.ok) setOverview(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="Brand Intelligence" sub="Track brand mentions, entity consistency, and product representation in AI answers" />
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
        title="Brand Intelligence"
        sub="Track brand mentions, entity consistency, and product representation in AI answers"
        aside={<Button size="sm">Add Brand</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Brand Mentions" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{overview?.metrics?.brand_mentions ?? "0"}</p>
            <p className="mt-2 text-xs text-mist-dim">Brand mentions found</p>
          </div>
        </Panel>
        <Panel title="Alias Matches" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{overview?.metrics?.active_prompts ?? "0"}</p>
            <p className="mt-2 text-xs text-mist-dim">Configured brand aliases matched</p>
          </div>
        </Panel>
        <Panel title="Entity Consistency" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{overview.metrics?.total_observations ?? 0 > 0 ? Math.round((overview.metrics.brand_mentions / overview.metrics.total_observations) * 100) : "--"}%</p>
            <p className="mt-2 text-xs text-mist-dim">Consistent brand signals across sources</p>
          </div>
        </Panel>
      </div>

      <Panel title="Brand Presence by Engine" level={2}>
        <EmptyState title="No brand data" sub="Run visibility scans to collect brand mention data." />
      </Panel>

      <Panel title="Brand Consistency Findings" level={2}>
        <EmptyState title="No findings" sub="Add brand aliases and run scans to generate consistency findings." />
      </Panel>
    </div>
  );
}