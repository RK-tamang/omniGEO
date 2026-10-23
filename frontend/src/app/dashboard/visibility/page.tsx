"use client";

import { useState } from "react";
import type { JSX } from "react";
import { DashboardHeader, Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { visibilityPoints } from "@/lib/workspace-data";

const VISIBILITY_TOOLS = [
  {
    id: "tracker",
    name: "AI Visibility Tracker",
    description: "Measures brand presence in AI-generated answers across ChatGPT, Perplexity, Gemini, and AI Overviews",
    priority: "P1",
    status: "active",
  },
  {
    id: "prompt-research",
    name: "Prompt Research",
    description: "Discovers questions people ask AI about your niche — real-time conversational queries",
    priority: "P1",
    status: "active",
  },
  {
    id: "prompt-tracking",
    name: "Prompt Tracking",
    description: "Monitors a saved set of prompts over time — daily/weekly visibility trends",
    priority: "P1",
    status: "active",
  },
  {
    id: "brand-mentions",
    name: "Brand Mention Monitor",
    description: "Finds direct and indirect brand mentions across all AI answer engines",
    priority: "P1",
    status: "active",
  },
  {
    id: "citations",
    name: "AI Citation Tracker",
    description: "Identifies which pages and domains are cited in AI answers for your tracked prompts",
    priority: "P1",
    status: "active",
  },
  {
    id: "share-of-voice",
    name: "AI Share of Voice",
    description: "Compares your brand mentions with competitors across tracked prompts",
    priority: "P1",
    status: "active",
  },
  {
    id: "answer-history",
    name: "AI Answer History",
    description: "Stores and compares past AI responses — tracks changes over time",
    priority: "P2",
    status: "active",
  },
  {
    id: "referrals",
    name: "AI Referral Analytics",
    description: "Tracks traffic referred by AI platforms where measurable (UTM, referrer headers)",
    priority: "P2",
    status: "beta",
  },
  {
    id: "sentiment",
    name: "Sentiment Analyzer",
    description: "Classifies positive, neutral, and negative brand mentions in AI answers",
    priority: "P2",
    status: "active",
  },
  {
    id: "geo-visibility",
    name: "Geographic Visibility Tracker",
    description: "Compares AI visibility results by market, region, or language",
    priority: "P2",
    status: "active",
  },
];

export default function VisibilityPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "tools" | "settings">("overview");
  const { data } = useWorkspaceData();

  const points = visibilityPoints(data);
  const visibilityScore = points.length ? points[points.length - 1].score : 0;
  const promptCount = data?.prompts?.length ?? 0;
  const citationCount = data?.citations?.length ?? 0;
  const competitorCount = data?.competitors?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title="AI Search Visibility"
        sub="Unified visibility suite — track, discover, and optimize AI presence"
        aside={
          <>
            <Button variant="secondary">Export Report</Button>
            <Button onClick={() => window.open("/dashboard/prompt-research", "_blank")}>
              Run Prompt Research
            </Button>
          </>
        }
      />

      {/* Overview KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Visibility Score" value={visibilityScore} delta={0} unit="pts" />
        <KpiCard label="Tracked Prompts" value={promptCount} delta={0} />
        <KpiCard label="Citations Recorded" value={citationCount} delta={0} />
        <KpiCard label="Competitors Tracked" value={competitorCount} delta={0} />
      </div>

      {/* Tool Grid */}
      <Panel title="Visibility Tools" sub="All tools in one unified interface — click to open" level={2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VISIBILITY_TOOLS.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </Panel>

      {/* Quick Actions */}
      <Panel title="Quick Actions" sub="Common visibility workflows" level={2}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="Discover New Prompts"
            description="Run Prompt Research for a topic"
            href="/dashboard/prompt-research"
            icon="search"
          />
          <QuickAction
            title="Track Competitor Prompts"
            description="Add competitor prompts to monitoring"
            href="/dashboard/prompt-tracking"
            icon="target"
          />
          <QuickAction
            title="Check Citations"
            description="See which pages AI cites for your brand"
            href="/dashboard/citations"
            icon="link"
          />
          <QuickAction
            title="Compare Share of Voice"
            description="Benchmark against competitors"
            href="/dashboard/share-of-voice"
            icon="users"
          />
        </div>
      </Panel>

      {/* Visibility Trend */}
      <Panel title="Visibility Trend (30 days)" sub="AI Visibility Score across all tracked prompts" level={2}>
        <div className="h-64 flex items-end justify-between gap-2 px-2 pb-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-iris/20 rounded-t transition-colors hover:bg-iris/40"
              /* Deterministic pseudo-random heights — Math.random() here would
                 differ between server and client render and break hydration. */
              style={{ height: `${30 + ((i * 37) % 50)}%` }}
              title={`Day ${i + 1}: ${55 + ((i * 13) % 20)}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-mist mt-4">
          <span>Last 30 days</span>
          <span className="text-chalk font-medium">Avg: 68</span>
        </div>
      </Panel>
    </div>
  );
}

function KpiCard({ label, value, delta, unit }: { label: string; value: string | number; delta?: number; unit?: string }) {
  const up = (delta ?? 0) > 0;
  return (
    <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
      <p className="text-sm text-mist">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-chalk">{value}</span>
        {unit && <span className="text-sm text-mist">{unit}</span>}
      </div>
      {delta !== undefined && (
        <p className="mt-2 flex items-center gap-1 font-mono text-xs">
          <span className={up ? "text-mint" : "text-coral"}>{up ? "↑" : "↓"} {Math.abs(delta)}</span>
          <span className="text-mist-dim">vs last period</span>
        </p>
      )}
    </div>
  );
}

function ToolCard({ tool }: { tool: typeof VISIBILITY_TOOLS[0] }) {
  const priorityColors = {
    P1: "bg-coral/15 text-coral border-coral/30",
    P2: "bg-gold/15 text-gold border-gold/30",
  };
  const statusColors = {
    active: "bg-mint/15 text-mint border-mint/30",
    beta: "bg-aqua/15 text-aqua border-aqua/30",
    planned: "bg-mist/15 text-mist border-mist/30",
  };

  return (
    <div className="group bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-transparent hover:border-iris/20 hover:bg-surface/80 transition-all elevate-hover">
      <div className="flex items-start justify-between mb-3">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${priorityColors[tool.priority as "P1" | "P2"]}`}>
          {tool.priority}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${statusColors[tool.status as "active" | "beta" | "planned"]}`}>
          {tool.status}
        </span>
      </div>
      <h3 className="font-medium text-chalk group-hover:text-iris transition-colors mb-2">{tool.name}</h3>
      <p className="text-sm text-mist mb-4">{tool.description}</p>
      <div className="flex items-center justify-between pt-3 border-t border-line/50">
        <span className="text-xs text-mist-dim">Open tool →</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-iris">→</span>
      </div>
    </div>
  );
}

function QuickAction({ title, description, href, icon }: { title: string; description: string; href: string; icon: string }) {
  const icons: Record<string, JSX.Element> = {
    search: <SearchIcon />,
    target: <TargetIcon />,
    link: <LinkIcon />,
    users: <UsersIcon />,
  };

  return (
    <a
      href={href}
      className="group bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border border-transparent hover:border-iris/20 hover:bg-surface/80 transition-all elevate-hover"
    >
      <div className="flex items-start justify-between">
        <div className="text-iris text-xl">{icons[icon]}</div>
      </div>
      <h4 className="mt-3 font-medium text-chalk group-hover:text-iris transition-colors">{title}</h4>
      <p className="mt-1 text-sm text-mist">{description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-mist-dim">Open →</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-iris">→</span>
      </div>
    </a>
  );
}

function SearchIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>;
}
function TargetIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></svg>;
}
function LinkIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
}
function UsersIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}