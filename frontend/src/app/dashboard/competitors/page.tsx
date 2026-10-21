"use client";

import { useState } from "react";
import { Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { KpiCard, QuickAction, CompetitorToolCard } from "@/components/dashboard/shared-components";

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
      <Panel title="Market Share — AI Mentions" sub="Your brand vs. top 5 competitors across all tracked prompts">
        <div className="h-64 flex items-end justify-between gap-3 px-2 pb-2">
          {[
            { label: "You", value: 68, color: "bg-iris" },
            { label: "Competitor A", value: 45, color: "bg-aqua" },
            { label: "Competitor B", value: 38, color: "bg-gold" },
            { label: "Competitor C", value: 32, color: "bg-coral" },
            { label: "Competitor D", value: 28, color: "bg-mint" },
            { label: "Competitor E", value: 22, color: "bg-mist" },
          ].map((item, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`flex-1 w-full rounded-t transition-colors ${item.color}`}
                style={{ height: `${item.value}%` }}
                title={`${item.label}: ${item.value}%`}
              />
              <span className="text-xs text-mist-dim text-center w-20">{item.label}</span>
              <span className="font-mono text-sm text-chalk">{item.value}%</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-mist mt-4">
          <span>Market share across 150 tracked prompts</span>
          <span className="text-chalk font-medium">Your share: 68%</span>
        </div>
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
      <Panel title="Competitor Tools" sub="8 tools to discover, analyze, and outrank competitors">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPETITOR_TOOLS.map((tool) => (
            <CompetitorToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </Panel>

      {/* Top Competitors Table */}
      <Panel title="Tracked Competitors" sub="Current visibility snapshot">
        <div className="rounded-xl border border-line overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface/60 border-b border-line">
                <th className="px-4 py-3 text-left text-sm font-medium text-mist">Competitor</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Visibility</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Prompts Won</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Trend</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Top Citations</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Your Brand", visibility: 68, citations: 127, prompts: 42, trend: "+8%", citationsList: "northwindlabs.com, docs.northwind.io, blog.northwind.io" },
                { name: "Competitor A", visibility: 45, citations: 89, prompts: 28, trend: "+3%", citationsList: "competitor-a.com, blog.competitor-a.com" },
                { name: "Competitor B", visibility: 38, citations: 72, prompts: 22, trend: "-2%", citationsList: "competitor-b.io, help.competitor-b.io" },
                { name: "Competitor C", visibility: 32, citations: 58, prompts: 18, trend: "+5%", citationsList: "competitor-c.com, academy.competitor-c.com" },
                { name: "Competitor D", visibility: 28, citations: 45, prompts: 12, trend: "+1%", citationsList: "competitor-d.com, blog.competitor-d.com" },
              ].map((comp, i) => (
                <tr key={i} className="border-b border-line/50 hover:bg-surface/40">
                  <td className="px-4 py-3 font-medium text-chalk">
                    <>
                      {comp.name}
                      {i === 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest text-mint">
                          You
                        </span>
                      )}
                    </>
                  </td>
                  <td className="px-4 py-3 text-center"><ScoreBar score={comp.visibility} /></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">{comp.citations}</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">{comp.prompts}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={comp.trend.startsWith("+") ? "text-mint" : "text-coral"} font-mono text-sm>
                      {comp.trend}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-mist max-w-xs truncate">{comp.citationsList}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Common competitor workflows">
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