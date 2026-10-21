"use client";

import { useState } from "react";
import { Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { KpiCard, QuickAction, ContentToolCard } from "@/components/dashboard/shared-components";

const CONTENT_TOOLS = [
  {
    id: "geo-writer",
    name: "GEO Content Writer",
    description: "Drafts full GEO-optimized blogs and articles — citation-ready, structured, entity-rich",
    category: "create",
    status: "active",
  },
  {
    id: "page-optimizer",
    name: "Existing Page Optimizer",
    description: "Rewrites existing pages for AI citation readiness — adds claims, sources, FAQs, schema",
    category: "optimize",
    status: "active",
  },
  {
    id: "answer-faq",
    name: "AI Answer & FAQ Generator",
    description: "Generates direct answers and FAQ sections from your content — ready for AI Overviews",
    category: "create",
    status: "active",
  },
  {
    id: "brief-generator",
    name: "Content Brief Generator",
    description: "Creates detailed GEO content briefs — target prompts, structure, sources, schema needs",
    category: "plan",
    status: "active",
  },
  {
    id: "entity-coverage",
    name: "Entity & Topic Coverage Checker",
    description: "Verifies your content covers all key entities, topics, and semantic relationships",
    category: "audit",
    status: "active",
  },
  {
    id: "source-recommender",
    name: "Statistics & Source Recommender",
    description: "Finds credible statistics, studies, and sources to back your claims — auto-links",
    category: "research",
    status: "active",
  },
  {
    id: "schema-generator",
    name: "Schema Generator",
    description: "Generates JSON-LD (Article, FAQPage, HowTo, Product, LocalBusiness) — one-click inject",
    category: "technical",
    status: "active",
  },
  {
    id: "refresh-recommender",
    name: "Content Refresh Recommender",
    description: "Identifies stale content, declining visibility, and prioritizes updates by ROI",
    category: "audit",
    status: "active",
  },
  {
    id: "landing-compare",
    name: "Landing Page Comparison",
    description: "A/B tests GEO-optimized vs. original — measures citation lift and visibility delta",
    category: "test",
    status: "beta",
  },
  {
    id: "quality-scoring",
    name: "Content Quality Scoring",
    description: "Scores content on citation-readiness, entity coverage, structure, and claim specificity",
    category: "audit",
    status: "active",
  },
  {
    id: "optimization-history",
    name: "Content Optimization History",
    description: "Version control for GEO edits — tracks changes, visibility impact, and rollback points",
    category: "manage",
    status: "active",
  },
];

export default function ContentOptimizationPage() {
  const [activeCategory, setActiveCategory] = useState<"all" | "create" | "optimize" | "plan" | "audit" | "research" | "technical" | "test" | "manage">("all");

  const filteredTools = CONTENT_TOOLS.filter((t) =>
    activeCategory === "all" ? true : t.category === activeCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">AI Content Optimization</h1>
          <p className="mt-1 text-sm text-mist">11 tools — create, optimize, and audit content for AI citation readiness</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary">View History</Button>
          <Button onClick={() => window.open("/dashboard/geo-writer", "_blank")}>
            Start Writing
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "create", "optimize", "plan", "audit", "research", "technical", "test", "manage"].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as "all" | "create" | "optimize" | "plan" | "audit" | "research" | "technical" | "test" | "manage")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-iris/15 text-iris border border-iris/30"
                : "text-mist hover:bg-surface-2 hover:text-chalk"
            }`}
          >
            {cat === "all" ? "All Tools" : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Tool Grid */}
      <Panel title={`Content Tools (${filteredTools.length})`} sub="Create, optimize, and audit — all in one workflow">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <ContentToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Start a content workflow">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="Write New GEO Article"
            description="GEO Writer — full article from prompt"
            href="/dashboard/geo-writer"
            icon="pen"
          />
          <QuickAction
            title="Optimize Existing Page"
            description="Page Optimizer — rewrite for citations"
            href="/dashboard/page-optimizer"
            icon="sparkles"
          />
          <QuickAction
            title="Generate FAQ Section"
            description="Answer & FAQ Generator — AI Overview ready"
            href="/dashboard/answer-faq"
            icon="message-square"
          />
          <QuickAction
            title="Create Content Brief"
            description="Brief Generator — structure, sources, schema"
            href="/dashboard/brief-generator"
            icon="file-plus"
          />
        </div>
      </Panel>

      {/* Content Pipeline */}
      <Panel title="Content Pipeline" sub="Track optimization progress across all pages">
        <div className="rounded-xl border border-line overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface/60 border-b border-line">
                <th className="px-4 py-3 text-left text-sm font-medium text-mist">Page / Topic</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Stage</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Quality Score</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Citations</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Last Optimized</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-mist">Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                { page: "Best CRM for Small Business 2024", stage: "Published", score: 87, citations: 12, date: "2 days ago", action: "Refresh" },
                { page: "AI Search Visibility Guide", stage: "In Review", score: 74, citations: 5, date: "1 week ago", action: "Approve" },
                { page: "Competitor Comparison: HubSpot vs Salesforce", stage: "Draft", score: 62, citations: 0, date: "3 days ago", action: "Edit" },
                { page: "Schema Markup for Local SEO", stage: "Optimizing", score: 58, citations: 3, date: "5 days ago", action: "Continue" },
                { page: "Entity Coverage: CRM Software", stage: "Planned", score: 45, citations: 0, date: "—", action: "Start" },
              ].map((item, i) => (
                <tr key={i} className="border-b border-line/50 hover:bg-surface/40">
                  <td className="px-4 py-3 font-medium text-chalk max-w-xs truncate">{item.page}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${
                      item.stage === "Published" ? "bg-mint/15 text-mint border-mint/30" :
                      item.stage === "In Review" ? "bg-aqua/15 text-aqua border-aqua/30" :
                      item.stage === "Draft" ? "bg-mist/15 text-mist border-mist/30" :
                      "bg-gold/15 text-gold border-gold/30"
                    }`}>
                      {item.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center"><ScoreBar score={item.score} /></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">{item.citations}</td>
                  <td className="px-4 py-3 text-center text-sm text-mist">{item.date}</td>
                  <td className="px-4 py-3 text-center">
                    <button className="text-xs text-iris hover:text-iris/80 font-medium">{item.action}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Common content workflows">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="Write New Article"
            description="GEO Writer — full article from topic"
            href="/dashboard/geo-writer"
            icon="pen"
          />
          <QuickAction
            title="Optimize Page"
            description="Page Optimizer — rewrite for citations"
            href="/dashboard/page-optimizer"
            icon="sparkles"
          />
          <QuickAction
            title="Generate FAQs"
            description="Answer & FAQ Generator — AI Overview ready"
            href="/dashboard/answer-faq"
            icon="message-square"
          />
          <QuickAction
            title="Create Brief"
            description="Brief Generator — structure, sources, schema"
            href="/dashboard/brief-generator"
            icon="file-plus"
          />
        </div>
      </Panel>
    </div>
  );
}