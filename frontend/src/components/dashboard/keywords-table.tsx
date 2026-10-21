"use client";

import { useMemo, useState } from "react";
import { keywords } from "@/lib/dashboard-data";

type SortKey = "position" | "change" | "volume";

export function KeywordsTable() {
  const [sort, setSort] = useState<SortKey>("position");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keywords
      .filter((k) => !q || k.keyword.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === "position" ? a.position - b.position : sort === "volume" ? b.volume - a.volume : b.change - a.change));
  }, [sort, query]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-full border border-line p-1" role="group" aria-label="Sort keywords">
          {(
            [
              { key: "position", label: "Position" },
              { key: "change", label: "Biggest move" },
              { key: "volume", label: "Volume" },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={`rounded-full px-3 py-1 font-mono text-[0.62rem] transition-colors ${
                sort === s.key ? "bg-iris/20 text-chalk" : "text-mist-dim hover:text-chalk"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search keywords…"
          aria-label="Search keywords"
          className="w-full rounded-full border border-line bg-surface-1 px-3.5 py-1.5 text-xs text-chalk placeholder:text-mist-dim outline-none focus:border-iris/60 sm:w-56"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Keyword</th>
              <th className="pb-3 pr-4 font-normal">Pos.</th>
              <th className="pb-3 pr-4 font-normal">Δ</th>
              <th className="pb-3 pr-4 font-normal">Volume</th>
              <th className="pb-3 pr-4 font-normal">SERP features</th>
              <th className="pb-3 font-normal">AI cited</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.keyword} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                <td className="py-3 pr-4 text-chalk">{k.keyword}</td>
                <td className="py-3 pr-4 font-mono text-chalk">{k.position}</td>
                <td className={`py-3 pr-4 font-mono text-xs ${k.change > 0 ? "text-mint" : k.change < 0 ? "text-coral" : "text-mist-dim"}`}>
                  {k.change > 0 ? `▲ ${k.change}` : k.change < 0 ? `▼ ${Math.abs(k.change)}` : "—"}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-mist">{k.volume.toLocaleString("en-GB")}</td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {k.features.length === 0 && <span className="text-xs text-mist-dim">—</span>}
                    {k.features.map((f) => (
                      <span key={f} className="rounded-full border border-line px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-mist">
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={`py-3 font-mono text-xs ${k.aiCited ? "text-mint" : "text-mist-dim"}`}>{k.aiCited ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        {rows.length} of {keywords.length} tracked keywords · Google desktop · Mumbai locale
      </p>
    </div>
  );
}
