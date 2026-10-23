"use client";

import { useMemo, useState } from "react";
import { ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import type { ContentItem } from "@/lib/dashboard-config";

const STATUSES = ["All", "Published", "In review", "Draft"] as const;

export function ContentTable({ items }: { items: ContentItem[] }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const source = items;

  const rows = useMemo(
    () => source.filter((c) => status === "All" || c.status === status),
    [source, status],
  );

  if (source.length === 0) {
    return (
      <EmptyState
        title="No content tracked yet"
        sub="Generate a draft from the Content Studio and it will appear here with its citation-readiness score."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              status === s ? "border-iris/50 bg-iris/15 text-chalk" : "border-line text-mist hover:text-chalk"
            }`}
          >
            {s}
            <span className="ml-1.5 font-mono text-[0.6rem] text-mist-dim">
              {s === "All" ? source.length : source.filter((c) => c.status === s).length}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Piece</th>
              <th className="pb-3 pr-4 font-normal">Status</th>
              <th className="pb-3 pr-4 font-normal">Score</th>
              <th className="pb-3 pr-4 font-normal">Target prompt</th>
              <th className="pb-3 pr-4 font-normal">Words</th>
              <th className="pb-3 font-normal">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.title} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                <td className="max-w-72 py-3 pr-4 text-chalk">{c.title}</td>
                <td className="py-3 pr-4">
                  <StatusChip status={c.status} />
                </td>
                <td className="py-3 pr-4">
                  <ScoreBar score={c.score} />
                </td>
                <td className="py-3 pr-4 font-mono text-[0.68rem] text-mist-dim">{c.target}</td>
                <td className="py-3 pr-4 font-mono text-xs text-mist">{c.words.toLocaleString("en-GB")}</td>
                <td className="py-3 text-xs text-mist-dim">{c.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        {rows.length} of {source.length} pieces · score = citation-readiness (sources, structure, clarity)
      </p>
    </div>
  );
}
