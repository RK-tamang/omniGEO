"use client";

import { useState } from "react";
import { Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { KpiCard, QuickAction, MonitoringToolCard, AlertItem, ReportRow } from "@/components/dashboard/shared-components";

const MONITORING_TOOLS = [
  {
    id: "scheduled-checks",
    name: "Scheduled Visibility Checks",
    description: "Daily or scheduled AI visibility checks across all tracked prompts and engines",
    category: "monitor",
    status: "active",
  },
  {
    id: "mention-alerts",
    name: "Brand Mention Alerts",
    description: "Real-time alerts when your brand is mentioned (or stops being mentioned) in AI answers",
    category: "alert",
    status: "active",
  },
  {
    id: "competitor-alerts",
    name: "New Competitor Alerts",
    description: "Notified when new competitors appear in tracked answer spaces",
    category: "alert",
    status: "active",
  },
  {
    id: "citation-alerts",
    name: "Citation Loss Alerts",
    description: "Immediate notification when you lose a citation to a competitor",
    category: "alert",
    status: "active",
  },
  {
    id: "site-monitor",
    name: "Website Change Monitoring",
    description: "Tracks content changes, new pages, deletions, and metadata updates on your site",
    category: "monitor",
    status: "active",
  },
  {
    id: "weekly-reports",
    name: "Weekly GEO Performance Report",
    description: "Automated weekly summary — visibility trends, new citations, competitor moves",
    category: "report",
    status: "active",
  },
  {
    id: "monthly-reports",
    name: "Monthly Client Report",
    description: "Comprehensive monthly report with insights, recommendations, and ROI metrics",
    category: "report",
    status: "active",
  },
  {
    id: "exports",
    name: "PDF & CSV Exports",
    description: "One-click export of all data — visibility, citations, competitors, prompts",
    category: "export",
    status: "active",
  },
  {
    id: "whitelabel",
    name: "White-label Reporting",
    description: "Branded PDF and link reports for agency clients — your logo, your domain",
    category: "export",
    status: "active",
  },
  {
    id: "notifications",
    name: "Email & Integration Notifications",
    description: "Slack, email, webhook integrations for real-time alert delivery",
    category: "integration",
    status: "active",
  },
];

export default function MonitoringPage() {
  const [activeCategory, setActiveCategory] = useState<"all" | "monitor" | "alert" | "report" | "export" | "integration">("all");

  const filteredTools = MONITORING_TOOLS.filter((t) =>
    activeCategory === "all" ? true : t.category === activeCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">Monitoring & Reporting</h1>
          <p className="mt-1 text-sm text-mist">10 tools — automated checks, alerts, and professional reports</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary">Configure Alerts</Button>
          <Button onClick={() => window.open("/dashboard/weekly-reports", "_blank")}>
            Generate Report
          </Button>
        </div>
      </div>

      {/* Alert Status Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Alerts" value="3" delta={1} invert unit="unread" />
        <KpiCard label="Scheduled Checks" value="12" delta={2} unit="daily" />
        <KpiCard label="Reports This Month" value="4" delta={1} />
        <KpiCard label="Exports Generated" value="23" delta={5} />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "monitor", "alert", "report", "export", "integration"].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as "all" | "monitor" | "alert" | "report" | "export" | "integration")}
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
      <Panel title={`Monitoring Tools (${filteredTools.length})`} sub="Configure checks, alerts, and automated reports">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <MonitoringToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </Panel>

      {/* Alert Center */}
      <Panel title="Alert Center" sub="Recent alerts requiring attention">
        <div className="space-y-3">
          <AlertItem
            type="citation-loss"
            severity="Critical"
            title="Citation Lost: 'Best CRM 2024'"
            description="Competitor 'HubSpot' replaced your citation in ChatGPT & Perplexity"
            time="5 min ago"
            action="Investigate"
            href="/dashboard/citations"
          />
          <AlertItem
            type="new-competitor"
            severity="Warning"
            title="New Competitor Detected"
            description="'Salesforce' now appearing for 'enterprise CRM software' prompts"
            time="2 hours ago"
            action="Analyze"
            href="/dashboard/competitors"
          />
          <AlertItem
            type="mention-drop"
            severity="Warning"
            title="Visibility Drop Alert"
            description="AI Visibility Score fell 12 pts for 'CRM pricing' prompt cluster"
            time="4 hours ago"
            action="View Details"
            href="/dashboard/visibility"
          />
          <AlertItem
            type="site-change"
            severity="Notice"
            title="Content Change Detected"
            description="3 pages modified on docs.northwind.io — re-crawl recommended"
            time="6 hours ago"
            action="Re-crawl"
            href="/dashboard/crawler"
          />
        </div>
      </Panel>

      {/* Upcoming Reports */}
      <Panel title="Upcoming Reports" sub="Scheduled automated reports">
        <div className="space-y-3">
          <ReportRow
            name="Weekly GEO Performance"
            frequency="Every Monday 9 AM"
            nextRun="Tomorrow 9:00 AM"
            format="PDF + CSV"
            status="Active"
            recipients="team@northwind.io"
          />
          <ReportRow
            name="Monthly Client Report"
            frequency="1st of month"
            nextRun="Nov 1, 9:00 AM"
            format="PDF (White-label)"
            status="Active"
            recipients="client@acme.com, team@northwind.io"
          />
          <ReportRow
            name="Competitor Movement Alert"
            frequency="Daily 6 AM"
            nextRun="Today 6:00 AM"
            format="Slack + Email"
            status="Active"
            recipients="#geo-alerts, team@northwind.io"
          />
          <ReportRow
            name="Citation Health Check"
            frequency="Weekly Friday"
            nextRun="Friday 3:00 PM"
            format="CSV"
            status="Paused"
            recipients="team@northwind.io"
          />
        </div>
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Common monitoring workflows">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="Run Check Now"
            description="Trigger immediate visibility check"
            onClick={() => alert("Running check...")}
            icon="refresh"
          />
          <QuickAction
            title="Create Alert Rule"
            description="Set up custom mention/citation alerts"
            href="/dashboard/mention-alerts"
            icon="bell"
          />
          <QuickAction
            title="Generate Report"
            description="Instant weekly/monthly report"
            href="/dashboard/weekly-reports"
            icon="file-text"
          />
          <QuickAction
            title="Export All Data"
            description="Full CSV export of workspace data"
            href="/dashboard/exports"
            icon="download"
          />
        </div>
      </Panel>
    </div>
  );
}