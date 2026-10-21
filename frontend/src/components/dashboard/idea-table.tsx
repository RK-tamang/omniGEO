"use client";

import { useMemo, useState } from "react";
import { intentColors, keywordIdeas, type KeywordIntent } from "@/lib/dashboard-data";

type SortKey = "opportunity" | "volume" | "difficulty" | "rank";
const INTENTS: KeywordIntent[] = ["Informational", "Commercial", "Transactional", "Local"];

function DiffBar({ value, tone }: { value: number; tone: "difficulty" | "opportunity" }) {
  const color =
    tone === "opportunity"
      ? value >= 85
        ? "bg-mint"
        : value >= 70
          ? "bg-aqua"
          : "bg-mist-dim"
      : value >= 60
        ? "bg-coral"
        : value >= 40
          ? "bg-gold"
          : "bg-mint";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs text-mist">{value}</span>
    </div>
  );
}

export function IdeaTable() {
  const [sort, setSort] = useState<SortKey>("opportunity");
  const [intent, setIntent] = useState<KeywordIntent | "All">("All");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keywordIdeas
      .filter((k) => (intent === "All" || k.intent === intent) && (!q || k.keyword.toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => {
        if (sort === "rank") return (a.rank ?? 999) - (b.rank ?? 999);
        if (sort === "difficulty") return a.difficulty - b.difficulty;
        return b[sort] - a[sort];
      });
  }, [sort, intent, query]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-full border border-line p-1" role="group" aria-label="Filter by intent">
          {(["All", ...INTENTS] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIntent(i)}
              aria-pressed={intent === i}
              className={`rounded-full px-3 py-1 font-mono text-[0.62rem] transition-colors ${
                intent === i ? "bg-iris/20 text-chalk" : "text-mist-dim hover:text-chalk"
              }`}
            >
              {i}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-full border border-line p-1" role="group" aria-label="Sort ideas">
            {(
              [
                { key: "opportunity", label: "AI opportunity" },
                { key: "volume", label: "Volume" },
                { key: "difficulty", label: "Easiest" },
                { key: "rank", label: "Best rank" },
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
            placeholder="Search ideas…"
            aria-label="Search keyword ideas"
            className="w-full rounded-full border border-line bg-surface-1 px-3.5 py-1.5 text-xs text-chalk placeholder:text-mist-dim outline-none focus:border-iris/60 sm:w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Keyword</th>
              <th className="pb-3 pr-4 font-normal">Intent</th>
              <th className="pb-3 pr-4 font-normal">Volume</th>
              <th className="pb-3 pr-4 font-normal">Difficulty</th>
              <th className="pb-3 pr-4 font-normal">AI opportunity</th>
              <th className="pb-3 font-normal">Rank</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.keyword} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                <td className="py-3 pr-4">
                  <span className="text-chalk">{k.keyword}</span>
                  <span className="mt-0.5 block font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                    {k.cluster}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${intentColors[k.intent]}`}
                  >
                    {k.intent}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-mist">{k.volume.toLocaleString("en-GB")}</td>
                <td className="py-3 pr-4">
                  <DiffBar value={k.difficulty} tone="difficulty" />
                </td>
                <td className="py-3 pr-4">
                  <DiffBar value={k.opportunity} tone="opportunity" />
                </td>
                <td className="py-3 font-mono text-xs">
                  {k.rank === null ? (
                    <span className="text-mist-dim">not ranking</span>
                  ) : (
                    <span className={k.rank <= 10 ? "text-mint" : "text-gold"}>#{k.rank}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-mist-dim">
                  No ideas match that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        {rows.length} of {keywordIdeas.length} ideas · opportunity blends AI citation likelihood with difficulty
      </p>
    </div>
  );
}
