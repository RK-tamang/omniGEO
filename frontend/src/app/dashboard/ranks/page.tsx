import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { KeywordsTable } from "@/components/dashboard/keywords-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { KeywordRow } from "@/lib/dashboard-config";

export const metadata: Metadata = { title: "Rank Tracker" };

export default function RanksPage() {
  // Rank tracking needs a live SERP pull per keyword; nothing is stored in
  // the workspace until one runs.
  const keywords: KeywordRow[] = [];

  const kpis = [
    { label: "Average position", value: "—", delta: 0, unit: "spots", hint: "No SERP pull yet" },
    { label: "Top 3", value: "0", delta: 0, unit: "keywords", hint: "Of 0 tracked" },
    { label: "Top 10", value: "0", delta: 0, unit: "keywords", hint: "Page-one presence" },
    { label: "AI Overview citations", value: "0/0", delta: 0, unit: "keywords", hint: "Where an Overview triggers" },
  ];

  return (
    <>
      <DashboardHeader
        title="Rank Tracker"
        sub="Classic blue-link positions alongside the new layer: which keywords trigger an AI Overview, and whether it cites you."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Panel title="Rank distribution" sub="Tracked keywords by position band" className="lg:col-span-2" level={2}>
          <EmptyState
            title="No rank data yet"
            sub="Every figure on this page comes from a live SERP pull. Once a pull runs, the distribution, positions and AI Overview flags fill in."
          />
        </Panel>

        <Panel title="SERP landscape" sub="What appears alongside your result" level={2}>
          <EmptyState
            title="No SERP landscape yet"
            sub="SERP features — AI Overviews, sitelinks, video and map packs — are read from the same pull."
          />
          <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-mist">
            Need the terms to pull?{" "}
            <Link href="/dashboard/keywords" className="text-iris hover:underline">
              Start with keyword research
            </Link>
            .
          </p>
        </Panel>
      </div>

      <Panel className="mt-6" title="Tracked keywords" sub="Positions refresh on every pull" level={2}>
        <KeywordsTable keywords={keywords} />
      </Panel>
    </>
  );
}
