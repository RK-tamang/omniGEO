"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Bars, ColumnChart, DonutGauge } from "@/components/dashboard/charts";
import { VisibilityTrend } from "@/components/dashboard/visibility-trend";
import { IssuesList } from "@/components/dashboard/issues-list";
import { CrawlerBots } from "@/components/dashboard/crawler-bots";
import { ContentTable } from "@/components/dashboard/content-table";
import { PromptMatrix } from "@/components/dashboard/prompt-matrix";
import { EmptyState } from "@/components/ui/empty-state";
import { DASHBOARD_BLOCKS } from "@/lib/dashboard-layout";
import { useWorkspaceData, type WorkspaceData } from "@/hooks/use-workspace-data";
import {
  mergeActivity,
  mergeAudit,
  mergeContentGaps,
  mergeContentItems,
  mergeEngineMentionRate,
  mergeOpportunities,
  mergeOverviewKpis,
  mergePrompts,
  mergeShareOfVoice,
  mergeVisibilityTrend,
} from "@/lib/workspace-data";

/**
 * Renders the dashboard home from an ordered list of block ids.
 *
 * The home page is assembled rather than fixed: a workspace picks which
 * blocks it shows and in what order (see `@/lib/dashboard-layout`). Unknown
 * ids are skipped, so an older saved layout still renders.
 *
 * Every figure in a block is read from the workspace's own tracked data — a
 * block with nothing to show renders an empty state, not a placeholder.
 */
export function DashboardBlocks({
  blocks,
  onCustomize,
}: {
  blocks: string[];
  onCustomize?: () => void;
}) {
  const known = useMemo(() => new Set(DASHBOARD_BLOCKS.map((b) => b.id)), []);
  const ordered = blocks.filter((id) => known.has(id));
  // Live rows from the backend.
  const { data } = useWorkspaceData();

  if (ordered.length === 0) {
    return (
      <Panel level={2} title="Your dashboard is empty" sub="Add blocks to see your workspace metrics here.">
        <NoBlocksState onCustomize={onCustomize} />
      </Panel>
    );
  }

  return (
    // `@container` makes the blocks lay out against their own width rather
    // than the viewport, so the same markup works in the full-width home
    // page, the narrow live preview and the sub-dashboard demo.
    <div className="@container space-y-6">
      {ordered.map((id) => (
        <div key={id}>
          <DashboardBlockView id={id} data={data} />
        </div>
      ))}
    </div>
  );
}

function DashboardBlockView({ id, data }: { id: string; data: WorkspaceData | null }) {
  switch (id) {
    case "kpis":
      return <KpisBlock data={data} />;
    case "trend":
      return <TrendBlock data={data} />;
    case "sov":
      return <SovBlock data={data} />;
    case "prompt-coverage":
      return <PromptCoverageBlock data={data} />;
    case "audit-score":
      return <AuditScoreBlock data={data} />;
    case "audit-issues":
      return <AuditIssuesBlock data={data} />;
    case "crawler-access":
      return <CrawlerAccessBlock />;
    case "competitor-compare":
      return <CompetitorCompareBlock data={data} />;
    case "content-gaps":
      return <ContentGapsBlock data={data} />;
    case "content-pipeline":
      return <ContentPipelineBlock data={data} />;
    case "opportunities":
      return <OpportunitiesBlock data={data} />;
    case "alerts":
      return <AlertsBlock data={data} />;
    case "schedule":
      return <ScheduleBlock data={data} />;
    case "activity":
      return <ActivityBlock data={data} />;
    case "tool-categories":
      return <ToolCategoriesBlock />;
    default:
      return null;
  }
}

function NoBlocksState({ onCustomize }: { onCustomize?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="max-w-sm text-sm text-mist">
        Every block is hidden. Turn one on to start tracking what matters to you.
      </p>
      {onCustomize && (
        <button
          type="button"
          onClick={onCustomize}
          className="rounded-full bg-gradient-to-r from-iris to-aqua px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Choose blocks
        </button>
      )}
    </div>
  );
}

/* --------------------------------- Visibility blocks -------------------------------- */

function KpisBlock({ data }: { data: WorkspaceData | null }) {
  const kpis = mergeOverviewKpis(data);
  return (
    <div className="grid gap-4 @sm:grid-cols-2 @3xl:grid-cols-4">
      {kpis.map((k) => (
        <KpiCard
          key={k.label}
          label={k.label}
          value={k.value}
          delta={k.delta}
          unit={k.unit}
          hint={k.hint}
          spark={k.spark}
          color={k.color}
        />
      ))}
    </div>
  );
}

function TrendBlock({ data }: { data: WorkspaceData | null }) {
  const { series, labels } = mergeVisibilityTrend(data);
  return (
    <Panel level={2} title="Visibility trend" sub="Mention rate across every tracked engine, from your own scans">
      <VisibilityTrend series={series} labels={labels} />
    </Panel>
  );
}

function SovBlock({ data }: { data: WorkspaceData | null }) {
  const sov = mergeShareOfVoice(data);
  const mention = mergeEngineMentionRate(data);

  if (sov.length === 0) {
    return (
      <Panel level={2} title="Share of voice" sub="Weighted by search volume across tracked terms">
        <EmptyState
          title="No competitors tracked yet"
          sub="Add the brands buyers compare you against and this shows who takes the answers."
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 @4xl:grid-cols-[1fr_1.2fr]">
      <Panel level={2} title="Share of voice" sub="Weighted by search volume across tracked terms">
        <div className="flex flex-col items-center gap-6">
          <DonutGauge value={sov[0]?.value ?? 0} label="Your share" />
          <Bars
            items={sov.map((s) => ({
              label: s.name,
              value: s.value,
              color: s.you ? "#3e7cb0" : "#4a5c6a",
              emphasis: s.you,
            }))}
          />
        </div>
      </Panel>
      <Panel level={2} title="Engine mention rate" sub="Each engine reads the web differently">
        {mention.length === 0 ? (
          <EmptyState title="No prompt results yet" sub="Run a visibility scan to populate this." />
        ) : (
          <div className="space-y-5">
            {mention.map((e) => (
              <div key={e.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="capitalize text-mist">{e.key === "aio" ? "AI Overviews" : e.key}</span>
                  <span className="font-mono text-xs text-chalk">{e.value}%</span>
                </div>
                <ScoreBar score={e.value} />
                <p className="mt-1 font-mono text-[0.62rem] text-mist-dim">
                  {e.change >= 0 ? "▲" : "▼"} {Math.abs(e.change)} pts vs last period
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function PromptCoverageBlock({ data }: { data: WorkspaceData | null }) {
  const rows = mergePrompts(data);
  const counts = { cited: 0, mentioned: 0, missing: 0 };
  for (const p of rows) {
    for (const status of Object.values(p.engines)) counts[status]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Panel level={2} title="Prompt coverage" sub="Every tracked prompt, across all four engines">
      {rows.length === 0 ? (
        <EmptyState
          title="No prompts tracked yet"
          sub="Add the questions your buyers ask AI and each one gets checked against every engine."
        />
      ) : (
        <>
          <div className="grid gap-4 @sm:grid-cols-3">
            {(
              [
                { key: "cited", label: "Cited", color: "#5fb98a" },
                { key: "mentioned", label: "Mentioned", color: "#39a0a8" },
                { key: "missing", label: "Missing", color: "#dc6e72" },
              ] as const
            ).map((s) => (
              <div key={s.key} className="rounded-2xl border border-line bg-surface/50 p-5">
                <p className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">{s.label}</p>
                <p className="mt-2 text-3xl font-semibold text-chalk">{counts[s.key]}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${total ? (counts[s.key] / total) * 100 : 0}%`, background: s.color }}
                  />
                </div>
                <p className="mt-2 text-xs text-mist-dim">
                  {total ? Math.round((counts[s.key] / total) * 100) : 0}% of {total} engine answers
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <PromptMatrix data={data} />
          </div>
        </>
      )}
    </Panel>
  );
}

/* ----------------------------------- Audit blocks ---------------------------------- */

function AuditScoreBlock({ data }: { data: WorkspaceData | null }) {
  const live = mergeAudit(data);

  if (live.checks === 0) {
    return (
      <Panel level={2} title="Site health" sub="Overall score across every audit category">
        <EmptyState
          title="No audit run yet"
          sub="Run a site audit and the health score, category breakdown and check results land here."
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 @4xl:grid-cols-[1fr_1.3fr]">
      <Panel level={2} title="Site health" sub="Overall score across every audit category">
        <div className="flex flex-col items-center gap-5">
          <DonutGauge value={live.score} label="Health score" />
          <div className="w-full space-y-3">
            {live.categories.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-mist">{c.name}</span>
                  <span className="font-mono text-mist-dim">{c.score}</span>
                </div>
                <ScoreBar score={c.score} />
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel level={2} title="Checks" sub={`${live.passed} of ${live.checks} checks passing`}>
        <ColumnChart
          items={[
            { label: "Passed", count: live.passed },
            { label: "Warned", count: live.warned },
            { label: "Failed", count: live.failed },
          ]}
        />
        <p className="mt-4 text-sm text-mist">
          {live.checks - live.passed} checks need attention. The full issue list is below.
        </p>
      </Panel>
    </div>
  );
}

function AuditIssuesBlock({ data }: { data: WorkspaceData | null }) {
  return (
    <Panel level={2} title="Open audit issues" sub="Grouped by severity, with the fix for each">
      <IssuesList issues={mergeAudit(data).issues} />
    </Panel>
  );
}

function CrawlerAccessBlock() {
  return (
    <Panel level={2} title="AI crawler access" sub="Which answer engines can read your pages">
      <CrawlerBots />
    </Panel>
  );
}

/* -------------------------------- Competitor blocks --------------------------------- */

function CompetitorCompareBlock({ data }: { data: WorkspaceData | null }) {
  const live = data?.competitors ?? [];
  const own = data?.workspace?.name ?? "Your brand";

  if (live.length === 0) {
    return (
      <Panel level={2} title="Competitor comparison" sub="Share of voice, mention rate and citation reach per brand">
        <EmptyState
          title="No competitors tracked yet"
          sub="Add the brands buyers compare you against and this table fills in from their tracked results."
        />
      </Panel>
    );
  }

  const brands = [
    {
      name: `${own} (you)`,
      you: true,
      sov: 0,
      mentionRate: 0,
      citationDomains: data?.citations?.length ?? 0,
    },
    ...live.map((c) => ({
      name: c.name,
      you: false,
      sov: c.visibilityScore ?? 0,
      mentionRate: 0,
      citationDomains: c.citationsCount ?? 0,
    })),
  ];

  return (
    <Panel level={2} title="Competitor comparison" sub="Share of voice, mention rate and citation reach per brand">
      <div className="grid gap-3 @sm:grid-cols-2">
        {brands.map((b) => (
          <div
            key={b.name}
            className={`rounded-2xl border p-4 ${
              b.you ? "border-iris/40 bg-iris/5" : "border-line bg-surface/50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-chalk">{b.name}</p>
              {b.you && (
                <span className="rounded-full bg-iris/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-iris">
                  You
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "SOV", value: `${b.sov}%` },
                { label: "Mentions", value: `${b.mentionRate}%` },
                { label: "Domains", value: b.citationDomains },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-display text-xl text-chalk">{s.value}</p>
                  <p className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ContentGapsBlock({ data }: { data: WorkspaceData | null }) {
  const gaps = mergeContentGaps(data);
  return (
    <Panel level={2} title="Content gaps" sub="Topics competitors own that you do not">
      {gaps.length === 0 ? (
        <EmptyState
          title="No content gaps detected"
          sub="Once competitors are tracked, the topics where they out-cite you are listed here."
        />
      ) : (
        <div className="space-y-3">
          {gaps.map((g) => (
            <div key={g.gap} className="rounded-2xl border border-line bg-surface/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-chalk">{g.gap}</p>
                  <p className="mt-1 text-sm text-mist">{g.detail}</p>
                </div>
                <StatusChip status={g.impact === "High" ? "Critical" : "Warning"} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------- Content blocks ---------------------------------- */

function ContentPipelineBlock({ data }: { data: WorkspaceData | null }) {
  const items = mergeContentItems(data);
  return (
    <Panel level={2} title="Content pipeline" sub="Drafts, reviews and published pieces">
      <ContentTable items={items} />
      {items.length > 0 && (
        <p className="mt-4 text-sm text-mist">
          {items.filter((c) => c.status === "In review").length} pieces are waiting on your approval.
        </p>
      )}
    </Panel>
  );
}

function OpportunitiesBlock({ data }: { data: WorkspaceData | null }) {
  const opportunities = mergeOpportunities(data);
  return (
    <Panel level={2} title="Top opportunities" sub="Ranked by impact and effort — start at the top">
      {opportunities.length === 0 ? (
        <EmptyState
          title="No open opportunities"
          sub="Prompts you are mentioned in but never cited show up here as the quickest wins."
        />
      ) : (
        <div className="space-y-3">
          {opportunities.map((o, i) => (
            <div key={o.prompt} className="flex items-start gap-4 rounded-2xl border border-line bg-surface/50 p-4">
              <span className="mt-0.5 font-mono text-[0.7rem] text-iris">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-chalk">{o.prompt}</p>
                <p className="mt-0.5 text-sm text-mist">{o.gap}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <span className="rounded-full bg-coral/12 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-widest text-coral">
                  {o.effort} effort
                </span>
                <span className="rounded-full bg-mint/12 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-widest text-mint">
                  {o.impact} impact
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------- Monitoring blocks -------------------------------- */

function AlertsBlock({ data }: { data: WorkspaceData | null }) {
  const live = data?.alerts ?? [];
  const alerts = live.map((a) => ({
    severity: (["Critical", "Warning", "Notice", "Good"] as const).includes(a.severity as never)
      ? (a.severity as "Critical" | "Warning" | "Notice" | "Good")
      : ("Notice" as const),
    title: a.title,
    description: a.description,
    time: a.createdAt
      ? new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "recently",
  }));

  return (
    <Panel level={2} title="Open alerts" sub="Everything that needs a decision">
      {alerts.length === 0 ? (
        <EmptyState
          title="No open alerts"
          sub="Alerts fire when a citation is lost, a competitor appears or your visibility drops."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div key={a.title} className="flex items-start gap-4 rounded-2xl border border-line bg-surface/50 p-4">
              <StatusChip status={a.severity} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-chalk">{a.title}</p>
                <p className="mt-0.5 text-sm text-mist">{a.description}</p>
              </div>
              <span className="shrink-0 text-xs text-mist-dim">{a.time}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ScheduleBlock({ data }: { data: WorkspaceData | null }) {
  const settings = data?.workspace?.settings ?? null;
  const rows = [
    { name: "Weekly prompt run", cadence: settings?.runDay ?? null, note: "Prompt visibility run" },
    { name: "Digest", cadence: settings?.digest ?? null, note: "Email digest cadence" },
    { name: "Timezone", cadence: settings?.timezone ?? null, note: "When runs are scheduled" },
  ];

  const configured = rows.filter((r) => r.cadence);

  return (
    <Panel level={2} title="Scheduled checks" sub="What runs next, and when">
      {configured.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          sub="Set a run day, digest cadence and timezone in Settings and the schedule appears here."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface/50 p-4"
            >
              <div>
                <p className="text-sm font-medium text-chalk">{r.name}</p>
                <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-mist-dim">
                  {r.cadence ?? "not set"}
                </p>
              </div>
              <span className="shrink-0 text-sm text-mist">{r.note}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ActivityBlock({ data }: { data: WorkspaceData | null }) {
  const activity = mergeActivity(data);
  return (
    <Panel level={2} title="Latest activity" sub="Recent scans, optimizations and alerts">
      {activity.length === 0 ? (
        <EmptyState
          title="No activity yet"
          sub="Every scan, report and alert this workspace records is listed here."
        />
      ) : (
        <div className="space-y-3">
          {activity.map((a, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl border border-line bg-surface/50 p-4">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  a.tone === "win" ? "bg-mint" : a.tone === "alert" ? "bg-coral" : "bg-aqua"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-chalk">{a.text}</p>
                <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-mist-dim">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ToolCategoriesBlock() {
  const categories = [
    { title: "AI Search Visibility", description: "10 tools", href: "/dashboard/visibility", icon: "chart", color: "text-iris" },
    { title: "GEO Website Audit", description: "11 tools", href: "/dashboard/geo-audit", icon: "clipboard", color: "text-aqua" },
    { title: "Competitor Intelligence", description: "8 tools", href: "/dashboard/competitors", icon: "users", color: "text-gold" },
    { title: "AI Content Optimization", description: "11 tools", href: "/dashboard/geo-writer", icon: "pen", color: "text-mint" },
    { title: "Monitoring & Reporting", description: "10 tools", href: "/dashboard/scheduled-checks", icon: "calendar", color: "text-coral" },
  ];

  return (
    <div className="grid gap-4 @sm:grid-cols-2 @3xl:grid-cols-5">
      {categories.map((c) => (
        <Link key={c.href} href={c.href} className="group">
          <div className="rounded-2xl border border-line bg-surface/60 p-5 transition-all hover:border-iris/30 hover:bg-surface/80">
            <div className="flex items-start justify-between">
              <span className={`text-xl ${c.color}`}>◈</span>
              <span className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{c.description}</span>
            </div>
            <h3 className="mt-4 font-medium text-chalk transition-colors group-hover:text-iris">{c.title}</h3>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-mist-dim">Open →</span>
              <span className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
