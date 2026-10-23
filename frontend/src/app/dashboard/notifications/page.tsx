"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function NotificationsPage() {
  const { data } = useWorkspaceData();
  const settings = data?.workspace?.settings ?? null;

  const channels = [
    {
      id: "email",
      label: "Email",
      detail: settings?.emailDigest ? `Digest — ${settings.digest ?? "Weekly"}` : "Digest off",
      active: Boolean(settings?.emailDigest),
    },
    {
      id: "critical",
      label: "Critical alerts",
      detail: settings?.criticalAlerts ? "Sent immediately" : "Off",
      active: Boolean(settings?.criticalAlerts),
    },
  ];

  const webhooks = data?.webhooks ?? [];

  return (
    <div className="space-y-6">
      <Panel title="Email & Integration Notifications" sub="Slack, email, webhook integrations for real-time alert delivery">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Add Integration</Button>
            <Button variant="secondary">Test All</Button>
          </div>

          <div className="space-y-3">
            {channels.map((c) => (
              <div
                key={c.id}
                className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-iris/15 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" stroke="#3e7cb0" strokeWidth="1.6" strokeLinecap="round"/><path d="M22 6l-10 10L4 10" stroke="#3e7cb0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div>
                    <span className="font-medium text-chalk">{c.label}</span>
                    <p className="text-xs text-mist-dim">{c.detail}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${
                    c.active
                      ? "bg-mint/15 text-mint border-mint/30"
                      : "bg-mist/15 text-mist border-mist/30"
                  }`}
                >
                  {c.active ? "Active" : "Off"}
                </span>
              </div>
            ))}

            {webhooks.map((w) => (
              <div
                key={w.id}
                className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-coral/15 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="#dc6e72" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><polyline points="15 7 10 12 5 7" stroke="#dc6e72" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div>
                    <span className="font-medium text-chalk">Webhook</span>
                    <p className="text-xs text-mist-dim truncate max-w-xs">{w.url}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${
                    w.active
                      ? "bg-mint/15 text-mint border-mint/30"
                      : "bg-mist/15 text-mist border-mist/30"
                  }`}
                >
                  {w.active ? "Active" : "Paused"}
                </span>
              </div>
            ))}

            {webhooks.length === 0 && (
              <EmptyState
                title="No webhooks connected"
                sub="Add a webhook endpoint and the workspace posts every alert to it. The ones you have registered are listed here."
              />
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
