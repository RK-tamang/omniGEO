"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function MentionAlertsPage() {
  const { data } = useWorkspaceData();

  const alerts = (data?.alerts ?? []).filter(
    (a) => a.type === "citation_lost" || a.type === "citation_gained" || a.type === "visibility_drop",
  );

  const tone = (severity: string) =>
    severity === "Critical" ? "border-coral" : severity === "Warning" ? "border-gold" : "border-iris";

  const chip = (severity: string) =>
    severity === "Critical"
      ? "bg-coral/15 text-coral border-coral/30"
      : severity === "Warning"
        ? "bg-gold/15 text-gold border-gold/30"
        : "bg-iris/15 text-iris border-iris/30";

  return (
    <div className="space-y-6">
      <Panel title="Brand Mention Alerts" sub="Real-time alerts when your brand is mentioned (or stops being mentioned) in AI answers">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Create Alert</Button>
            <Button variant="secondary">Manage Rules</Button>
          </div>

          {alerts.length === 0 ? (
            <EmptyState
              title="No mention alerts"
              sub="An alert fires when a mention is gained or lost, or when your visibility drops. Every one raised for this workspace is listed here."
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
