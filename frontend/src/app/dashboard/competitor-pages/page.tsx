"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeCompetitors } from "@/lib/workspace-data";

export default function CompetitorPagesPage() {
  const { data } = useWorkspaceData();
  const competitors = mergeCompetitors(data);

  // The pages a competitor is cited on come from the citation URLs the engine
  // recorded against that competitor's prompt results.
  const pagesByCompetitor = new Map<string, string[]>();
  for (const cp of data?.competitorPrompts ?? []) {
    if (!cp.citationUrl) continue;
    const list = pagesByCompetitor.get(cp.competitorId) ?? [];
    if (!list.includes(cp.citationUrl)) list.push(cp.citationUrl);
    pagesByCompetitor.set(cp.competitorId, list);
  }

  const rows = competitors.map((c) => {
    const urls = pagesByCompetitor.get(c.id) ?? [];
    return {
      ...c,
      pages: urls.length,
      top: urls[0] ?? "",
    };
  });

  return (
    <div className="space-y-6">
      <Panel title="Competitor Page Analyzer" sub="Analyzes specific pages associated with competitor mentions — reverse-engineer their strategy">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Pages</Button>
            <Button variant="secondary">Add URL</Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No competitor pages yet"
              sub="Pages appear here when a scan records the URL a competitor was cited from."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Competitor</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Pages Cited</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Top Page</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Domain</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{r.name}</td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{r.pages}</td>
                      <td className="px-4 py-3 text-center text-sm text-chalk truncate max-w-xs">{r.top || "—"}</td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{r.citations}</td>
                      <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">{r.domain || "—"}</td>
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
