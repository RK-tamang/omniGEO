"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function CompetitorAlertsPage() {
  const { data } = useWorkspaceData();

  const alerts = (data?.alerts ?? []).filter(
    (a) => a.type === "new_competitor" || a.type === "competitor_movement",
  );

  return (
    <div className="space-y-6">
      <Panel title="New Competitor Alerts" sub="Notified when new competitors appear in tracked answer spaces">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Configure Alerts</Button>
            <Button variant="secondary">View History</Button>
          </div>
          {alerts.length === 0 ? (
            <EmptyState
              title="No competitor alerts"
              sub="An alert fires when a brand starts appearing in the answer spaces you track. Every one raised for this workspace is listed here."
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 border-aqua flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-aqua/15 text-aqua border-aqua/30">
                      {a.severity}
                    </span>
                    <span className="font-medium text-chalk">{a.title}</span>
                  </div>
                  <span className="text-xs text-mist-dim">
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "recently"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
