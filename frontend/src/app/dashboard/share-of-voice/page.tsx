"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel, StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function CompetitorsPage() {
  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState<any[]>([]);

  useEffect(() => {
    api.getCompetitors().then((res) => {
      if (res.ok) setCompetitors(res.data?.competitors ?? res.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Competitors"
        sub="Compare AI visibility, citations, and share of voice against competitors"
        aside={<Button size="sm">Add Competitor</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Competitors Tracked" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{competitors.length}</p>
            <p className="mt-2 text-xs text-mist-dim">Competitor profiles</p>
          </div>
        </Panel>
        <Panel title="Share of Voice" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">--%</p>
            <p className="mt-2 text-xs text-mist-dim">Your share vs competitors</p>
          </div>
        </Panel>
        <Panel title="Citation Gaps" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">Prompts where competitors lead</p>
          </div>
        </Panel>
      </div>

      <Panel title="Competitor Comparison" level={2}>
        {competitors.length === 0 ? (
          <EmptyState title="No competitor data" sub="Add competitors and run visibility scans to compare share of voice." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                  <th className="pb-3 pr-4 font-normal">Competitor</th>
                  <th className="pb-3 pr-4 font-normal">Visibility</th>
                  <th className="pb-3 pr-4 font-normal">Citations</th>
                  <th className="pb-3 font-normal">Share of Voice</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c, i) => (
                  <tr key={i} className="border-b border-line/70">
                    <td className="py-3 pr-4 font-mono text-[0.68rem] text-chalk">{c.name || c.competitor || "Unknown"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{c.visibility ?? "—"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{c.citations ?? 0}</td>
                    <td className="py-3 font-mono text-xs text-mist-dim">{c.share_of_voice ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Competitor Citation Gaps" level={2}>
        <EmptyState title="No gaps found" sub="Citation gaps appear when competitors are cited but your domain is not." />
      </Panel>
    </div>
  );
}