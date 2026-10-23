"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeCitations } from "@/lib/workspace-data";

export default function CompetitorCitationsPage() {
  const { data } = useWorkspaceData();
  const citations = mergeCitations(data);

  const byDomain = new Map<string, { domain: string; count: number; prompts: Set<string>; top: string }>();
  for (const c of citations) {
    const entry = byDomain.get(c.domain) ?? { domain: c.domain, count: 0, prompts: new Set<string>(), top: c.url };
    entry.count += 1;
    entry.prompts.add(c.prompt);
    byDomain.set(c.domain, entry);
  }
  const rows = [...byDomain.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <Panel title="Citation Source Explorer" sub="Shows websites and pages frequently cited in tracked answers — build your link strategy">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Explore Sources</Button>
            <Button variant="secondary">Export Sources</Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No cited sources yet"
              sub="Every source the engines cite is recorded against the prompt that surfaced it, and listed here."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Source Domain</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Prompts</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Top Page</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.domain} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{r.domain}</td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{r.count}</td>
                      <td className="px-4 py-3 text-center font-mono text-chalk">{r.prompts.size}</td>
                      <td className="px-4 py-3 text-sm text-mist truncate max-w-xs">{r.top}</td>
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
