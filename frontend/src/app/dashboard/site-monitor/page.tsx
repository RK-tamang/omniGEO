"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function SiteMonitorPage() {
  const { data } = useWorkspaceData();

  const changes = (data?.alerts ?? []).filter((a) => a.type === "site_change");
  const crawls = data?.crawls ?? [];

  const tiles = [
    { label: "Pages Monitored", value: `${crawls.length}`, tone: "text-chalk" },
    { label: "Changes Recorded", value: `${changes.length}`, tone: "text-gold" },
    { label: "Pages Fetched", value: `${crawls.filter((c) => c.status === "completed").length}`, tone: "text-mint" },
    { label: "Failed Fetches", value: `${crawls.filter((c) => c.status === "failed").length}`, tone: "text-coral" },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Website Change Monitoring" sub="Tracks content changes, new pages, deletions, and metadata updates on your site">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Scan Now</Button>
            <Button variant="secondary">Configure Rules</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
                <p className="text-sm text-mist">{t.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>

          {changes.length === 0 && crawls.length === 0 ? (
            <EmptyState
              title="Nothing monitored yet"
              sub="Run a scan and the pages it fetched are tracked here. When the engine spots a change on your site it raises an alert."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Change</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">URL</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((a) => (
                    <tr key={a.id} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">
                          {a.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-chalk truncate max-w-xs">{a.title}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{a.type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">
                        {a.createdAt
                          ? new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : "recently"}
                      </td>
                    </tr>
                  ))}
                  {crawls.map((c) => (
                    <tr key={c.id} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${
                            c.status === "completed"
                              ? "bg-mint/15 text-mint border-mint/30"
                              : "bg-coral/15 text-coral border-coral/30"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-chalk truncate max-w-xs">{c.url}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">crawl</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">
                        {c.completedAt
                          ? new Date(c.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
