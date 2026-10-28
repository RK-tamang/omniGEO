"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel, StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function GeoAuditPage() {
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<any[]>([]);

  useEffect(() => {
    api.getAuditRuns().then((res) => {
      if (res.ok) setAudits(res.data?.audits ?? res.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="GEO Website Audit"
        sub="Run comprehensive GEO audits using crawler snapshots and evidence-backed rules"
        aside={<Button size="sm">Start GEO Audit</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Readiness Score" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{audits[0]?.score ?? "--"}</p>
            <p className="mt-2 text-xs text-mist-dim">Overall GEO readiness (0-100)</p>
          </div>
        </Panel>
        <Panel title="Category Scores" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{audits[0]?.categories?.length ?? 0}</p>
            <p className="mt-2 text-xs text-mist-dim">Category breakdown available</p>
          </div>
        </Panel>
        <Panel title="Critical Issues" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{audits[0]?.issues_found ?? 0}</p>
            <p className="mt-2 text-xs text-mist-dim">Critical findings requiring action</p>
          </div>
        </Panel>
      </div>

      <Panel title="Audit History" level={2}>
        {audits.length === 0 ? (
          <EmptyState title="No audits" sub="Run a GEO audit to see historical results and trends." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                  <th className="pb-3 pr-4 font-normal">Domain</th>
                  <th className="pb-3 pr-4 font-normal">Score</th>
                  <th className="pb-3 pr-4 font-normal">Status</th>
                  <th className="pb-3 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a, i) => (
                  <tr key={i} className="border-b border-line/70">
                    <td className="py-3 pr-4 font-mono text-[0.68rem] text-chalk">{a.domain || a.root_url || "—"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-chalk">{a.score ?? "—"}</td>
                    <td className="py-3 pr-4"><StatusChip status={a.status === "completed" ? "published" : "pending"} /></td>
                    <td className="py-3 font-mono text-xs text-mist-dim">{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Recent Findings" level={2}>
        <EmptyState title="No findings" sub="Audit findings appear here after a completed website audit." />
      </Panel>
    </div>
  );
}