"use client";

import { useMemo, useState } from "react";
import { AreaChart } from "@/components/dashboard/charts";
import { EmptyState } from "@/components/ui/empty-state";
import type { Series } from "@/lib/dashboard-config";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
] as const;

export function VisibilityTrend({
  series: allSeries,
  labels: allLabels,
}: {
  series: Series[];
  labels: string[];
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["days"]>(30);

  const { series, labels } = useMemo(() => {
    const start = Math.max(0, allLabels.length - range);
    return {
      series: allSeries.map((s) => ({ ...s, data: s.data.slice(start) })),
      labels: allLabels.slice(start),
    };
  }, [allSeries, allLabels, range]);

  if (allSeries.length === 0 || allLabels.length === 0) {
    return (
      <EmptyState
        title="No visibility history yet"
        sub="Run a visibility scan and every run from here on is charted, per engine, so you can see the direction of travel."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-chalk">Mention rate over time</h2>
          <p className="mt-1 text-xs text-mist-dim">% of tracked prompts where your brand appears in the answer</p>
        </div>
        <div className="flex gap-1 rounded-full border border-line p-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r.days)}
              aria-pressed={range === r.days}
              className={`rounded-full px-2.5 py-1 font-mono text-[0.62rem] transition-colors ${
                range === r.days ? "bg-iris/20 text-chalk" : "text-mist-dim hover:text-chalk"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <AreaChart series={series} labels={labels} />
    </div>
  );
}
