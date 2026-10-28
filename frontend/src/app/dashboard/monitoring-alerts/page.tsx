"use client";

import { useEffect, useState } from "react";
import { DashboardHeader, Panel, StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function MonitoringAlertsPage() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    api.getSchedules().then((res) => {
      if (res.ok) setSchedules(res.data?.schedules ?? res.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Monitoring & Alerts"
        sub="Scheduled scans, scheduled GEO audits, and change notifications"
        aside={<Button size="sm">Add Schedule</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Active Schedules" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">{schedules.length}</p>
            <p className="mt-2 text-xs text-mist-dim">Recurring scans and audits</p>
          </div>
        </Panel>
        <Panel title="Active Alerts" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">Unacknowledged alerts</p>
          </div>
        </Panel>
        <Panel title="Job Failures" level={2}>
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="font-mono text-4xl font-normal italic text-chalk">0</p>
            <p className="mt-2 text-xs text-mist-dim">Failed background jobs</p>
          </div>
        </Panel>
      </div>

      <Panel title="Scan Schedules" level={2}>
        {schedules.length === 0 ? (
          <EmptyState title="No schedules" sub="Set up recurring visibility scans or GEO audits." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                  <th className="pb-3 pr-4 font-normal">Schedule</th>
                  <th className="pb-3 pr-4 font-normal">Frequency</th>
                  <th className="pb-3 pr-4 font-normal">Status</th>
                  <th className="pb-3 font-normal">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s, i) => (
                  <tr key={i} className="border-b border-line/70">
                    <td className="py-3 pr-4 font-mono text-[0.68rem] text-chalk">{s.name || s.title || "Untitled"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-mist-dim">{s.frequency ?? "daily"}</td>
                    <td className="py-3 pr-4"><StatusChip status={s.status === "active" ? "published" : "pending"} /></td>
                    <td className="py-3 font-mono text-xs text-mist-dim">{s.last_run ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Alert History" level={2}>
        <EmptyState title="No alerts" sub="Alerts appear when monitored metrics change beyond thresholds." />
      </Panel>
    </div>
  );
}