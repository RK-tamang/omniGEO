"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { mergeCompetitorMatrix } from "@/lib/workspace-data";
import type { WorkspaceData } from "@/hooks/use-workspace-data";

const cellStyles = {
  wins: "border-mint/40 bg-mint/10 text-mint",
  second: "border-gold/30 bg-gold/[0.07] text-gold",
  absent: "border-line bg-surface-1 text-mist-dim",
} as const;

const cellLabel = { wins: "1st", second: "top", absent: "—" } as const;

export function PromptMatrix({ data }: { data?: WorkspaceData | null }) {
  const [gapsOnly, setGapsOnly] = useState(false);

  // "1st" = the brand is cited, "top" = mentioned, "—" = absent. Every cell is
  // read from the workspace's own prompt and competitor rows.
  const { brands, rows: matrix } = mergeCompetitorMatrix(data ?? null);

  // "gap" = a prompt where the winner isn't you
  const rows = matrix.filter((p) => !gapsOnly || p.statuses[0] !== "wins");

  if (brands.length === 0 || matrix.length === 0) {
    return (
      <EmptyState
        title="No prompt results yet"
        sub="Track a prompt and each engine's answer is recorded here, alongside every rival you are compared against."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-full border border-line p-1" role="group" aria-label="Filter prompts">
          <button
            type="button"
            onClick={() => setGapsOnly(false)}
            aria-pressed={!gapsOnly}
            className={`rounded-full px-3 py-1 font-mono text-[0.62rem] transition-colors ${
              !gapsOnly ? "bg-iris/20 text-chalk" : "text-mist-dim hover:text-chalk"
            }`}
          >
            All prompts
          </button>
          <button
            type="button"
            onClick={() => setGapsOnly(true)}
            aria-pressed={gapsOnly}
            className={`rounded-full px-3 py-1 font-mono text-[0.62rem] transition-colors ${
              gapsOnly ? "bg-iris/20 text-chalk" : "text-mist-dim hover:text-chalk"
            }`}
          >
            Gaps only
          </button>
        </div>
        <p className="font-mono text-[0.6rem] text-mist-dim">
          {rows.length} prompt{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Prompt</th>
              {brands.map((b) => (
                <th key={b.name} className={`pb-3 pr-4 font-normal ${b.you ? "text-iris" : ""}`}>
                  {b.you ? `${b.name} (you)` : b.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.prompt} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                <td className="py-3 pr-4 text-chalk">{p.prompt}</td>
                {p.statuses.map((s, i) => (
                  <td key={i} className="py-3 pr-4">
                    <span
                      className={`inline-flex min-w-11 justify-center rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${cellStyles[s]}`}
                    >
                      {cellLabel[s]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={brands.length + 1} className="py-8 text-center text-sm text-mist-dim">
                  You win every tracked prompt. Add tougher ones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        “1st” = this brand gets the answer · “top” = cited in the response but not first · “—” = absent
      </p>
    </div>
  );
}
