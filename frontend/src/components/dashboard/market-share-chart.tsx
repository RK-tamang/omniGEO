"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeShareOfVoice } from "@/lib/workspace-data";

const COLORS = ["bg-iris", "bg-aqua", "bg-gold", "bg-coral", "bg-mint", "bg-mist"];

/**
 * Market share across the brands this workspace tracks.
 *
 * Your bar is the share of tracked prompts you appear in; each rival's bar is
 * the visibility score the engine recorded for them.
 */
export function MarketShareChart() {
  const { data } = useWorkspaceData();
  const rows = mergeShareOfVoice(data);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No brands to compare yet"
        sub="Add the competitors you are measured against and this chart shows who takes the answers."
      />
    );
  }

  const prompts = data?.prompts?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="h-64 flex items-end justify-between gap-3 px-2 pb-2">
        {rows.map((item, i) => (
          <div key={item.name} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`flex-1 w-full rounded-t transition-colors ${item.you ? "bg-iris" : (COLORS[i % COLORS.length] ?? "bg-mist")}`}
              style={{ height: `${Math.max(2, Math.min(100, item.value))}%` }}
              title={`${item.name}: ${item.value}%`}
            />
            <span className="text-xs text-mist-dim text-center w-20 truncate">{item.name}</span>
            <span className="font-mono text-sm text-chalk">{item.value}%</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm text-mist">
        <span>Across {prompts} tracked prompt{prompts === 1 ? "" : "s"}</span>
        <span className="text-chalk font-medium">Your share: {rows[0]?.value ?? 0}%</span>
      </div>
    </div>
  );
}
