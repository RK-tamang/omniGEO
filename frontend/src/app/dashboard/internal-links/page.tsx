"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function InternalLinksPage() {
  const { data } = useWorkspaceData();

  // Link counts come from the crawls the engine recorded.
  const crawls = (data?.crawls ?? []).map((c) => ({
    id: c.id,
    url: c.url,
    links: Array.isArray(c.result?.links) ? c.result.links.length : 0,
    status: c.status,
  }));

  const totalLinks = crawls.reduce((s, c) => s + c.links, 0);
  const avgLinks = crawls.length ? (totalLinks / crawls.length).toFixed(1) : "—";

  const tiles = [
    { label: "Pages Crawled", value: `${crawls.length}`, tone: "text-chalk" },
    { label: "Total Links Found", value: `${totalLinks}`, tone: "text-chalk" },
    { label: "Avg Links/Page", value: `${avgLinks}`, tone: "text-chalk" },
    { label: "Orphan Pages", value: "—", tone: "text-mist-dim" },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Internal Linking Analyzer" sub="Identifies relevant internal linking gaps and orphan pages">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Links</Button>
            <Button variant="secondary">Find Orphans</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
                <p className="text-sm text-mist">{t.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>

          {crawls.length === 0 ? (
            <EmptyState
              title="No pages crawled yet"
              sub="Run a crawl and every page it fetched is listed here with the links it contains. Orphan detection needs a full site crawl."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Page</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Links</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {crawls.map((c) => (
                    <tr key={c.id} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">{c.url}</td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{c.links}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{c.status}</td>
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
