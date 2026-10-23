"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardBlocks } from "@/components/dashboard/dashboard-blocks";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { DASHBOARD_BLOCKS, DASHBOARD_BLOCK_GROUPS } from "@/lib/dashboard-layout";

/**
 * Sub-dashboard demos.
 *
 * The dashboard is split into five product areas. Each one has its own set
 * of blocks, and each one answers a different question — this page shows
 * what that area looks like when you assemble it on its own, so a team can
 * decide which blocks belong on their home screen.
 */
const GROUP_INTRO: Record<string, { question: string; blurb: string }> = {
  visibility: {
    question: "Do AI engines mention us?",
    blurb:
      "Prompt tracking, mention rate and share of voice across ChatGPT, Perplexity, Gemini and AI Overviews.",
  },
  audit: {
    question: "Can the engines read us at all?",
    blurb:
      "Crawlability, schema and entity clarity — the technical reasons a citation never happens.",
  },
  competitor: {
    question: "Who is winning the answers instead?",
    blurb: "Share of voice against tracked brands, and the topics they own that you do not.",
  },
  content: {
    question: "What do we publish next?",
    blurb: "The content pipeline, the gaps worth filling, and the fixes ranked by impact.",
  },
  monitoring: {
    question: "What changed, and what needs a decision?",
    blurb: "Alerts, scheduled runs and everything that moved in the last few days.",
  },
};

export default function SubDashboardDemoPage() {
  const [group, setGroup] = useState<string>(DASHBOARD_BLOCK_GROUPS[0].id);

  const blocks = useMemo(
    () => DASHBOARD_BLOCKS.filter((b) => b.group === group).map((b) => b.id),
    [group],
  );
  const intro = GROUP_INTRO[group];

  return (
    <div className="space-y-6">
      {/* Group selector */}
      <DashboardHeader
        title="Sub-dashboard demos"
        sub="Each area of the dashboard, shown on its own with the blocks it owns."
        aside={
          <Link
            href="/dashboard/customize"
            className="rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
          >
            Customise your dashboard →
          </Link>
        }
      />

      <p className="rounded-xl border border-line bg-surface/60 px-4 py-3 font-mono text-[0.62rem] leading-relaxed text-mist-dim">
        These panels are the live blocks, rendering this workspace&apos;s own tracked data. Anything the workspace has
        not tracked yet shows an empty state rather than a placeholder number.
      </p>

      <div className="flex flex-wrap gap-2">
        {DASHBOARD_BLOCK_GROUPS.map((g) => {
          const active = g.id === group;
          const count = DASHBOARD_BLOCKS.filter((b) => b.group === g.id).length;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition-all ${
                active
                  ? "border-iris/50 bg-iris/10 text-chalk"
                  : "border-line bg-surface/50 text-mist hover:border-line-strong hover:text-chalk"
              }`}
            >
              <span className="font-medium">{g.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[0.55rem] ${
                  active ? "bg-iris/20 text-iris" : "bg-surface-2 text-mist-dim"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* What this area answers */}
      <Panel title={intro.question} sub={intro.blurb} level={2}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_BLOCKS.filter((b) => b.group === group).map((b) => (
            <div key={b.id} className="rounded-xl border border-line bg-surface/50 p-4">
              <p className="text-sm font-medium text-chalk">{b.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-mist-dim">{b.description}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* The blocks, rendered for real */}
      <div className="space-y-6">
        {blocks.map((id) => (
          <div key={id}>
            <DashboardBlocks blocks={[id]} />
          </div>
        ))}
      </div>
    </div>
  );
}
