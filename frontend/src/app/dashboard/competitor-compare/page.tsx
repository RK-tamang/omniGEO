"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeCompetitorMatrix } from "@/lib/workspace-data";

const cellStyles = {
  wins: "border-mint/30 bg-mint/15 text-mint",
  second: "border-aqua/30 bg-aqua/15 text-aqua",
  absent: "border-coral/30 bg-coral/15 text-coral",
} as const;

const cellLabel = { wins: "cited", second: "mentioned", absent: "missing" } as const;

export default function CompetitorComparePage() {
  const { data } = useWorkspaceData();
  const { brands, rows } = mergeCompetitorMatrix(data);

  return (
    <div className="space-y-6">
      <Panel title="AI Recommendation Compare" sub="Compares which brands appear for the same prompts — side-by-side visibility">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Comparison</Button>
            <Button variant="secondary">Add Competitors</Button>
          </div>

          {rows.length === 0 || brands.length === 0 ? (
            <EmptyState
              title="Nothing to compare yet"
              sub="The comparison reads the tracked prompts and the per-competitor results the engine records for them."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Prompt</th>
                    {brands.map((b) => (
                      <th key={b.name} className="px-4 py-3 text-center text-sm font-medium text-mist">
                        {b.you ? `${b.name} (you)` : b.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.prompt} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{row.prompt}</td>
                      {row.statuses.map((s, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${cellStyles[s]}`}
                          >
                            {cellLabel[s]}
                          </span>
                        </td>
                      ))}
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
