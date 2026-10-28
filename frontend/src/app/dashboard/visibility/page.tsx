"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkline } from "@/components/dashboard/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function AiVisibilityPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [engines, setEngines] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [ov, eng] = await Promise.all([api.getOverview(), api.getEngines()]);
        if (ov.ok) setOverview(ov.data);
        if (eng.ok) setEngines(eng.data?.engines ?? eng.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load visibility data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="AI Visibility" sub="Track AI search visibility across engines" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiCard key={i} label="Loading..." value="--" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="AI Visibility" sub="Track AI search visibility across engines" />
        <Panel title="Error" level={3}>
          <p className="text-sm text-coral">{error}</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="AI Visibility"
        sub="Track AI search visibility across engines"
        aside={
          <Button size="sm">Run Visibility Scan</Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Mention Rate"
          value={overview.metrics?.brand_mentions ?? "--"}
          sub="Brand mentions found"
          spark={[45, 52, 58, 61]}
          color="#3e7cb0"
        />
        <KpiCard
          label="Citation Rate"
          value={overview.metrics?.total_citations ?? "--"}
          sub="Own-domain citations found"
          spark={[22, 28, 34, 40]}
          color="#5fb98a"
        />
        <KpiCard
          label="Observations"
          value={overview.metrics?.total_observations ?? "--"}
          sub="Completed observations"
          color="#39a0a8"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Visibility Trend" level={2} className="lg:col-span-2">
          <div className="h-[320px]">
            <Sparkline
              data={[overview.metrics?.active_prompts ?? 0, overview.metrics?.total_observations ?? 0, overview.metrics?.total_citations ?? 0, overview.metrics?.brand_mentions ?? 0]}
              color="#3e7cb0"
              className="h-full w-full"
            />
          </div>
        </Panel>

        <Panel title="Engine Breakdown" level={2}>
          <div className="space-y-4">
            {engines.length ? engines.map((e) => {
              const rate = e.total_observations > 0 ? Math.round((e.citations ?? 0) / e.total_observations * 100) : 0;
              return (
                <div key={e.engine} className="flex items-center justify-between py-3 border-b border-line/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-chalk">{e.engine}</p>
                    <p className="text-xs text-mist-dim">{e.total_observations} observations</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-chalk">{rate}%</p>
                    <div className="w-full h-1 bg-surface-2 mt-1 overflow-hidden rounded">
                      <div className="h-full bg-iris" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                </div>
              );
            }) : [
              <div key="empty" className="flex items-center justify-center py-8 text-mist-dim">
                No engine data available
              </div>
            ]}
          </div>
        </Panel>
      </div>

      <Panel title="Prompt Tracking" level={2}>
        <EmptyState title="No tracked prompts" sub="Add prompts in Prompt Research to start tracking AI visibility." />
      </Panel>
    </div>
  );
}