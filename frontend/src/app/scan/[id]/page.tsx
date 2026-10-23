import type { Metadata } from "next";
import Link from "next/link";
import { buildScanReport } from "@/lib/scan-data";
import { ScoreRing } from "@/components/scan/score-ring";
import { ScanTabs, type TabDef } from "@/components/scan/scan-tabs";
import { AnswersPanel, CrawlersPanel, HealthPanel, PagesPanel, RivalsPanel } from "@/components/scan/panels";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { getScanReportData } from "@/server/scans";

export const metadata: Metadata = {
  title: "AI visibility scan",
  robots: { index: false, follow: false },
};

export default async function ScanReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { id } = await params;
  const { d } = await searchParams;
  const data = await getScanReportData(id, d);

  if (!data) {
    return (
      <div className="container-page space-y-6 py-16">
        <EmptyState
          title="This report is no longer available"
          sub="Scan reports are tied to the session that ran them. Start a new scan to get a fresh one."
          action={
            <Link
              href="/scan"
              className="rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Run a new scan
            </Link>
          }
        />
      </div>
    );
  }

  const report = buildScanReport({
    domain: data.domain || d || "",
    scanId: id,
    scans: data.scans,
    issues: data.issues,
    prompts: data.prompts,
    bots: data.bots,
  });

  const fixesNeeded = report.checks.filter((c) => c.status !== "pass").length;

  // Tab strip: titles only. Tabs 1–3 read for free; tabs 4–5 sit behind the
  // sign-up card.
  const tabs: TabDef[] = [
    { id: "pages", title: "Reading your pages" },
    { id: "health", title: "Site health" },
    { id: "crawlers", title: "AI crawlers" },
    { id: "answers", title: "AI answers", locked: true },
    { id: "competitors", title: "Competitors", locked: true },
  ];

  const panels = [
    <PagesPanel key="pages" r={report} />,
    <HealthPanel key="health" r={report} />,
    <CrawlersPanel key="crawlers" r={report} />,
    <AnswersPanel key="answers" r={report} />,
    <RivalsPanel key="competitors" r={report} />,
  ];

  // Score card — sits at the top of the workspace's right column. It carries the
  // domain and scan status so the page stays oriented without a hero heading.
  const scoreCard = (
    <div className="glass flex flex-col items-center rounded-3xl px-6 py-6">
      <div className="flex w-full items-center justify-between gap-2">
        <p className="truncate font-mono text-[0.62rem] uppercase tracking-widest text-mist" title={report.domain}>
          {report.domain}
        </p>
        <span className="shrink-0 rounded-full border border-aqua/40 bg-aqua/10 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-chalk">
          Scan complete
        </span>
      </div>

      <ScoreRing value={report.score} label="ai visibility" />

      <p className="rounded-full border border-line px-4 py-1.5 font-mono text-xs text-mist">
        Grade <span className="text-chalk">{report.grade}</span>
      </p>

      <dl className="mt-5 grid w-full grid-cols-2 gap-x-3 gap-y-3 border-t border-line pt-4">
        {[
          { label: "Pages", value: `${report.pagesCrawled}` },
          { label: "Checks fine", value: `${report.checks.length - fixesNeeded}/${report.checks.length}` },
          { label: "Time", value: report.duration },
          { label: "Scan id", value: report.scanId.slice(0, 8) },
        ].map((m) => (
          <div key={m.label}>
            <dt className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">{m.label}</dt>
            <dd className="mt-0.5 truncate font-mono text-[0.7rem] text-mist" title={m.value}>
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <>
      {/* Trimmed breadcrumb only — no hero heading; the report opens at the workspace */}
      <div className="container-page pt-8 lg:pt-10">
        <nav aria-label="Breadcrumb" className="font-mono text-[0.7rem] text-mist-dim">
          <Link href="/" className="hover:text-chalk">
            home
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <Link href="/scan" className="hover:text-chalk">
            scan
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-mist">{report.domain}</span>
        </nav>
      </div>

      {/* Tabbed report — tabs 1–3 read for free, the rest sit behind the sign-up gate */}
      <div className="container-page space-y-6 pb-20 pt-5">
        <ScanTabs tabs={tabs} panels={panels} score={scoreCard} />

        <Reveal>
          <div className="glass relative overflow-hidden rounded-3xl px-8 py-12 text-center sm:px-14">
              <div className="absolute inset-x-0 top-0 h-px strip-line" aria-hidden />
            <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">
              This was one scan. The workspace tracks every prompt, weekly, per engine.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-mist">
              Create a free account to unlock every tab of this report, then track prompt history, rank changes, audits
              and the content studio.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login?next=%2Fdashboard&intent=signup"
                className="rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Create free account
              </Link>
              <Link
                href="/contact?intent=demo"
                className="rounded-full border border-line px-6 py-3 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
              >
                Book a walkthrough
              </Link>
            </div>
          </div>
        </Reveal>

        <p className="font-mono text-[0.6rem] leading-relaxed text-mist-dim">
          Every figure above comes from the scan of {report.domain}
          {report.ranAt ? ` run on ${report.ranAt}` : ""}.{" "}
          {report.simulated
            ? "Provider credentials are not configured, so the engine produced simulated provider responses for this run."
            : "Reports are private and never indexed."}
        </p>
      </div>
    </>
  );
}
