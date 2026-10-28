"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function ReportsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    api.getReports().then((res) => {
      if (res.ok) setReports(res.data?.reports ?? res.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Reports & Analytics"
        sub="Generate and export GEO audit, visibility, citation, and competitor reports"
        aside={<Button size="sm">Create Report</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Reports Generated" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{reports.length}</p>
            <p className="mt-2 text-xs text-mist-dim">Reports in history</p>
          </div>
        </Panel>
        <Panel title="Exports" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">CSV, JSON, and PDF downloads</p>
          </div>
        </Panel>
        <Panel title="Last Generated" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">--</p>
            <p className="mt-2 text-xs text-mist-dim">Most recent report date</p>
          </div>
        </Panel>
      </div>

      <Panel title="Report History" level={2}>
        {reports.length === 0 ? (
          <EmptyState title="No reports" sub="Generate reports from audit and visibility data." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                  <th className="pb-3 pr-4 font-normal">Report</th>
                  <th className="pb-3 pr-4 font-normal">Type</th>
                  <th className="pb-3 pr-4 font-normal">Status</th>
                  <th className="pb-3 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={i} className="border-b border-line/70">
                    <td className="py-3 pr-4 truncate font-mono text-[0.68rem] text-chalk">{r.name || r.title || "Untitled"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{r.type ?? "geo-audit"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{r.status ?? "completed"}</td>
                    <td className="py-3 font-mono text-xs text-mist-dim">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Quick Export" level={2}>
        <div className="space-y-4">
          <p className="text-xs font-mono text-mist-dim uppercase tracking-widest">Select report type</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">GEO Audit Report</Button>
            <Button variant="outline" size="sm">Visibility Report</Button>
            <Button variant="outline" size="sm">Citation Report</Button>
            <Button variant="outline" size="sm">Competitor Report</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}