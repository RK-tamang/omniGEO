"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeContentItems } from "@/lib/workspace-data";

export default function ReadabilityPage() {
  const { data } = useWorkspaceData();
  const items = mergeContentItems(data);

  const avg = items.length ? Math.round(items.reduce((s, c) => s + c.score, 0) / items.length) : 0;
  const ready = items.filter((c) => c.score >= 80).length;

  const tiles = [
    { label: "Avg Readability", value: items.length ? `${avg}/100` : "—", tone: "text-chalk" },
    { label: "Pieces Analyzed", value: `${items.length}`, tone: "text-chalk" },
    { label: "Pass Rate", value: items.length ? `${Math.round((items.filter((c) => c.score >= 60).length / items.length) * 100)}%` : "—", tone: "text-chalk" },
    { label: "Citation-Ready", value: items.length ? `${Math.round((ready / items.length) * 100)}%` : "—", tone: "text-chalk" },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Content Readability Analyzer" sub="Checks clarity, structure, direct answers, and citation-ready formatting">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Analyze Readability</Button>
            <Button variant="secondary">Batch Check</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
                <p className="text-sm text-mist">{t.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Nothing analyzed yet"
              sub="Add content and each piece is scored for clarity, structure and citation-readiness. The scores are listed here."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Piece</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Words</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.title} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">{c.title}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-mist">{c.words}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono text-sm ${
                            c.score >= 80 ? "text-mint" : c.score >= 60 ? "text-gold" : "text-coral"
                          }`}
                        >
                          {c.score}
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
