"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeCompetitors } from "@/lib/workspace-data";

export default function CompetitorMovementPage() {
  const { data } = useWorkspaceData();
  const competitors = mergeCompetitors(data);

  return (
    <div className="space-y-6">
      <Panel title="Competitor Movement Tracker" sub="Monitors visibility changes over time — spot rising/falling competitors">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Analysis</Button>
            <Button variant="secondary">Set Alerts</Button>
          </div>

          {competitors.length === 0 ? (
            <EmptyState
              title="No competitors to track yet"
              sub="Movement is measured between visibility checks, so it appears once a competitor has been checked at least twice."
            />
          ) : (
            <>
              <div className="h-64 flex items-end justify-between gap-3 px-2 pb-2">
                {competitors.map((c) => (
                  <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="flex-1 w-full rounded-t transition-colors bg-mist-dim"
                      style={{ height: `${Math.max(2, Math.min(100, c.visibility))}%` }}
                      title={`${c.name}: ${c.visibility}%`}
                    />
                    <span className="text-xs text-mist-dim text-center w-20 truncate">{c.name}</span>
                    <span className="font-mono text-sm text-chalk">{c.visibility}%</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm text-mist mt-4">
                <span>{competitors.length} competitor{competitors.length === 1 ? "" : "s"} tracked</span>
                <span className="text-chalk font-medium">
                  Last checked {competitors[0]?.lastChecked ?? "—"}
                </span>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
