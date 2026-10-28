"use client";

import { SectionHeader, EmptyState, Select, StatusChip } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { getWorkspaces, updateWorkspace } from "@/lib/api";
import { useEffect, useState } from "react";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getWorkspaces();
        if (!active) return;
        setWorkspaces(data.workspaces ?? []);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function handleUpdate(workspaceId: string, field: string, value: string) {
    setSaving((prev) => new Set([...prev, workspaceId]));
    try {
      await updateWorkspace(workspaceId, { [field]: value });
      setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? { ...w, [field]: value } : w)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(workspaceId); return n; });
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <SectionHeader title="Workspaces" sub="Loading workspaces…" />
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <SectionHeader title="Workspaces" sub="Unable to load workspaces." />
        <EmptyState title="Backend unreachable" sub={error} />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <SectionHeader
        title="Workspaces"
        sub="Overview of every workspace on the platform. Edit plan or status inline."
      />
      {workspaces.length === 0 ? (
        <EmptyState title="No workspaces" sub="Workspaces will appear here once tracked." />
      ) : (
        <div className="space-y-4">
          {workspaces.map((w) => (
            <div key={w.id} className="rounded-2xl border border-border bg-surface/60 backdrop-blur-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="size-6 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-xs font-medium text-chalk">
                  {(w.name ?? "W").charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-chalk">{w.name ?? "—"}</p>
                  <p className="text-xs text-muted-dim">{w.domain ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:min-w-[200px]">
                <Select
                  value={w.plan ?? "starter"}
                  onChange={(v) => handleUpdate(w.id as string, "plan", v)}
                  disabled={saving.has(w.id as string)}
                  options={[
                    { label: "Starter", value: "starter" },
                    { label: "Pro", value: "pro" },
                    { label: "Enterprise", value: "enterprise" },
                  ]}
                />
                <Select
                  value={w.status ?? "active"}
                  onChange={(v) => handleUpdate(w.id as string, "status", v)}
                  disabled={saving.has(w.id as string)}
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Paused", value: "paused" },
                    { label: "Archived", value: "archived" },
                  ]}
                />
              </div>
              <StatusChip status={String(w.status ?? "Active")} />
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
