"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function CitationAlertsPage() {
  const { data } = useWorkspaceData();

  const alerts = (data?.alerts ?? []).filter(
    (a) => a.type === "citation_lost" || a.type === "citation_gained",
  );

  const tone = (severity: string) =>
    severity === "Critical" ? "border-coral" : severity === "Warning" ? "border-gold" : "border-aqua";

  const chip = (severity: string) =>
    severity === "Critical"
      ? "bg-coral/15 text-coral border-coral/30"
      : severity === "Warning"
        ? "bg-gold/15 text-gold border-gold/30"
        : "bg-aqua/15 text-aqua border-aqua/30";

  return (
    <div className="space-y-6">
      <Panel title="Citation Loss Alerts" sub="Immediate notification when you lose a citation to a competitor">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Configure Alerts</Button>
            <Button variant="secondary">View History</Button>
          </div>
          {alerts.length === 0 ? (
            <EmptyState
              title="No citation alerts"
              sub="A citation alert fires the moment a page stops being cited in an answer. Every one raised for this workspace is listed here."
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border-l-4 ${tone(a.severity)} flex items-center justify-between`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${chip(a.severity)}`}
                    >
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
