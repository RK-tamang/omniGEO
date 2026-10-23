"use client";

import { useState } from "react";
import { StatusChip } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";
import type { AuditIssue } from "@/lib/workspace-data";

const SEVERITIES = ["All", "Critical", "Warning", "Notice"] as const;

export function IssuesList({ issues: source }: { issues: AuditIssue[] }) {
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("All");
  const [expanded, setExpanded] = useState<string | null>(source[0]?.title ?? null);

  const issues = source.filter((i) => severity === "All" || i.severity === severity);

  if (source.length === 0) {
    return (
      <EmptyState
        title="No open issues"
        sub="Run a site audit and every weakness it finds will be listed here with the fix for each."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filter by severity">
        {SEVERITIES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverity(s)}
            aria-pressed={severity === s}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              severity === s ? "border-iris/50 bg-iris/15 text-chalk" : "border-line text-mist hover:text-chalk"
            }`}
          >
            {s}
            <span className="ml-1.5 font-mono text-[0.6rem] text-mist-dim">
              {s === "All" ? source.length : source.filter((i) => i.severity === s).length}
            </span>
          </button>
        ))}
      </div>

      <ul className="divide-y divide-line">
        {issues.map((issue) => {
          const open = expanded === issue.title;
          return (
            <li key={issue.title}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : issue.title)}
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-4 py-4 text-left transition-colors hover:bg-surface-1"
              >
                <span className="flex items-start gap-3">
                  <StatusChip status={issue.severity} />
                  <span>
                    <span className="block text-sm text-chalk">{issue.title}</span>
                    <span className="mt-0.5 block font-mono text-[0.62rem] text-mist-dim">{issue.pages} page{issue.pages > 1 ? "s" : ""} affected</span>
                  </span>
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden
                  className={`mt-1 shrink-0 text-mist-dim transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
              {open && (
                <div className="pb-5 pl-0 sm:pl-24">
                  <p className="max-w-2xl text-sm leading-relaxed text-mist">{issue.detail}</p>
                  <p className="mt-3 max-w-2xl rounded-xl border border-line bg-surface-1 p-3.5 text-sm">
                    <span className="font-mono text-[0.58rem] uppercase tracking-widest text-iris">How to fix</span>
                    <span className="mt-1.5 block text-mist">{issue.fix}</span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {issues.length === 0 && <p className="py-8 text-center text-sm text-mist">No issues at this severity. Nice.</p>}
    </div>
  );
}
