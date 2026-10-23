"use client";

import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeContentItems } from "@/lib/workspace-data";

export default function QualityScoringPage() {
  const { data } = useWorkspaceData();
  const items = mergeContentItems(data);

  const avg = items.length ? Math.round(items.reduce((s, c) => s + c.score, 0) / items.length) : 0;
  const ready = items.filter((c) => c.score >= 80).length;

  const tiles = [
    { label: "Avg Quality Score", value: items.length ? `${avg}/100` : "—", tone: "text-chalk" },
    { label: "Pieces Scored", value: `${items.length}`, tone: "text-chalk" },
    { label: "Citation-Ready", value: items.length ? `${Math.round((ready / items.length) * 100)}%` : "—", tone: "text-chalk" },
    { label: "Ready Pieces", value: `${ready}`, tone: "text-chalk" },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Content Quality Scoring" sub="Scores content on citation-readiness, entity coverage, structure, and claim specificity">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Score Content</Button>
            <Button variant="secondary">Batch Score</Button>
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
              title="Nothing scored yet"
              sub="Generate or import content and each piece is scored for citation-readiness. The scores are listed here."
            />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-1 border-b border-line">
                    <th className="px-4 py-3 text-left text-sm font-medium text-mist">Piece</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Target prompt</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-mist">Total Score</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.title} className="border-b border-line/50 hover:bg-surface-1">
                      <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">{c.title}</td>
                      <td className="px-4 py-3 text-center text-sm text-mist">{c.target || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono font-bold text-lg ${
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
