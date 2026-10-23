"use client";

import type { ReactNode } from "react";

/**
 * The page/section heading for the dashboard.
 *
 * `level` controls the rendered heading element so a page has exactly one
 * `<h1>`. Most dashboard pages use a single titled `Panel` as their page
 * container, so `Panel` renders level 1 by default; a page that has more
 * than one panel should pass `level={2}` to the ones below the first.
 */
export function DashboardHeader({
  title,
  sub,
  aside,
  level = 1,
}: {
  title: string;
  sub?: ReactNode;
  aside?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";
  const size = level === 1 ? "text-2xl" : level === 2 ? "text-lg" : "text-base";

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <Heading className={`${size} font-semibold tracking-tight text-chalk`}>{title}</Heading>
        {sub && <p className="mt-1 text-sm text-mist">{sub}</p>}
      </div>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </div>
  );
}

export function StatusChip({ status }: { status: "Critical" | "Warning" | "Notice" | "Good" | "Published" | "In review" | "Draft" | "cited" | "mentioned" | "missing" }) {
  const styles = {
    Critical: "bg-coral/15 text-coral border-coral/30",
    Warning: "bg-gold/15 text-gold border-gold/30",
    Notice: "bg-aqua/15 text-aqua border-aqua/30",
    Good: "bg-mint/15 text-mint border-mint/30",
    Published: "bg-mint/15 text-mint border-mint/30",
    "In review": "bg-gold/15 text-gold border-gold/30",
    Draft: "bg-mist/15 text-mist border-mist/30",
    cited: "bg-mint/15 text-mint border-mint/30",
    mentioned: "bg-aqua/15 text-aqua border-aqua/30",
    missing: "bg-coral/15 text-coral border-coral/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${styles[status]}`}>
      {status}
    </span>
  );
}

/**
 * A dashboard surface.
 *
 * A titled `Panel` is the page heading on most dashboard pages, so it renders
 * an `<h1>` by default. Pass `level={2}` for secondary panels on a page that
 * already has a heading, so the document keeps exactly one `<h1>`.
 */
export function Panel({
  children,
  className = "",
  title,
  sub,
  aside,
  level = 1,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  sub?: ReactNode;
  aside?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  return (
    <section className={`bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-6 ${className}`}>
      {(title || sub || aside) && (
        <DashboardHeader title={title || ""} sub={sub} aside={aside} level={level} />
      )}
      {children}
    </section>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? "bg-mint" : score >= 70 ? "bg-gold" : "bg-coral";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-xs text-mist">{score}</span>
    </div>
  );
}