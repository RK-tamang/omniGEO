"use client";

import { useMemo, useState } from "react";
import { AreaChart } from "@/components/dashboard/charts";
import { days, visibilitySeries } from "@/lib/dashboard-data";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
] as const;

export function VisibilityTrend() {
  const [range, setRange] = useState<(typeof RANGES)[number]["days"]>(30);

  const { series, labels } = useMemo(() => {
    const start = days.length - range;
    return {
      series: visibilitySeries.map((s) => ({ ...s, data: s.data.slice(start) })),
      labels: days.slice(start),
    };
  }, [range]);

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
