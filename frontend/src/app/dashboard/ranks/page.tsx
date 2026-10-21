import type { Metadata } from "next";
import { ColumnChart } from "@/components/dashboard/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { KeywordsTable } from "@/components/dashboard/keywords-table";
import { keywords, rankDistribution } from "@/lib/dashboard-data";

export const metadata: Metadata = { title: "Rank Tracker" };

export default function RanksPage() {
  const avg = (keywords.reduce((sum, k) => sum + k.position, 0) / keywords.length).toFixed(1);
  const top3 = keywords.filter((k) => k.position <= 3).length;
  const top10 = keywords.filter((k) => k.position <= 10).length;
  const aiCited = keywords.filter((k) => k.aiCited).length;

  return (
    <>
      <DashboardHeader
        title="Rank Tracker"
        sub="Classic blue-link positions alongside the new layer: which keywords trigger an AI Overview, and whether it cites you."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Average position" value={avg} delta={1.8} unit="spots" hint="Improved vs last week" />
        <KpiCard label="Top 3" value={`${top3}`} delta={1} unit="keywords" hint="Of 14 tracked" />
        <KpiCard label="Top 10" value={`${top10}`} delta={2} unit="keywords" hint="Page-one presence" />
        <KpiCard label="AI Overview citations" value={`${aiCited}/${keywords.length}`} delta={2} unit="keywords" hint="Where an Overview triggers" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Panel title="Rank distribution" sub="Tracked keywords by position band" className="lg:col-span-2">
          <ColumnChart items={rankDistribution} />
        </Panel>

        <Panel title="SERP landscape" sub="What appears alongside your result">
          <ul className="space-y-3.5 text-sm">
            {[
              { label: "Trigger AI Overview", count: 9 },
              { label: "Sitelinks present", count: 6 },
              { label: "Video pack", count: 3 },
              { label: "Map pack", count: 1 },
            ].map((f) => (
              <li key={f.label} className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
                <span className="text-mist">{f.label}</span>
                <span className="font-mono text-xs text-chalk">
                  {f.count}/{keywords.length}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-mist">
            Nine of fourteen keywords now surface an AI Overview. On those, position one sends ~38% less traffic than it
            did last year — track citations alongside rank.
          </p>
        </Panel>
      </div>

      <Panel className="mt-6" title="Tracked keywords" sub="Google desktop · Mumbai locale · refreshed daily">
        <KeywordsTable />
      </Panel>
    </>
  );
}
