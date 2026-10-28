"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkline } from "@/components/dashboard/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import api from "@/lib/api-client";

export default function DashboardPage() {
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (projectId) {
        const res = await api.getDashboardOverview(projectId, { limit: 10, days: 30 });
        if (res.ok) {
          setOverview(res.data);
        } else {
          setError(res.error || "Failed to load overview");
        }
      } else {
        const res = await api.getOverview();
        if (res.ok) {
          setOverview(res.data);
        } else {
          setError(res.error || "Failed to load overview");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      try {
        const ws = await api.getWorkspaces();
        if (ws.ok && ws.data?.workspaces?.length > 0) {
          setProjectId(ws.data.workspaces[0].id);
        }
      } catch {}
    };
    init();
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const score = overview?.visibility_score ?? overview?.score ?? 0;
  const activePrompts = overview?.metrics?.active_prompts ?? 0;
  const totalObservations = overview?.metrics?.total_observations ?? overview?.observation_count ?? 0;
  const totalCitations = overview?.metrics?.total_citations ?? 0;
  const brandMentions = overview?.metrics?.brand_mentions ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="Dashboard Home" sub="Your GEO command center" accent="#3e7cb0" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCard key={i} label="Loading..." value="--" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="Dashboard Home" accent="#dc6e72" />
        <Panel title="Error" level={3} accent="#dc6e72">
          <p className="text-sm text-coral">{error}</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <section className="rounded-2xl border border-line bg-surface/50 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <DashboardHeader
              title="Dashboard Home"
              sub="GEO readiness, AI visibility, brand mentions, and citations — read from your workspace's own tracked data."
              accent="#3e7cb0"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Add First Project
            </Button>
            <Button size="sm">Run Full Audit</Button>
          </div>
        </div>
      </section>

      {/* Primary metric + KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Visibility score"
          value={score === 0 ? "—" : score}
          sub="Overall AI-readiness score from your latest scan"
          spark={[score - 12, score - 6, score, score + 3, score]}
          color="#3e7cb0"
        />
        <KpiCard
          label="Active prompts"
          value={activePrompts === 0 ? "—" : activePrompts}
          sub="Prompts tracked across engines"
          color="#39a0a8"
        />
        <KpiCard
          label="Observations"
          value={totalObservations === 0 ? "—" : totalObservations}
          sub="AI observations collected"
          color="#5fb98a"
        />
        <KpiCard
          label="Citations"
          value={totalCitations === 0 ? "—" : totalCitations}
          sub="Brand citations found"
          color="#dc6e72"
          invert={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Visibility Trend" level={2} accent="#3e7cb0" className="lg:col-span-2">
          <div className="h-[280px]">
            <Sparkline
              data={[activePrompts, totalObservations, totalCitations, brandMentions]}
              color="#3e7cb0"
              className="h-full w-full"
            />
          </div>
          <p className="mt-3 font-mono text-[0.62rem] text-mist-dim">
            Last 7 days · Eligible observations: {totalObservations === 0 ? "—" : totalObservations}
          </p>
        </Panel>

        <Panel title="GEO Readiness" level={2} accent="#39a0a8">
          <div className="h-[280px] flex items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="var(--color-line)" strokeWidth="8" fill="none" />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#3e7cb0"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray="440"
                  strokeDashoffset={(1 - score / 100) * 440}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-normal italic">{score === 0 ? "—" : score}%</span>
                <span className="font-mono text-[0.6rem] text-mist-dim">readiness</span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Quick Actions" level={2} accent="#5fb98a">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" size="sm" className="w-full">
              Run Visibility Scan
            </Button>
            <Button variant="outline" size="sm" className="w-full">
              Start GEO Audit
            </Button>
            <Button variant="outline" size="sm" className="w-full">
              Add Project
            </Button>
            <Button variant="outline" size="sm" className="w-full">
              Connect CMS
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Recent Activity" level={2} accent="#dc6e72">
        <EmptyState
          title="No recent activity"
          sub="Run a GEO audit or visibility scan to see activity here."
        />
      </Panel>
    </div>
  );
}
