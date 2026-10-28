"use client";

import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

const TOOLS = [
  { key: "geo-audit", label: "Comprehensive GEO Website Audit", desc: "Combined GEO analysis across all rule categories" },
  { key: "ai-crawler", label: "AI Crawler Accessibility Checker", desc: "robots.txt analysis for AI crawlers (GPTBot, ClaudeBot, etc.)" },
  { key: "robots", label: "Robots.txt Analyzer", desc: "Analyze robots directives, sitemap references, and exclusions" },
  { key: "sitemap", label: "XML Sitemap Analyzer", desc: "Validate sitemap indexes, URLs, and crawl coverage" },
  { key: "schema", label: "Schema Validator", desc: "Validate JSON-LD and structured data (Organization, Product, Article, etc.)" },
  { key: "meta", label: "Meta & On-Page Analyzer", desc: "Title, description, canonical, robots meta, heading hierarchy" },
  { key: "content", label: "Content GEO Readiness Analyzer", desc: "Content structure, topic coverage, and Q&A analysis" },
  { key: "brand", label: "Brand Entity Consistency Analyzer", desc: "Compare website signals with registered brand profile" },
  { key: "internal-links", label: "Internal Link Analyzer", desc: "Link graph, crawl depth, orphan pages, and broken links" },
  { key: "performance", label: "Website Performance Analyzer", desc: "PageSpeed Insights data and Core Web Vitals" },
  { key: "broken-links", label: "Broken Link & Redirect Analyzer", desc: "4xx/5xx responses, redirect chains, and loops" },
  { key: "duplicate", label: "Duplicate Content Analyzer", desc: "Exact and near-duplicate content detection" },
  { key: "prompt-ideas", label: "Prompt Idea Generator", desc: "Deterministic AI-search prompt ideas by category" },
  { key: "opportunities", label: "GEO Opportunity Finder", desc: "Prioritized improvement opportunities from audit findings" },
  { key: "report", label: "GEO Report Generator", desc: "Generate JSON, CSV, or PDF reports from audit results" },
];

export default function GeoToolsPage() {
  return (
    <div className="space-y-6">
      <DashboardHeader
        title="GEO Tools"
        sub="Run individual GEO analysis tools — all reuse the same crawler snapshots"
        aside={<Button size="sm">Run All Tools</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <Panel key={tool.key} title={tool.label} sub={tool.desc} level={3}>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-xs text-mist-dim">{tool.key}</span>
              <Button size="sm" variant="outline">Run</Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}