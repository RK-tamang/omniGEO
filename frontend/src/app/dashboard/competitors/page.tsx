"use client";

import { useState } from "react";
import { Panel, ScoreBar } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { QuickAction, CompetitorToolCard } from "@/components/dashboard/shared-components";
import { MarketShareChart } from "@/components/dashboard/market-share-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { mergeCompetitors, mergePrompts } from "@/lib/workspace-data";

const COMPETITOR_TOOLS = [
  {
    id: "discovery",
    name: "Competitor Discovery",
    description: "Automatically suggests competing brands based on shared prompts and citations",
    status: "active",
  },
  {
    id: "compare",
    name: "AI Recommendation Compare",
    description: "Compares which brands appear for the same prompts — side-by-side visibility",
    status: "active",
  },
  {
    id: "prompt-gaps",
    name: "Competitor Prompt Gap Finder",
    description: "Identifies questions competitors win that you don't — your content opportunities",
    status: "active",
  },
  {
    id: "citations",
    name: "Citation Source Explorer",
    description: "Shows websites and pages frequently cited in tracked answers — build your link strategy",
    status: "active",
  },
  {
    id: "content-gaps",
    name: "Content Gap Analyzer",
    description: "Identifies topics your site doesn't cover adequately vs. competitors",
    status: "active",
  },
  {
    id: "movement",
    name: "Competitor Movement Tracker",
    description: "Monitors visibility changes over time — spot rising/falling competitors",
    status: "active",
  },
  {
    id: "pages",
    name: "Competitor Page Analyzer",
    description: "Analyzes specific pages associated with competitor mentions — reverse-engineer their strategy",
    status: "active",
  },
  {
    id: "market-share",
    name: "Market Share Dashboard",
    description: "Compares AI mentions and recommendations across all tracked brands in your niche",
    status: "active",
  },
];

export default function CompetitorsPage() {
  const [view, setView] = useState<"grid" | "compare">("grid");
  const { data } = useWorkspaceData();
  const competitors = mergeCompetitors(data);
  const prompts = mergePrompts(data);

  const own = {
    visibility: prompts.length
      ? Math.round(
          (prompts.filter((p) => Object.values(p.engines).some((s) => s !== "missing")).length / prompts.length) * 100,
        )
      : 0,
    citations: data?.citations?.length ?? 0,
    prompts: prompts.filter((p) => Object.values(p.engines).some((s) => s === "cited")).length,
    citationsList: [...new Set((data?.citations ?? []).map((c) => c.domain))].slice(0, 3).join(", "),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">Competitor Intelligence</h1>
          <p className="mt-1 text-sm text-mist">Track, compare, and outmaneuver competitors in AI search</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setView("compare")}>
            Compare View
          </Button>
          <Button variant="ghost" onClick={() => {}}>Add Competitor</Button>
        </div>
      </div>

      {/* Market Share Overview */}
      <Panel title="Market Share — AI Mentions" sub="Your brand vs. every competitor this workspace tracks">
        <MarketShareChart />
      </Panel>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => setView("compare")}>
          Side-by-Side Compare
        </Button>
        <Button variant="secondary">Find New Competitors</Button>
        <Button variant="secondary">Export Comparison</Button>
      </div>

      {/* Tool Grid */}
      <Panel title="Competitor Tools" sub="8 tools to discover, analyze, and outrank competitors" level={2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPETITOR_TOOLS.map((tool) => (
            <CompetitorToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </Panel>

      {/* Top Competitors Table */}
      <Panel title="Tracked Competitors" sub="Current visibility snapshot" level={2}>
        {competitors.length === 0 ? (
          <EmptyState
            title="No competitors tracked yet"
            sub="Add the brands buyers compare you against and their visibility, citations and prompt wins appear here."
          />
        ) : (
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface/60 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Competitor</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Visibility</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Prompts Won</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Last checked</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Domain</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface/40">
                  <td className="px-4 py-3 font-medium text-chalk">
                    {data?.workspace?.name ?? "Your brand"}
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest text-mint">
                      You
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center"><ScoreBar score={own.visibility} /></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">{own.citations}</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">{own.prompts}</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">—</td>
                  <td className="px-4 py-3 text-center text-sm text-mist max-w-xs truncate">{own.citationsList || "—"}</td>
                </tr>
                {competitors.map((comp) => (
                  <tr key={comp.id} className="border-b border-line/50 hover:bg-surface/40">
                    <td className="px-4 py-3 font-medium text-chalk">{comp.name}</td>
                    <td className="px-4 py-3 text-center"><ScoreBar score={comp.visibility} /></td>
                    <td className="px-4 py-3 text-center font-mono text-chalk">{comp.citations}</td>
                    <td className="px-4 py-3 text-center font-mono text-chalk">{comp.prompts}</td>
                    <td className="px-4 py-3 text-center text-sm text-mist">{comp.lastChecked}</td>
                    <td className="px-4 py-3 text-center text-sm text-mist max-w-xs truncate">{comp.domain || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Common competitor workflows" level={2}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="Compare Side-by-Side"
            description="Select 2+ brands for detailed comparison"
            onClick={() => setView("compare")}
            icon="git-compare"
          />
          <QuickAction
            title="Find Prompt Gaps"
            description="See which prompts competitors win"
            href="/dashboard/prompt-gaps"
            icon="target"
          />
          <QuickAction
            title="Explore Citation Sources"
            description="See where competitors get cited"
            href="/dashboard/competitor-citations"
            icon="external-link"
          />
          <QuickAction
            title="Track Movement"
            description="Monitor visibility changes over time"
            href="/dashboard/competitor-movement"
            icon="trending-up"
          />
        </div>
      </Panel>
    </div>
  );
}
