"use client";

import { useMemo, useState } from "react";
import { StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ENGINE_KEYS, ENGINE_LABELS, type EngineStatus, type PromptRow } from "@/lib/dashboard-config";

const TYPES = ["All", "Category", "Comparison", "Problem", "Brand"] as const;
const STATUSES: ("All" | EngineStatus)[] = ["All", "cited", "mentioned", "missing"];

export function PromptsTable({ prompts }: { prompts: PromptRow[] }) {
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (type !== "All" && p.type !== type) return false;
      if (status !== "All" && !ENGINE_KEYS.some((k) => p.engines[k] === status)) return false;
      if (q && !p.prompt.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prompts, type, status, query]);

  if (prompts.length === 0) {
    return (
      <EmptyState
        title="No prompts tracked yet"
        sub="Add the questions your buyers ask AI and each one gets checked against every engine on every run."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by prompt type">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                type === t ? "border-iris/50 bg-iris/15 text-chalk" : "border-line text-mist hover:text-chalk"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`rounded-full border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-widest transition-colors ${
                  status === s ? "border-aqua/50 bg-aqua/10 text-chalk" : "border-line text-mist-dim hover:text-chalk"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts…"
            aria-label="Search prompts"
            className="w-full rounded-full border border-line bg-surface-1 px-3.5 py-1.5 text-xs text-chalk placeholder:text-mist-dim outline-none focus:border-iris/60 lg:w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Prompt</th>
              <th className="pb-3 pr-4 font-normal">Type</th>
              {ENGINE_KEYS.map((k) => (
                <th key={k} className="pb-3 pr-4 font-normal">
                  {ENGINE_LABELS[k]}
                </th>
              ))}
              <th className="pb-3 font-normal">Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.prompt} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                <td className="max-w-72 py-3 pr-4 text-chalk">{p.prompt}</td>
                <td className="py-3 pr-4 text-xs text-mist-dim">{p.type}</td>
                {ENGINE_KEYS.map((k) => (
                  <td key={k} className="py-3 pr-4">
                    <StatusChip status={p.engines[k]} />
                  </td>
                ))}
                <td className={`py-3 text-xs ${p.sentiment === "Risk" ? "text-coral" : p.sentiment === "Positive" ? "text-mint" : "text-mist-dim"}`}>
                  {p.sentiment}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-line bg-surface-1 p-8 text-center text-sm text-mist">
          No prompts match those filters.
        </p>
      )}

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        {rows.length} of {prompts.length} prompts · weekly runs across 4 engines
      </p>    </div>
  );
}
