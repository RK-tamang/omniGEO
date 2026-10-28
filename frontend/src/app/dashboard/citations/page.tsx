"use client";

import { useCallback, useMemo, useState } from "react";
import { DashboardHeader, Panel, ScoreBar, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaChart, Bars, DonutGauge } from "@/components/dashboard/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { type CitationObservation, type CitationsOverview } from "@/lib/citations";

type Tab = "overview" | "domains" | "pages" | "gaps";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Citation Overview",
  domains: "Top Domains",
  pages: "Cited Pages",
  gaps: "Citation Gaps",
};

const FILTER_ENGINES = ["OpenAI", "Gemini", "Perplexity", "AI Overviews"] as const;
const FILTER_METHODOLOGIES = [
  "Observed AI Search",
  "Grounded Model API",
  "Ungrounded Model API",
] as const;

type DomainRow = {
  domain: string;
  ownership: "customer_owned" | "competitor_owned" | "third_party" | "unknown";
  citingObservations: number;
  uniqueCitedUrls: number;
  uniquePrompts: number;
  engines: string[];
  lastSeen?: string | null;
};

type PageRow = {
  id: string;
  title?: string | null;
  url: string;
  domain: string;
  ownership: "customer_owned" | "competitor_owned" | "third_party" | "unknown";
  citingObservations: number;
  uniquePrompts: number;
  engines: string[];
  lastSeen?: string | null;
};

type GapRow = {
  id: string;
  prompt: string;
  engine: string;
  competitor: string;
  competitorUrl?: string | null;
  customerCited: boolean;
  priority: "high" | "medium" | "low";
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function domainColor(ownership: string): string {
  switch (ownership) {
    case "customer_owned":
      return "#5fb98a";
    case "competitor_owned":
      return "#dc6e72";
    default:
      return "#8a9aa3";
  }
}

export default function CitationsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("30d");
  const [engine, setEngine] = useState<string | null>(null);
  const [methodology, setMethodology] = useState<string | null>(null);
  const [loading, setLoading] = useState({ overview: false, domains: false, pages: false, gaps: false });
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [overview, setOverview] = useState<CitationsOverview | null>(null);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [domainsTotal, setDomainsTotal] = useState(0);
  const [pagesTotal, setPagesTotal] = useState(0);
  const [gapsTotal, setGapsTotal] = useState(0);

  const fetchOverview = useCallback(async () => {
    setLoading((s) => ({ ...s, overview: true }));
    setError(null);
    try {
      const qs = new URLSearchParams({ range, ...(engine ? { engine } : {}), ...(methodology ? { methodology } : {}) });
      const res = await fetch(`/api/visibility/citations/overview?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Overview failed: ${res.status}`);
      const data = await res.json();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load citation overview");
    } finally {
      setLoading((s) => ({ ...s, overview: false }));
    }
  }, [range, engine, methodology]);

  const fetchDomains = useCallback(async () => {
    setLoading((s) => ({ ...s, domains: true }));
    try {
      const qs = new URLSearchParams({
        limit: "50",
        offset: "0",
        ...(engine ? { engine } : {}),
      });
      const res = await fetch(`/api/visibility/citations/domains?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Domains failed: ${res.status}`);
      const data = await res.json();
      setDomains((data?.domains ?? []).map((d: any) => ({
        domain: d.domain,
        ownership: d.ownership ?? "third-party",
        citingObservations: d.citing_observations ?? d.citingObservations ?? 0,
        uniqueCitedUrls: d.unique_cited_urls ?? d.uniqueCitedUrls ?? 0,
        uniquePrompts: d.unique_prompts ?? d.uniquePrompts ?? 0,
        engines: d.engines ?? [],
        lastSeen: d.last_seen ?? d.lastSeen,
      })));
      setDomainsTotal(data?.total ?? data?.domains?.length ?? 0);
    } catch {
      setDomains([]);
      setDomainsTotal(0);
    } finally {
      setLoading((s) => ({ ...s, domains: false }));
    }
  }, [engine]);

  const fetchPages = useCallback(async () => {
    setLoading((s) => ({ ...s, pages: true }));
    try {
      const qs = new URLSearchParams({
        limit: "50",
        offset: "0",
        ...(engine ? { engine } : {}),
      });
      const res = await fetch(`/api/visibility/citations/pages?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Pages failed: ${res.status}`);
      const data = await res.json();
      setPages((data?.pages ?? []).map((p: any) => ({
        id: p.id,
        title: p.title ?? null,
        url: p.url,
        domain: p.domain,
        ownership: p.ownership ?? "third-party",
        citingObservations: p.citing_observations ?? p.citingObservations ?? 0,
        uniquePrompts: p.unique_prompts ?? p.uniquePrompts ?? 0,
        engines: p.engines ?? [],
        lastSeen: p.last_seen ?? p.lastSeen,
      })));
      setPagesTotal(data?.total ?? data?.pages?.length ?? 0);
    } catch {
      setPages([]);
      setPagesTotal(0);
    } finally {
      setLoading((s) => ({ ...s, pages: false }));
    }
  }, [engine]);

  const fetchGaps = useCallback(async () => {
    setLoading((s) => ({ ...s, gaps: true }));
    try {
      const qs = new URLSearchParams({
        limit: "50",
        offset: "0",
        ...(engine ? { engine } : {}),
      });
      const res = await fetch(`/api/visibility/citations/gaps?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Gaps failed: ${res.status}`);
      const data = await res.json();
      setGaps((data?.gaps ?? []).map((g: any) => ({
        id: g.id,
        prompt: g.prompt,
        engine: g.engine,
        competitor: g.competitor,
        competitorUrl: g.competitor_url ?? g.competitorUrl ?? null,
        customerCited: g.customer_cited ?? g.customerCited ?? false,
        priority: g.priority ?? "medium",
      })));
      setGapsTotal(data?.total ?? data?.gaps?.length ?? 0);
    } catch {
      setGaps([]);
      setGapsTotal(0);
    } finally {
      setLoading((s) => ({ ...s, gaps: false }));
    }
  }, [engine]);

  const activeFilter = engine || methodology;
  useMemo(() => {
    void fetchOverview();
    void fetchDomains();
    void fetchPages();
    void fetchGaps();
  }, [range, engine, methodology, fetchOverview, fetchDomains, fetchPages, fetchGaps]);

  const ownDomains = useMemo(() => domains.filter((d) => d.ownership === "customer_owned"), [domains]);
  const competitorDomains = useMemo(() => domains.filter((d) => d.ownership === "competitor_owned"), [domains]);
  const thirdPartyDomains = useMemo(() => domains.filter((d) => d.ownership === "third_party"), [domains]);

  const totalCitations = useMemo(
    () => domains.reduce((sum, d) => sum + d.citingObservations, 0),
    [domains],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Citations & Sources"
        sub="Which pages and domains are cited in AI answers for your tracked prompts"
        aside={
          <div className="flex items-center gap-3">
            <select
              defaultValue={range}
              onChange={(e) => setRange(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-mist focus:border-iris"
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
            <Button variant="ghost" size="sm">
              Run Visibility Scan
            </Button>
          </div>
        }
      />

      {error && (
        <Panel title="Data unavailable" level={2}>
          <div className="rounded-xl border border-coral/30 bg-coral/10 p-5">
            <p className="text-sm text-coral">{error}</p>
            <p className="mt-2 text-xs text-mist-dim">
              Make sure the backend is running and you have an active session.
            </p>
          </div>
        </Panel>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-line pb-4" role="tablist" aria-label="Citation views">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-iris text-chalk"
                  : "border-transparent text-mist-dim hover:text-mist"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <OverviewTab
          overview={overview}
          loading={loading.overview}
          trendData={overview?.trend ?? []}
          distribution={overview?.distribution ?? { own: 0, competitor: 0, thirdParty: 0 }}
          totalCitations={totalCitations}
        />
      )}
      {tab === "domains" && (
        <DomainsTab
          domains={domains}
          total={domainsTotal}
          loading={loading.domains}
          engine={engine ?? undefined}
          setEngine={setEngine}
        />
      )}
      {tab === "pages" && (
        <PagesTab
          pages={pages}
          total={pagesTotal}
          loading={loading.pages}
          engine={engine ?? undefined}
          setEngine={setEngine}
        />
      )}
      {tab === "gaps" && (
        <GapsTab gaps={gaps} total={gapsTotal} loading={loading.gaps} engine={engine ?? undefined} />
      )}
    </div>
  );
}

/* ---------- Tab: Overview ---------- */

function OverviewTab({
  overview,
  loading,
  trendData,
  distribution,
  totalCitations,
}: {
  overview: CitationsOverview | null;
  loading: boolean;
  trendData: any[];
  distribution: any;
  totalCitations: number;
}) {
  if (loading && !overview) {
    return (
      <Panel title="Citation Overview" level={2}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl elevate p-5 h-32 flex flex-col justify-center">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-mist-dim">—</p>
              <span className="font-display text-4xl font-normal italic text-mist-dim">—</span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (!overview) {
    return (
      <EmptyState
        title="No citation data yet"
        sub="Run a visibility scan to start tracking which pages and domains are cited in AI answers for your prompts."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Own-domain citation rate"
          value={`${overview.ownDomainCitationRate}%`}
          delta={0}
          unit=""
          hint="Share of tracked prompts that cite your domain"
          color="#3e7cb0"
        />
        <KpiCard
          label="Unique cited domains"
          value={overview.uniqueCitedDomains.toString()}
          delta={0}
          unit=""
          hint="Distinct domains cited across tracked prompts"
          color="#39a0a8"
        />
        <KpiCard
          label="Own pages cited"
          value={overview.uniqueOwnPagesCited.toString()}
          delta={0}
          unit=""
          hint="Pages from your domain appearing in AI answers"
          color="#5fb98a"
        />
        <KpiCard
          label="Competitor gaps"
          value={overview.competitorOnlyGaps.toString()}
          delta={0}
          unit=""
          hint="Prompts where competitors are cited but you are not"
          color="#dc6e72"
          invert
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend chart */}
        <Panel title="Citation trend" sub="Own vs competitor citation rate over time" level={2} className="lg:col-span-2">
          <div className="h-[320px]">
            {trendData.length === 0 ? (
              <EmptyState title="No trend data" sub="Run scans over multiple days to see citation trends." />
            ) : (
              <AreaChart
                series={[
                  { name: "Own domain", color: "#3e7cb0", data: trendData.map((t) => t.ownRate ?? 0) },
                  { name: "Competitors", color: "#dc6e72", data: trendData.map((t) => t.competitorRate ?? 0) },
                ]}
                labels={trendData.map((t) => t.date)}
                unit="%"
              />
            )}
          </div>
          <p className="mt-3 font-mono text-[0.62rem] text-mist-dim">
            Eligible observations: {overview.eligibleObservations}
          </p>
        </Panel>

        {/* Distribution */}
        <Panel title="Citation distribution" sub="Share of cited domains by ownership" level={2}>
          <div className="grid grid-cols-1 gap-6 items-center">
            <DonutGauge value={Math.round((distribution.customer_owned / Math.max(totalCitations, 1)) * 100)} label="Own domains" />
            <DonutGauge value={Math.round((distribution.competitor_owned / Math.max(totalCitations, 1)) * 100)} label="Competitors" />
            <DonutGauge value={Math.round((distribution.third_party / Math.max(totalCitations, 1)) * 100)} label="Third-party" />
          </div>
        </Panel>
      </div>

      {/* Recent citations preview */}
      <Panel title="Recent citations" sub="Most recent observed citations across tracked prompts" level={2}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                <th className="pb-3 pr-4 font-normal">Prompt</th>
                <th className="pb-3 pr-4 font-normal">Engine</th>
                <th className="pb-3 pr-4 font-normal">Cited domain</th>
                <th className="pb-3 pr-4 font-normal">URL</th>
                <th className="pb-3 font-normal">Captured</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  prompt: "What are the best CRM platforms for small business?",
                  engine: "OpenAI",
                  domain: "example.com",
                  url: "https://example.com/crm-guide",
                  captured: "2h ago",
                },
                {
                  prompt: "How does AI visibility compare with SEO?",
                  engine: "Perplexity",
                  domain: "competitor.io",
                  url: "https://competitor.io/ai-vs-seo",
                  captured: "5h ago",
                },
                {
                  prompt: "Top alternatives to Salesforce in 2025",
                  engine: "Gemini",
                  domain: "thirdparty.com",
                  url: "https://thirdparty.com/alternatives",
                  captured: "1d ago",
                },
              ].map((row, i) => (
                <tr key={i} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                  <td className="max-w-48 py-3 pr-4 truncate font-mono text-[0.68rem] text-mist-dim">{row.prompt}</td>
                  <td className="py-3 pr-4">
                    <StatusChip status="cited" />
                  </td>
                  <td className="py-3 pr-4 font-mono text-[0.68rem] text-chalk">{row.domain}</td>
                  <td className="py-3 pr-4 font-mono text-[0.64rem] text-mist-dim truncate max-w-48">{row.url}</td>
                  <td className="py-3 font-mono text-xs text-mist-dim">{row.captured}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[0.62rem] text-mist-dim">
          {totalCitations} total citations across {overview.uniqueCitedDomains} domains
        </p>
      </Panel>
    </div>
  );
}

/* ---------- Tab: Top Domains ---------- */

function DomainsTab({
  domains,
  total,
  loading,
  engine,
  setEngine,
}: {
  domains: DomainRow[];
  total: number;
  loading: boolean;
  engine?: string;
  setEngine: (v: string) => void;
}) {
  if (loading && domains.length === 0) {
    return (
      <Panel title="Top Domains" level={2}>
        <div className="h-64 flex items-center justify-center">
          <p className="font-mono text-xs text-mist-dim">Loading domains…</p>
        </div>
      </Panel>
    );
  }

  if (domains.length === 0) {
    return (
      <EmptyState
        title="No cited domains"
        sub="Run a visibility scan to discover which domains are cited in AI answers for your prompts."
      />
    );
  }

  const sorted = [...domains].sort((a, b) => b.citingObservations - a.citingObservations);

  return (
    <Panel title="Top Domains" sub={`${total} cited domains across tracked prompts`} level={2}>
      <div className="mb-4 flex flex-wrap gap-3" role="group" aria-label="Filter by ownership">
        {[
          { value: "customer_owned", label: "Own" },
          { value: "competitor_owned", label: "Competitor" },
          { value: "third_party", label: "Third-party" },
        ].map((o) => {
          const count = domains.filter((d) => d.ownership === o.value).length;
          const active = engine === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => setEngine(o.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-iris/50 bg-iris/15 text-chalk"
                  : "border-line text-mist hover:text-chalk"
              }`}
            >
              {o.label}
              <span className="ml-1.5 font-mono text-[0.6rem] text-mist-dim">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Domain</th>
              <th className="pb-3 pr-4 font-normal">Ownership</th>
              <th className="pb-3 pr-4 font-normal">Citations</th>
              <th className="pb-3 pr-4 font-normal">Unique URLs</th>
              <th className="pb-3 pr-4 font-normal">Prompts</th>
              <th className="pb-3 pr-4 font-normal">Engines</th>
              <th className="pb-3 font-normal">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.domain} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                <td className="max-w-48 py-3 pr-4 truncate font-mono text-[0.68rem] text-chalk">
                  {d.domain}
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                    d.ownership === "customer_owned"
                      ? "bg-mint/15 text-mint border-mint/30"
                      : d.ownership === "competitor_owned"
                        ? "bg-coral/15 text-coral border-coral/30"
                        : "bg-mist/15 text-mist border-mist/30"
                  }`}>
                    {d.ownership === "customer_owned" ? "Own" : d.ownership === "competitor_owned" ? "Competitor" : "Third-party"}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-chalk">{d.citingObservations}</td>
                <td className="py-3 pr-4 font-mono text-xs text-mist">{d.uniqueCitedUrls}</td>
                <td className="py-3 pr-4 font-mono text-xs text-mist">{d.uniquePrompts}</td>
                <td className="py-3 pr-4 font-mono text-[0.64rem] text-mist-dim truncate max-w-24">
                  {d.engines.join(", ") || "—"}
                </td>
                <td className="py-3 font-mono text-xs text-mist-dim">{formatDate(d.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---------- Tab: Cited Pages ---------- */

function PagesTab({
  pages,
  total,
  loading,
  engine,
  setEngine,
}: {
  pages: PageRow[];
  total: number;
  loading: boolean;
  engine?: string;
  setEngine: (v: string) => void;
}) {
  if (loading && pages.length === 0) {
    return (
      <Panel title="Cited Pages" level={2}>
        <div className="h-64 flex items-center justify-center">
          <p className="font-mono text-xs text-mist-dim">Loading pages…</p>
        </div>
      </Panel>
    );
  }

  if (pages.length === 0) {
    return (
      <EmptyState
        title="No cited pages"
        sub="Run a visibility scan to discover which specific pages are cited in AI answers."
      />
    );
  }

  const sorted = [...pages].sort((a, b) => b.citingObservations - a.citingObservations);

  return (
    <Panel title="Cited Pages" sub={`${total} unique pages cited across tracked prompts`} level={2}>
      <div className="mb-4 flex flex-wrap gap-3" role="group" aria-label="Filter by ownership">
        {[
          { value: "customer_owned", label: "Own" },
          { value: "competitor_owned", label: "Competitor" },
          { value: "third_party", label: "Third-party" },
        ].map((o) => {
          const count = pages.filter((p) => p.ownership === o.value).length;
          const active = engine === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => setEngine(o.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-iris/50 bg-iris/15 text-chalk"
                  : "border-line text-mist hover:text-chalk"
              }`}
            >
              {o.label}
              <span className="ml-1.5 font-mono text-[0.6rem] text-mist-dim">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Page title</th>
              <th className="pb-3 pr-4 font-normal">URL</th>
              <th className="pb-3 pr-4 font-normal">Domain</th>
              <th className="pb-3 pr-4 font-normal">Ownership</th>
              <th className="pb-3 pr-4 font-normal">Citations</th>
              <th className="pb-3 pr-4 font-normal">Prompts</th>
              <th className="pb-3 font-normal">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-line/70 transition-colors hover:bg-surface-1 cursor-pointer">
                <td className="max-w-48 py-3 pr-4 truncate font-mono text-[0.68rem] text-chalk">
                  {p.title ?? p.url.split("/").pop() ?? p.url}
                </td>
                <td className="py-3 pr-4 font-mono text-[0.64rem] text-mist-dim truncate max-w-40">
                  {p.url}
                </td>
                <td className="py-3 pr-4 font-mono text-[0.68rem] text-chalk">{p.domain}</td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                    p.ownership === "customer_owned"
                      ? "bg-mint/15 text-mint border-mint/30"
                      : p.ownership === "competitor_owned"
                        ? "bg-coral/15 text-coral border-coral/30"
                        : "bg-mist/15 text-mist border-mist/30"
                  }`}>
                    {p.ownership === "customer_owned" ? "Own" : p.ownership === "competitor_owned" ? "Competitor" : "Third-party"}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-chalk">{p.citingObservations}</td>
                <td className="py-3 pr-4 font-mono text-xs text-mist">{p.uniquePrompts}</td>
                <td className="py-3 font-mono text-xs text-mist-dim">{formatDate(p.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---------- Tab: Citation Gaps ---------- */

function GapsTab({
  gaps,
  total,
  loading,
  engine,
}: {
  gaps: GapRow[];
  total: number;
  loading: boolean;
  engine?: string;
}) {
  if (loading && gaps.length === 0) {
    return (
      <Panel title="Citation Gaps" level={2}>
        <div className="h-64 flex items-center justify-center">
          <p className="font-mono text-xs text-mist-dim">Loading gaps…</p>
        </div>
      </Panel>
    );
  }

  if (gaps.length === 0) {
    return (
      <EmptyState
        title="No citation gaps"
        sub="Citation gaps appear when competitors are cited in AI answers for prompts where your domain is not cited."
      />
    );
  }

  const priorityColor: Record<string, string> = {
    high: "#dc6e72",
    medium: "#d9a441",
    low: "#5fb98a",
  };

  return (
    <Panel title="Citation Gaps" sub={`${total} prompts where competitors are cited but your domain is not`} level={2}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
              <th className="pb-3 pr-4 font-normal">Prompt</th>
              <th className="pb-3 pr-4 font-normal">Engine</th>
              <th className="pb-3 pr-4 font-normal">Competitor</th>
              <th className="pb-3 pr-4 font-normal">Cited URL</th>
              <th className="pb-3 pr-4 font-normal">Customer cited</th>
              <th className="pb-3 font-normal">Priority</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.id} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                <td className="max-w-48 py-3 pr-4 truncate font-mono text-[0.68rem] text-mist-dim">
                  {g.prompt}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-chalk">{g.engine}</td>
                <td className="py-3 pr-4 font-mono text-[0.68rem] text-coral">{g.competitor}</td>
                <td className="py-3 pr-4 font-mono text-[0.64rem] text-mist-dim truncate max-w-32">
                  {g.competitorUrl ?? "—"}
                </td>
                <td className="py-3 pr-4">
                  <StatusChip status={g.customerCited ? "cited" : "missing"} />
                </td>
                <td className="py-3 font-mono text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                    g.priority === "high"
                      ? "bg-coral/15 text-coral border-coral/30"
                      : g.priority === "medium"
                        ? "bg-gold/15 text-gold border-gold/30"
                        : "bg-mint/15 text-mint border-mint/30"
                  }`}>
                    {g.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
        Focus on high-priority gaps first — these are prompts where competitors are cited but your
        domain is absent from AI answers.
      </p>
    </Panel>
  );
}

