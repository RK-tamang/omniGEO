"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { ENGINE_KEYS, ENGINE_LABELS } from "@/lib/dashboard-config";
import { mergePrompts } from "@/lib/workspace-data";

export default function SentimentPage() {
  const { data } = useWorkspaceData();
  const prompts = mergePrompts(data);

  const classified = prompts.flatMap((p) =>
    Object.values(p.engines)
      .filter((s) => s !== "missing")
      .map(() => p.sentiment),
  );

  const total = classified.length;
  const positive = classified.filter((s) => s === "Positive").length;
  const neutral = classified.filter((s) => s === "Neutral").length;
  const negative = classified.filter((s) => s === "Risk").length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const perEngine = ENGINE_KEYS.map((key) => {
    const rows = prompts.filter((p) => p.engines[key] !== "missing");
    const n = rows.length || 1;
    return {
      key,
      engine: ENGINE_LABELS[key],
      positive: Math.round((rows.filter((p) => p.sentiment === "Positive").length / n) * 100),
      neutral: Math.round((rows.filter((p) => p.sentiment === "Neutral").length / n) * 100),
      negative: Math.round((rows.filter((p) => p.sentiment === "Risk").length / n) * 100),
    };
  }).filter((r) => prompts.some((p) => p.engines[r.key] !== "missing"));

  return (
    <div className="space-y-6">
      <Panel title="Sentiment Analyzer" sub="Classify positive, neutral, and negative brand mentions in AI answers">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Sentiment</Button>
            <Button variant="secondary">View Trends</Button>
          </div>

          {total === 0 ? (
            <EmptyState
              title="Nothing to classify yet"
              sub="Sentiment is read from the prompt results a visibility scan records. Run one and this fills in."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-mint/15 border border-mint/30 rounded-2xl p-5 text-center">
                  <p className="text-sm text-mint">Positive</p>
                  <p className="mt-2 text-3xl font-semibold text-mint">{pct(positive)}%</p>
                  <p className="mt-1 text-xs text-mint-dim">{positive} of {total} mentions</p>
                </div>
                <div className="bg-gold/15 border border-gold/30 rounded-2xl p-5 text-center">
                  <p className="text-sm text-gold">Neutral</p>
                  <p className="mt-2 text-3xl font-semibold text-gold">{pct(neutral)}%</p>
                  <p className="mt-1 text-xs text-gold-dim">{neutral} of {total} mentions</p>
                </div>
                <div className="bg-coral/15 border border-coral/30 rounded-2xl p-5 text-center">
                  <p className="text-sm text-coral">Negative</p>
                  <p className="mt-2 text-3xl font-semibold text-coral">{pct(negative)}%</p>
                  <p className="mt-1 text-xs text-coral-dim">{negative} of {total} mentions</p>
                </div>
              </div>

              <div className="rounded-xl border border-line overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-1 border-b border-line">
                      <th className="px-4 py-3 text-left text-sm font-medium text-mist">Engine</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-mist">Positive</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-mist">Neutral</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-mist">Negative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perEngine.map((r) => (
                      <tr key={r.key} className="border-b border-line/50 hover:bg-surface-1">
                        <td className="px-4 py-3 font-medium text-chalk">{r.engine}</td>
                        <td className="px-4 py-3 text-center"><span className="text-mint text-sm font-medium">{r.positive}%</span></td>
                        <td className="px-4 py-3 text-center"><span className="text-gold text-sm font-medium">{r.neutral}%</span></td>
                        <td className="px-4 py-3 text-center"><span className="text-coral text-sm font-medium">{r.negative}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
