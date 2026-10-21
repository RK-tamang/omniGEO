import type { Metadata } from "next";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { IdeaTable } from "@/components/dashboard/idea-table";
import { keywordIdeas } from "@/lib/dashboard-data";

export const metadata: Metadata = { title: "Keyword Research" };

export default function KeywordsPage() {
  const avgOpp = Math.round(keywordIdeas.reduce((s, k) => s + k.opportunity, 0) / keywordIdeas.length);
  const unranked = keywordIdeas.filter((k) => k.rank === null && k.opportunity >= 75).length;
  const volume = keywordIdeas.reduce((s, k) => s + k.volume, 0);

  const clusters = Object.entries(
    keywordIdeas.reduce<Record<string, { count: number; opp: number }>>((acc, k) => {
      const c = (acc[k.cluster] ??= { count: 0, opp: 0 });
      c.count += 1;
      c.opp += k.opportunity;
      return acc;
    }, {}),
  )
    .map(([name, v]) => ({ name, count: v.count, opp: Math.round(v.opp / v.count) }))
    .sort((a, b) => b.opp - a.opp);

  return (
    <>
      <DashboardHeader
        title="Keyword Research"
        sub="Prompt-shaped keyword ideas: what buyers type into Google and ask AI, scored for how winnable a citation is today."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ideas surfaced" value={`${keywordIdeas.length}`} delta={6} unit="new" hint="From prompt + SERP overlap" />
        <KpiCard label="Total volume" value={volume.toLocaleString("en-GB")} delta={8.4} unit="%" hint="Monthly, summed" />
        <KpiCard label="Avg AI opportunity" value={`${avgOpp}`} delta={3} unit="pts" hint="Across all ideas" />
        <KpiCard label="Winning & unranked" value={`${unranked}`} delta={2} unit="ideas" hint="High opportunity, no page yet" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Idea clusters" sub="Grouped by the prompt they serve — sorted by opportunity">
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

        <Panel title="How opportunity is scored" sub="Why a low-difficulty keyword can still be a big swing">
          <ol className="space-y-4 text-sm">
            {[
              "Is the prompt already answered by an engine? Unanswered prompts are cheaper to win.",
              "Do current citations come from thin aggregators? Weak sources move faster.",
              "Does your cluster have a page with a direct 40–60 word answer?",
              "How many competitors have corroboration for the same claim?",
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-lg font-normal italic leading-none text-iris">{i + 1}</span>
                <span className="leading-relaxed text-mist">{t}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel className="mt-6" title="All ideas" sub="Filter by intent, sort by what you want to win first">
        <IdeaTable />
      </Panel>
    </>
  );
}
