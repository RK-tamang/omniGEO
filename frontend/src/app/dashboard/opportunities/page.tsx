"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel, StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function OpportunitiesPage() {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  useEffect(() => {
    api.getAuditRuns().then((res) => {
      if (res.ok) setOpportunities(res.data?.audits ?? res.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Opportunities"
        sub="Evidence-backed optimization opportunities prioritized by impact and effort"
        aside={<Button size="sm">Re-audit</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Open Opportunities" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{opportunities.length}</p>
            <p className="mt-2 text-xs text-mist-dim">Opportunities awaiting action</p>
          </div>
        </Panel>
        <Panel title="High Priority" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">Critical and high-severity fixes</p>
          </div>
        </Panel>
        <Panel title="Resolved" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">Resolved or ignored opportunities</p>
          </div>
        </Panel>
      </div>

      <Panel title="Prioritized Opportunities" level={2}>
        {opportunities.length === 0 ? (
          <EmptyState title="No opportunities" sub="Run a GEO audit to generate prioritized optimization opportunities." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                  <th className="pb-3 pr-4 font-normal">Opportunity</th>
                  <th className="pb-3 pr-4 font-normal">Severity</th>
                  <th className="pb-3 pr-4 font-normal">Affected Pages</th>
                  <th className="pb-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o, i) => (
                  <tr key={i} className="border-b border-line/70">
                    <td className="py-3 pr-4 truncate font-mono text-[0.68rem] text-chalk">{o.title || o.title || "Untitled"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{o.severity ?? "medium"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{o.pages_affected ?? 0}</td>
                    <td className="py-3"><StatusChip status="open" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Task Management" level={2}>
        <EmptyState title="No tasks" sub="Create optimization tasks from citation gaps or audit findings." />
      </Panel>
    </div>
  );
}