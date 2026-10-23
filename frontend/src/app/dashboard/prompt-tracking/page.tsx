"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { ENGINE_KEYS, ENGINE_LABELS } from "@/lib/dashboard-config";
import { mergePrompts } from "@/lib/workspace-data";

export default function PromptTrackingPage() {
  const { data } = useWorkspaceData();
  const prompts = mergePrompts(data);

  return (
    <div className="space-y-6">
      <Panel title="Prompt Tracking" sub="Monitor a saved set of prompts over time — daily/weekly visibility trends">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Add Prompts to Track</Button>
            <Button variant="secondary">Import from CSV</Button>
          </div>

          {prompts.length === 0 ? (
            <EmptyState
              title="No prompts tracked yet"
              sub="Add the questions your buyers ask AI and each one is checked against every engine on every run."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Prompt</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Type</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Engines</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Last checked</th>
                  </tr>
                </thead>
                <tbody>
                  {prompts.map((p) => {
                    const answered = ENGINE_KEYS.filter((k) => p.engines[k] !== "missing").length;
                    const cited = ENGINE_KEYS.filter((k) => p.engines[k] === "cited").length;
                    return (
                      <tr key={p.prompt} className="border-b border-line/50 hover:bg-surface-1">
                        <td className="px-4 py-3 font-medium text-chalk">{p.prompt}</td>
                        <td className="px-4 py-3 text-center text-sm text-mist">{p.type}</td>
                        <td className="px-4 py-3 text-center text-sm text-mist">
                          {answered}/{ENGINE_KEYS.length}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-sm font-medium ${
                              cited > 0 ? "text-mint" : answered > 0 ? "text-gold" : "text-mist-dim"
                            }`}
                          >
                            {cited > 0 ? "cited" : answered > 0 ? "mentioned" : "missing"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-mist">
                          {p.sentiment === "Risk" ? "needs work" : "tracked"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
