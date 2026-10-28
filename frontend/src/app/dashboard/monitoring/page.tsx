"use client";

import { useState } from "react";
import { Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { KpiCard, QuickAction, MonitoringToolCard, AlertItem, ReportRow } from "@/components/dashboard/shared-components";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

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
  const { data } = useWorkspaceData();

  const alerts = (data?.alerts ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    severity: (["Critical", "Warning", "Notice"] as const).includes(a.severity as never)
      ? (a.severity as "Critical" | "Warning" | "Notice")
      : ("Notice" as const),
    title: a.title,
    description: a.description,
    time: a.createdAt
      ? new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "recently",
  }));

  const reports = (data?.reports ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    format: r.format,
    status: r.status,
    when: r.createdAt
      ? new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "recently",
  }));

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
        <KpiCard label="Active Alerts" value={alerts.length} delta={0} invert unit="unread" />
        <KpiCard label="Scheduled Checks" value={data?.scans?.length ?? 0} delta={0} unit="runs" />
        <KpiCard label="Reports Generated" value={reports.length} delta={0} />
        <KpiCard label="Crawls Recorded" value={data?.crawls?.length ?? 0} delta={0} />
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
      <Panel title="Alert Center" sub="Recent alerts requiring attention" level={2}>
        {alerts.length === 0 ? (
          <EmptyState
            title="No alerts raised"
            sub="Alerts fire when a citation is lost, a competitor appears or your visibility drops. Every alert this workspace has raised is listed here."
          />
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <AlertItem
                key={a.id}
                type={a.type}
                severity={a.severity}
                title={a.title}
                description={a.description}
                time={a.time}
                action="View"
                href="/dashboard/monitoring"
              />
            ))}
          </div>
        )}
      </Panel>

      {/* Upcoming Reports */}
      <Panel title="Upcoming Reports" sub="Scheduled automated reports" level={2}>
        {reports.length === 0 ? (
          <EmptyState
            title="No reports scheduled"
            sub="Reports are generated on the cadence you set in Settings. Each generated report is listed here with its format and status."
          />
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <ReportRow
                key={r.id}
                name={r.name}
                frequency={r.type}
                nextRun={r.when}
                format={r.format}
                status={r.status === "paused" ? "Paused" : "Active"}
                recipients="—"
              />
            ))}
          </div>
        )}
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Common monitoring workflows" level={2}>
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
