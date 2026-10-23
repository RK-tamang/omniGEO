"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { IdeaTable } from "@/components/dashboard/idea-table";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { IdeaRow, KeywordIntent } from "@/lib/dashboard-config";

type ProviderKeyword = {
  keyword: string;
  searchVolume?: number;
  competition?: number;
  cpc?: number;
};

/**
 * Intent is read from the query itself — the provider returns volume and
 * competition, not a buyer-intent label.
 */
function inferIntent(keyword: string): KeywordIntent {
  const k = keyword.toLowerCase();
  if (/\b(near me|local|in \w+ city|branch|store)\b/.test(k)) return "Local";
  if (/\b(buy|price|pricing|cost|quote|order|hire|free trial|demo)\b/.test(k)) return "Transactional";
  if (/\b(best|top|vs|versus|compare|alternative|review|leading)\b/.test(k)) return "Commercial";
  return "Informational";
}

/**
 * Opportunity blends how winnable a term is (low competition) with how much
 * demand sits behind it. Both halves are shown to the user in the panel below
 * the table, so the number is never a black box.
 */
function opportunityScore(volume: number, difficulty: number): number {
  const winnable = 1 - difficulty / 100;
  const demand = Math.min(volume, 3000) / 3000;
  return Math.round((winnable * 0.5 + demand * 0.5) * 100);
}

export function KeywordResearch({ defaultSeeds = "" }: { defaultSeeds?: string }) {
  const [seeds, setSeeds] = useState(defaultSeeds);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  async function pull(e: React.FormEvent) {
    e.preventDefault();
    const list = seeds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setMessage("Enter at least one seed keyword.");
      setState("error");
      return;
    }

    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/dataforseo/keyword-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: list }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.error ?? "Keyword pull failed.");

      const rows: ProviderKeyword[] = body?.data?.keywords ?? [];
      setSimulated(Boolean(body.simulated));

      const mapped: IdeaRow[] = rows
        .filter((k) => typeof k?.keyword === "string" && k.keyword.length > 0)
        .map((k) => {
          const volume = k.searchVolume ?? 0;
          const difficulty = Math.round((k.competition ?? 0) * 100);
          const cluster = list.find((seed) => k.keyword.toLowerCase().startsWith(seed.toLowerCase())) ?? list[0];
          return {
            keyword: k.keyword,
            intent: inferIntent(k.keyword),
            volume,
            difficulty,
            opportunity: opportunityScore(volume, difficulty),
            rank: null,
            cluster,
          };
        });

      setIdeas(mapped);
      setState("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Keyword pull failed.");
      setState("error");
    }
  }

  const avgOpp = ideas.length ? Math.round(ideas.reduce((s, k) => s + k.opportunity, 0) / ideas.length) : 0;
  const unranked = ideas.filter((k) => k.rank === null && k.opportunity >= 75).length;
  const volume = ideas.reduce((s, k) => s + k.volume, 0);

  const clusters = useMemo(
    () =>
      Object.entries(
        ideas.reduce<Record<string, { count: number; opp: number }>>((acc, k) => {
          const c = (acc[k.cluster] ??= { count: 0, opp: 0 });
          c.count += 1;
          c.opp += k.opportunity;
          return acc;
        }, {}),
      )
        .map(([name, v]) => ({ name, count: v.count, opp: Math.round(v.opp / v.count) }))
        .sort((a, b) => b.opp - a.opp),
    [ideas],
  );

  return (
    <>
      <DashboardHeader
        title="Keyword Research"
        sub="Prompt-shaped keyword ideas: what buyers type into Google and ask AI, scored for how winnable a citation is today."
      />

      <Panel title="Pull keyword ideas" sub="Seed with the terms your buyers use — each pull is a live provider request" level={2}>
        <form onSubmit={pull} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={seeds}
            onChange={(e) => setSeeds(e.target.value)}
            placeholder="geo tools, ai visibility, crm for small business"
            aria-label="Seed keywords, comma separated"
            className="w-full rounded-full border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none focus:border-iris/60"
          />
          <Button type="submit" disabled={state === "loading"} className="shrink-0">
            {state === "loading" ? "Pulling…" : "Pull ideas"}
          </Button>
        </form>
        {message ? <p className="mt-3 text-sm text-coral">{message}</p> : null}
        {state === "done" && simulated ? (
          <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-widest text-gold">
            Provider credentials are not configured — these results are simulated by the engine.
          </p>
        ) : null}
      </Panel>

      {ideas.length === 0 ? (
        <Panel className="mt-6" title="Ideas" sub="Nothing pulled yet" level={2}>
          <EmptyState
            title="No keyword ideas yet"
            sub="Enter a seed keyword above and pull. The provider returns volume, competition and cost per click for every idea it expands."
          />
        </Panel>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Ideas surfaced" value={`${ideas.length}`} delta={0} unit="new" hint="From your seed terms" />
            <KpiCard label="Total volume" value={volume.toLocaleString("en-GB")} delta={0} unit="searches" hint="Monthly, summed" />
            <KpiCard label="Avg AI opportunity" value={`${avgOpp}`} delta={0} unit="pts" hint="Across all ideas" />
            <KpiCard label="Winning & unranked" value={`${unranked}`} delta={0} unit="ideas" hint="High opportunity, no page yet" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <Panel className="lg:col-span-2" title="Idea clusters" sub="Grouped by the seed they came from — sorted by opportunity" level={2}>
              <ul className="space-y-3.5">
                {clusters.map((c) => (
                  <li key={c.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-chalk">{c.name}</span>
                      <span className="font-mono text-xs text-mist">
                        {c.count} ideas · opp {c.opp}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-iris to-aqua"
                        style={{ width: `${c.opp}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="How opportunity is scored" sub="Why a low-difficulty keyword can still be a big swing" level={2}>
              <ol className="space-y-4 text-sm">
                {[
                  "Half the score is how winnable the term is — competition from the provider, inverted.",
                  "The other half is demand — monthly volume, capped so one huge term cannot dominate.",
                  "Intent is read from the query itself: local, transactional, commercial or informational.",
                  "Rank stays empty until you actually appear, which is the point of tracking it.",
                ].map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-display text-lg font-normal italic leading-none text-iris">{i + 1}</span>
                    <span className="leading-relaxed text-mist">{t}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <Panel className="mt-6" title="All ideas" sub="Filter by intent, sort by what you want to win first" level={2}>
            <IdeaTable ideas={ideas} />
          </Panel>
        </>
      )}
    </>
  );
}
