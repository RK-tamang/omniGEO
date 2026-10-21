"use client";

import { useState } from "react";
import { Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { KpiCard, QuickAction, ToolCard, IssueRow } from "@/components/dashboard/shared-components";

const AUDIT_TOOLS = [
  {
    id: "geo-audit",
    name: "Website GEO Audit",
    description: "Overall technical and content readiness for AI search — comprehensive scorecard",
    category: "core",
    status: "active",
  },
  {
    id: "crawler",
    name: "Website Crawler",
    description: "Discovers URLs and analyzes pages — JavaScript rendering, content extraction",
    category: "core",
    status: "active",
  },
  {
    id: "robots",
    name: "Robots & Crawlability Checker",
    description: "Checks crawler access, robots.txt, indexing signals, and AI bot permissions",
    category: "core",
    status: "active",
  },
  {
    id: "schema",
    name: "Schema Markup Validator",
    description: "Checks relevant structured data — Organization, Article, Product, FAQ, LocalBusiness",
    category: "core",
    status: "active",
  },
  {
    id: "entities",
    name: "Entity Optimization Analyzer",
    description: "Reviews brand, product, and organization entity consistency across pages",
    category: "content",
    status: "active",
  },
  {
    id: "readability",
    name: "Content Readability Analyzer",
    description: "Checks clarity, structure, direct answers, and citation-ready formatting",
    category: "content",
    status: "active",
  },
  {
    id: "topical-authority",
    name: "Topical Authority Analyzer",
    description: "Identifies topic coverage depth, content gaps, and semantic completeness",
    category: "content",
    status: "active",
  },
  {
    id: "faq",
    name: "FAQ Optimization Tool",
    description: "Finds unanswered questions, FAQ opportunities, and People Also Ask gaps",
    category: "content",
    status: "active",
  },
  {
    id: "internal-links",
    name: "Internal Linking Analyzer",
    description: "Identifies relevant internal linking gaps and orphan pages",
    category: "technical",
    status: "active",
  },
  {
    id: "source-readiness",
    name: "Source & Citation Readiness",
    description: "Evaluates whether important claims are clear, verifiable, and citation-ready",
    category: "content",
    status: "active",
  },
  {
    id: "technical-monitor",
    name: "Technical Issue Monitor",
    description: "Tracks broken pages, redirects, metadata issues, and other technical problems",
    category: "technical",
    status: "active",
  },
];

export default function GeoAuditPage() {
  const [activeCategory, setActiveCategory] = useState<"all" | "core" | "content" | "technical">("all");

  const filteredTools = AUDIT_TOOLS.filter((t) =>
    activeCategory === "all" ? true : t.category === activeCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">GEO Website Audit</h1>
          <p className="mt-1 text-sm text-mist">11 tools — technical, content, and entity readiness for AI search</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary">Export Full Audit</Button>
          <Button onClick={() => window.open("/dashboard/crawler", "_blank")}>
            Run Full Crawl
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Overall GEO Score" value="72" delta={5} unit="pts" />
        <KpiCard label="Pages Crawled" value="41,230" delta={1200} />
        <KpiCard label="Issues Found" value="23" delta={-5} invert />
        <KpiCard label="Schema Coverage" value="87%" delta={3} unit="%" />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "core", "content", "technical"].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as any)}
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
      <Panel title={`Audit Tools (${filteredTools.length})`} sub="Click any tool to run or view results">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              statusColors={{
                active: "bg-mint/15 text-mint border-mint/30",
                beta: "bg-aqua/15 text-aqua border-aqua/30",
                planned: "bg-mist/15 text-mist border-mist/30",
              }}
              categoryColors={{
                core: "bg-iris/15 text-iris border-iris/30",
                content: "bg-mint/15 text-mint border-mint/30",
                technical: "bg-aqua/15 text-aqua border-aqua/30",
              }}
            />
          ))}
        </div>
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Common audit workflows">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="Full GEO Audit"
            description="Run complete technical + content audit"
            href="/dashboard/geo-audit"
            icon="clipboard"
          />
          <QuickAction
            title="Crawl Website"
            description="Discover all URLs with JavaScript rendering"
            href="/dashboard/crawler"
            icon="bot"
          />
          <QuickAction
            title="Check Robots.txt"
            description="Verify AI bot access and crawlability"
            href="/dashboard/robots"
            icon="file-text"
          />
          <QuickAction
            title="Validate Schema"
            description="Check structured data across all pages"
            href="/dashboard/schema"
            icon="code"
          />
        </div>
      </Panel>

      {/* Issue Summary */}
      <Panel title="Top Issues to Fix" sub="Prioritized by impact on AI visibility">
        <div className="space-y-3">
          <IssueRow
            severity="Critical"
            title="GPTBot blocked by robots.txt"
            description="/resources/* disallows all AI crawlers — 41 pages uncrawlable"
            count="41 pages"
            href="/dashboard/robots"
          />
          <IssueRow
            severity="Warning"
            title="Missing FAQPage schema"
            description="12 high-traffic pages lack FAQ structured data"
            count="12 pages"
            href="/dashboard/schema"
          />
          <IssueRow
            severity="Warning"
            title="Thin content on product pages"
            description="8 product pages under 300 words — unlikely to be cited"
            count="8 pages"
            href="/dashboard/readability"
          />
          <IssueRow
            severity="Notice"
            title="Internal linking gaps"
            description="23 orphan pages with no internal links from pillar content"
            count="23 pages"
            href="/dashboard/internal-links"
          />
        </div>
      </Panel>
    </div>
  );
}