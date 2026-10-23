"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { ENGINE_LABELS, type EngineKey } from "@/lib/dashboard-config";

export default function PromptGapsPage() {
  const { data } = useWorkspaceData();

  // A gap is a prompt a competitor is cited for where you are not.
  const promptById = new Map((data?.prompts ?? []).map((p) => [p.id, p]));
  const competitorById = new Map((data?.competitors ?? []).map((c) => [c.id, c.name]));

  const gaps = (data?.competitorPrompts ?? [])
    .filter((cp) => cp.status === "cited")
    .map((cp) => {
      const prompt = promptById.get(cp.promptId);
      const own = prompt?.engines?.[cp.engine as EngineKey];
      return {
        id: cp.id,
        prompt: prompt?.prompt ?? "—",
        competitor: competitorById.get(cp.competitorId) ?? "—",
        engine: ENGINE_LABELS[cp.engine as EngineKey] ?? cp.engine,
        youWin: own === "cited",
      };
    })
    .filter((g) => !g.youWin);

  return (
    <div className="space-y-6">
      <Panel title="Competitor Prompt Gap Finder" sub="Identifies questions competitors win that you don't — your content opportunities">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Find Gaps</Button>
            <Button variant="secondary">Export Opportunities</Button>
          </div>

          {gaps.length === 0 ? (
            <EmptyState
              title="No prompt gaps found"
              sub="A gap is a prompt a competitor was cited for and you were not. It appears here once both results have been recorded for the same prompt."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Prompt Gap</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Competitor</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Engine</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.id} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">{g.prompt}</td>
                      <td className="px-4 py-3 text-center text-sm text-chalk">{g.competitor}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{g.engine}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">
                          gap
                        </span>
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
