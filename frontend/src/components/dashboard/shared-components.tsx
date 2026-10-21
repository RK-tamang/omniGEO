"use client";

import type { ReactNode, JSX } from "react";
import { ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export interface QuickActionProps {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  icon: string;
}

export function KpiCard({
  label,
  value,
  delta,
  unit,
  invert,
}: {
  label: string;
  value: string | number;
  delta?: number;
  unit?: string;
  invert?: boolean;
}) {
  const up = (delta ?? 0) > 0;
  const good = invert ? !up : up;
  return (
    <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5">
      <p className="text-sm text-mist">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-chalk">{value}</span>
        {unit && <span className="text-sm text-mist">{unit}</span>}
      </div>
      {delta !== undefined && (
        <p className="mt-2 flex items-center gap-1 font-mono text-xs">
          <span className={good ? "text-mint" : "text-coral"}>{up ? "↑" : "↓"} {Math.abs(delta)}</span>
          <span className="text-mist-dim">vs last period</span>
        </p>
      )}
    </div>
  );
}

export function ToolCard({ tool, statusColors, categoryColors }: {
  tool: { name: string; description: string; status: string; category?: string };
  statusColors: Record<string, string>;
  categoryColors?: Record<string, string>;
}) {
  return (
    <div className="group bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-transparent hover:border-iris/20 hover:bg-surface/80 transition-all elevate-hover">
      <div className="flex items-start justify-between mb-3">
        {tool.category && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${categoryColors?.[tool.category] || "bg-gray/15 text-gray border-gray/30"}`}>
            {tool.category}
          </span>
        )}
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

export function AlertItem({ type, severity, title, description, time, action, href }: { type: string; severity: "Critical" | "Warning" | "Notice"; title: string; description: string; time: string; action: string; href: string }) {
  const severityColors = {
    Critical: "bg-coral/15 text-coral border-coral/30",
    Warning: "bg-gold/15 text-gold border-gold/30",
    Notice: "bg-aqua/15 text-aqua border-aqua/30",
  };

  return (
    <a href={href} className="group flex items-start gap-4 p-4 bg-surface/40 rounded-xl hover:bg-surface/60 transition-colors">
      <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${severityColors[severity]}`}>
        {severity}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-chalk group-hover:text-iris transition-colors">{title}</p>
        <p className="mt-1 text-sm text-mist">{description}</p>
      </div>
      <span className="text-sm text-mist-dim font-mono">{time}</span>
      <span className="px-3 py-1 text-xs font-medium text-iris/80 hover:text-iris rounded-lg bg-iris/10 group-hover:bg-iris/20 transition-colors">{action}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-iris">→</span>
    </a>
  );
}

export function ReportRow({ name, frequency, nextRun, format, status, recipients }: { name: string; frequency: string; nextRun: string; format: string; status: "Active" | "Paused"; recipients: string }) {
  const statusColors = {
    Active: "bg-mint/15 text-mint border-mint/30",
    Paused: "bg-mist/15 text-mist border-mist/30",
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-surface/40 rounded-xl">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-chalk">{name}</h4>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest ${statusColors[status]}`}>
            {status}
          </span>
        </div>
        <p className="mt-1 text-sm text-mist">{recipients}</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-mist">
        <span className="flex items-center gap-1"><span className="text-mist-dim">⏰</span> {frequency}</span>
        <span className="flex items-center gap-1"><span className="text-mist-dim">📅</span> {nextRun}</span>
        <span className="flex items-center gap-1"><span className="text-mist-dim">📄</span> {format}</span>
      </div>
    </div>
  );
}

export function IssueRow({ severity, title, description, count, href }: { severity: "Critical" | "Warning" | "Notice"; title: string; description: string; count: string; href: string }) {
  const severityColors = {
    Critical: "bg-coral/15 text-coral border-coral/30",
    Warning: "bg-gold/15 text-gold border-gold/30",
    Notice: "bg-aqua/15 text-aqua border-aqua/30",
  };

  return (
    <a href={href} className="group flex items-start gap-4 p-4 bg-surface/40 rounded-xl hover:bg-surface/60 transition-colors">
      <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${severityColors[severity]}`}>
        {severity}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-chalk group-hover:text-iris transition-colors">{title}</p>
        <p className="mt-1 text-sm text-mist">{description}</p>
      </div>
      <span className="text-sm text-mist-dim font-mono">{count}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-iris">→</span>
    </a>
  );
}

export function QuickAction({ title, description, href, onClick, icon }: QuickActionProps) {
  const icons: Record<string, JSX.Element> = {
    search: <SearchIcon />,
    target: <TargetIcon />,
    link: <LinkIcon />,
    users: <UsersIcon />,
    clipboard: <ClipboardIcon />,
    bot: <BotIcon />,
    "file-text": <FileTextIcon />,
    code: <CodeIcon />,
    "git-compare": <GitCompareIcon />,
    "external-link": <ExternalLinkIcon />,
    "trending-up": <TrendingUpIcon />,
    refresh: <RefreshIcon />,
    bell: <BellIcon />,
    download: <DownloadIcon />,
    "message-square": <MessageSquareIcon />,
    "file-plus": <FilePlusIcon />,
    sparkles: <SparklesIcon />,
    pen: <PenIcon />,
  };

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="text-iris text-xl">{icons[icon]}</div>
      </div>
      <h4 className="mt-3 font-medium text-chalk group-hover:text-iris transition-colors">{title}</h4>
      <p className="mt-1 text-sm text-mist">{description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-mist-dim">{href ? "Open" : onClick ? "Run" : "Configure"} →</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-iris">→</span>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} className="group bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border border-transparent hover:border-iris/20 hover:bg-surface/80 transition-all elevate-hover">
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <Button onClick={onClick} className="group bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border border-transparent hover:border-iris/20 hover:bg-surface/80 transition-all elevate-hover w-full">
        {content}
      </Button>
    );
  }

  return (
    <div className="group bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-4 border border-transparent hover:border-iris/20 hover:bg-surface/80 transition-all elevate-hover">
      {content}
    </div>
  );
}

// Icon components
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
function ClipboardIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>;
}
function BotIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h12M6 12h12M6 16h8" /><path d="M4 12v8" /><path d="M20 12v8" /></svg>;
}
function FileTextIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="12" y2="18" /></svg>;
}
function CodeIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
}
function GitCompareIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" /></svg>;
}
function ExternalLinkIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}
function TrendingUpIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 18 23 18 23 12" /></svg>;
}
function RefreshIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M21 12a9 9 0 1 1-9 9 9.75 9.75 0 0 1 6.74-2.74L21 16" /></svg>;
}
function BellIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}
function DownloadIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
function MessageSquareIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function FilePlusIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v6h6" /><path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>;
}
function SparklesIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18M17 5l-5 5 5 5M7 19l5-5-5-5" /></svg>;
}
function PenIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /><path d="M15 2v20" /></svg>;
}

export function CompetitorToolCard({ tool }: { tool: { name: string; description: string; status: string } }) {
  const statusColors = {
    active: "bg-mint/15 text-mint border-mint/30",
    beta: "bg-aqua/15 text-aqua border-aqua/30",
    planned: "bg-mist/15 text-mist border-mist/30",
  };
  return <ToolCard tool={tool} statusColors={statusColors} />;
}

export function MonitoringToolCard({ tool }: { tool: { name: string; description: string; status: string; category: string } }) {
  const categoryColors = {
    monitor: "bg-iris/15 text-iris border-iris/30",
    alert: "bg-coral/15 text-coral border-coral/30",
    report: "bg-mint/15 text-mint border-mint/30",
    export: "bg-gold/15 text-gold border-gold/30",
    integration: "bg-aqua/15 text-aqua border-aqua/30",
  };
  const statusColors = {
    active: "bg-mint/15 text-mint border-mint/30",
    beta: "bg-aqua/15 text-aqua border-aqua/30",
    planned: "bg-mist/15 text-mist border-mist/30",
    paused: "bg-gray/15 text-gray border-gray/30",
  };
  return <ToolCard tool={tool} statusColors={statusColors} categoryColors={categoryColors} />;
}

export function ContentToolCard({ tool }: { tool: { name: string; description: string; status: string; category: string } }) {
  const categoryColors = {
    create: "bg-iris/15 text-iris border-iris/30",
    optimize: "bg-mint/15 text-mint border-mint/30",
    plan: "bg-aqua/15 text-aqua border-aqua/30",
    audit: "bg-gold/15 text-gold border-gold/30",
    research: "bg-coral/15 text-coral border-coral/30",
    technical: "bg-purple/15 text-purple border-purple/30",
    test: "bg-pink/15 text-pink border-pink/30",
    manage: "bg-gray/15 text-gray border-gray/30",
  };
  const statusColors = {
    active: "bg-mint/15 text-mint border-mint/30",
    beta: "bg-aqua/15 text-aqua border-aqua/30",
    planned: "bg-mist/15 text-mist border-mist/30",
  };
  return <ToolCard tool={tool} statusColors={statusColors} categoryColors={categoryColors} />;
}

export function VisibilityToolCard({ tool }: { tool: { name: string; description: string; priority: string; status: string } }) {
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