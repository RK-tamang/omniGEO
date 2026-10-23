"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export default function CrawlerPage() {
  const { data } = useWorkspaceData();

  const domains = data?.domains ?? [];
  const crawls = (data?.crawls ?? []).slice().sort((a, b) => {
    const at = (v: string | number | null | undefined) =>
      typeof v === "number" ? v : Date.parse(String(v ?? 0)) || 0;
    return at(b.completedAt ?? b.createdAt) - at(a.completedAt ?? a.createdAt);
  });

  return (
    <div className="space-y-6">
      <Panel title="Website Crawler" sub="Discover URLs and analyze pages — JavaScript rendering, content extraction">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Start Crawl</Button>
            <Button variant="secondary">Schedule Crawl</Button>
          </div>

          {crawls.length === 0 ? (
            <EmptyState
              title="Nothing crawled yet"
              sub="Start a crawl and every page the engine fetched is listed here with its status, page count and credits used."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">URL</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Pages</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  {crawls.map((c) => (
                    <tr key={c.id} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">{c.url}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${
                            c.status === "completed"
                              ? "bg-mint/15 text-mint border-mint/30"
                              : c.status === "failed"
                                ? "bg-coral/15 text-coral border-coral/30"
                                : "bg-gold/15 text-gold border-gold/30"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{c.pagesCrawled ?? 0}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist truncate max-w-xs">
                        {c.result?.title || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-mist">
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

          {domains.length > 0 && (
            <p className="text-xs text-mist-dim">
              Tracked domains: {domains.map((d) => d.domain).join(", ")}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
