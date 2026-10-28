"use client";

import { SectionHeader, EmptyState } from "@/components/ui";
import { AdminShell } from "@/components/shell";

const auditLogs = [
  { actor: "admin@omnigeo.example", action: "updated workspace plan", target: "Zenith Co", when: "2 min ago" },
  { actor: "admin@omnigeo.example", action: "disabled provider", target: "perplexity", when: "15 min ago" },
  { actor: "admin@omnigeo.example", action: "suspended user", target: "david@orbit.example", when: "1 h ago" },
];

export default function AuditLogPage() {
  return (
    <AdminShell>
      <SectionHeader title="Audit log" sub="Platform administration actions." />
      {auditLogs.length === 0 ? (
        <EmptyState title="No audit events" sub="Admin actions will appear here." />
      ) : (
        <div className="space-y-3">
          {auditLogs.map((a, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface/60 backdrop-blur-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-dim">{a.actor}</span>
                <span className="text-xs text-muted-dim opacity-50">→</span>
                <span className="font-medium text-chalk">{a.action}</span>
                <span className="text-xs text-muted-dim opacity-50">→</span>
                <span className="text-sm">{a.target}</span>
              </div>
              <span className="font-mono text-[0.6rem] text-muted-dim">{a.when}</span>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
