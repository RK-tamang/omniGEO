"use client";

import type { JSX } from "react";
import { Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">Dashboard</h1>
          <p className="mt-1 text-sm text-mist">Unified GEO command center — all tools, one view</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => window.open("/scan", "_blank")}>
            Run Free Scan
          </Button>
          <Button variant="secondary" onClick={() => window.open("/dashboard/geo-audit", "_self")}>
            Full GEO Audit
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="AI Visibility Score" value="68" delta={8} unit="pts" hint="vs last week" />
        <KpiCard label="Tracked Prompts" value="34" delta={12} unit="prompts" hint="12 new this month" />
        <KpiCard label="Citations Won" value="127" delta={23} unit="cites" hint="23 new this week" />
        <KpiCard label="Competitors Tracked" value="8" delta={2} unit="comps" hint="2 new added" />
      </div>

      {/* Category Quick Access */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CategoryCard
          title="AI Search Visibility"
          description="10 tools"
          href="/dashboard/visibility"
          icon="chart"
          color="text-iris"
        />
        <CategoryCard
          title="GEO Website Audit"
          description="11 tools"
          href="/dashboard/geo-audit"
          icon="clipboard"
          color="text-aqua"
        />
        <CategoryCard
          title="Competitor Intelligence"
          description="8 tools"
          href="/dashboard/competitors"
          icon="users"
          color="text-gold"
        />
        <CategoryCard
          title="AI Content Optimization"
          description="11 tools"
          href="/dashboard/geo-writer"
          icon="pen"
          color="text-mint"
        />
        <CategoryCard
          title="Monitoring & Reporting"
          description="10 tools"
          href="/dashboard/scheduled-checks"
          icon="calendar"
          color="text-coral"
        />
      </div>

      {/* Latest Activity */}
      <Panel title="Latest Activity" sub="Recent scans, optimizations, and alerts">
        <div className="space-y-3">
          <ActivityItem
            type="scan"
            title="Free AI Scan completed"
            description="acme-roofing.io — Score: 68, 41 pages crawled"
            time="2 min ago"
            status="Good"
          />
          <ActivityItem
            type="optimization"
            title="Content optimization applied"
            description="GEO Writer: 'Best CRM for Small Business' — +3 citations"
            time="15 min ago"
            status="Good"
          />
          <ActivityItem
            type="alert"
            title="Citation lost alert"
            description="Competitor 'HubSpot' overtook citation for 'best CRM 2024'"
            time="1 hour ago"
            status="Warning"
          />
          <ActivityItem
            type="report"
            title="Weekly GEO Report ready"
            description="PDF & CSV exported — 12 new prompts discovered"
            time="3 hours ago"
            status="Notice"
          />
        </div>
      </Panel>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Prompts Discovered"
          value="1,247"
          trend="+8%"
          color="iris"
          description="This month via Prompt Research"
        />
        <StatCard
          label="Pages Audited"
          value="41,230"
          trend="+12%"
          color="aqua"
          description="Across all workspaces"
        />
        <StatCard
          label="Citations Tracked"
          value="3,892"
          trend="+5%"
          color="mint"
          description="Weekly citation monitoring"
        />
        <StatCard
          label="Competitor Gaps"
          value="234"
          trend="-3%"
          color="gold"
          description="Opportunities identified"
        />
      </div>
    </div>
  );
}

function CategoryCard({ title, description, href, icon, color }: { title: string; description: string; href: string; icon: string; color: string }) {
  const icons: Record<string, JSX.Element> = {
    chart: <ChartIcon />,
    clipboard: <ClipboardIcon />,
    users: <UsersIcon />,
    pen: <PenIcon />,
    calendar: <CalendarIcon />,
  };

  return (
    <a
      href={href}
      className="group bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 transition-all hover:bg-surface/80 elevate-hover"
    >
      <div className="flex items-start justify-between">
        <div className={`${color} text-xl`}>{icons[icon]}</div>
        <span className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{description}</span>
      </div>
      <h3 className="mt-4 font-medium text-chalk group-hover:text-iris transition-colors">{title}</h3>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-mist-dim">Open →</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
      </div>
    </a>
  );
}

function ActivityItem({ type, title, description, time, status }: { type: string; title: string; description: string; time: string; status: "Good" | "Warning" | "Notice" }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-surface/40 rounded-xl transition-colors hover:bg-surface/60">
      <div className="flex-shrink-0 size-10 rounded-xl bg-surface/80 flex items-center justify-center">
        <StatusChip status={status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-chalk">{title}</p>
        <p className="mt-1 text-sm text-mist">{description}</p>
      </div>
      <span className="text-xs text-mist-dim whitespace-nowrap">{time}</span>
    </div>
  );
}

function StatCard({ label, value, trend, color, description }: { label: string; value: string; trend: string; color: string; description: string }) {
  return (
    <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
      <p className="text-sm text-mist">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-chalk">{value}</p>
      <p className="mt-2 flex items-center gap-1 text-sm">
        <span className={`text-${color}`}>{trend}</span>
        <span className="text-mist-dim">{description}</span>
      </p>
    </div>
  );
}

// Icon components
function ChartIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M7 16l3-3 2 2 4-5 4 4" /></svg>;
}
function ClipboardIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>;
}
function UsersIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function PenIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /><path d="M15 2v20" /></svg>;
}
function CalendarIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}