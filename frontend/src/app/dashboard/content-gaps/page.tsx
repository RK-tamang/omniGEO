"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeContentGaps } from "@/lib/workspace-data";

export default function ContentGapsPage() {
  const { data } = useWorkspaceData();
  const gaps = mergeContentGaps(data);

  return (
    <div className="space-y-6">
      <Panel title="Content Gap Analyzer" sub="Identifies topics your site doesn't cover adequately vs. competitors">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Gaps</Button>
            <Button variant="secondary">Export Report</Button>
          </div>
          {gaps.length === 0 ? (
            <EmptyState
              title="No content gaps detected"
              sub="A gap appears when a competitor holds more citations than you do. Track competitors and the topics they out-cite you on are listed here."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Topic Gap</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Detail</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.gap} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">{g.gap}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{g.detail}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-medium ${g.impact === "High" ? "text-coral" : "text-gold"}`}
                        >
                          {g.impact}
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
