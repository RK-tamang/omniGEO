"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { ENGINE_KEYS, ENGINE_LABELS } from "@/lib/dashboard-config";
import { mergePrompts } from "@/lib/workspace-data";

export default function BrandMentionsPage() {
  const { data } = useWorkspaceData();
  const prompts = mergePrompts(data);

  const rows = ENGINE_KEYS.map((key) => {
    const cited = prompts.filter((p) => p.engines[key] === "cited").length;
    const mentioned = prompts.filter((p) => p.engines[key] === "mentioned").length;
    const sentiments = prompts
      .filter((p) => p.engines[key] !== "missing")
      .map((p) => p.sentiment);
    const positive = sentiments.filter((s) => s === "Positive").length;
    const neutral = sentiments.filter((s) => s === "Neutral").length;
    const risk = sentiments.filter((s) => s === "Risk").length;
    const total = sentiments.length || 1;

    return {
      key,
      engine: ENGINE_LABELS[key],
      cited,
      mentions: cited + mentioned,
      sentiment:
        positive >= total / 2 ? "Positive" : risk >= total / 2 ? "Risk" : "Neutral",
      seen: prompts.some((p) => p.engines[key] !== "missing") ? "tracked" : "never",
    };
  }).filter((r) => r.mentions > 0);

  return (
    <div className="space-y-6">
      <Panel title="Brand Mention Monitor" sub="Find direct and indirect brand mentions across all AI answer engines">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Run Mention Scan</Button>
            <Button variant="secondary">Configure Alerts</Button>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title="No mentions recorded yet"
              sub="Mentions are written when a visibility scan checks your tracked prompts against each engine."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Engine</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Mentions</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Sentiment</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk">{r.engine}</td>
                      <td className="px-4 py-3 text-center text-sm text-chalk">{r.cited}</td>
                      <td className="px-4 py-3 text-center text-sm text-chalk">{r.mentions}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-medium ${
                            r.sentiment === "Positive"
                              ? "text-mint"
                              : r.sentiment === "Risk"
                                ? "text-coral"
                                : "text-gold"
                          }`}
                        >
                          {r.sentiment}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{r.seen}</td>
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
