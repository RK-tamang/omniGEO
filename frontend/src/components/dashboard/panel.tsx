"use client";

import type { ReactNode } from "react";

export function DashboardHeader({
  title,
  sub,
  aside,
}: {
  title: string;
  sub?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-chalk">{title}</h1>
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

export function Panel({ children, className = "", title, sub, aside }: { children: ReactNode; className?: string; title?: string; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-6 ${className}`}>
      {(title || sub || aside) && (
        <DashboardHeader title={title || ""} sub={sub} aside={aside} />
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