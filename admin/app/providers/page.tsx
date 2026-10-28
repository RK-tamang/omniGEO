"use client";

import { SectionHeader, EmptyState, Select, StatusChip } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { getProviders, updateProvider } from "@/lib/api";
import { useEffect, useState } from "react";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getProviders();
        if (!active) return;
        setProviders(data.providers ?? []);
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

  async function handleUpdate(providerId: string, field: string, value: string) {
    setSaving((prev) => new Set([...prev, providerId]));
    try {
      const body: Record<string, unknown> = {};
      if (field === "enabled") body.enabled = value === "true";
      if (field === "max_concurrency") body.max_concurrency = parseInt(value, 10);
      if (field === "max_requests_per_minute") body.max_requests_per_minute = parseInt(value, 10);
      await updateProvider(providerId, body);
      setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, [field]: value } : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(providerId); return n; });
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <SectionHeader title="AI providers" sub="Loading providers…" />
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <SectionHeader title="AI providers" sub="Unable to load providers." />
        <EmptyState title="Backend unreachable" sub={error} />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <SectionHeader title="AI providers" sub="Enable/disable AI visibility providers and tune rate limits." />
      {providers.length === 0 ? (
        <EmptyState title="No providers" sub="Providers will appear here once configured." />
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-surface/60 backdrop-blur-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="size-6 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-xs font-medium text-chalk">
                  {p.id.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-chalk">{p.display_name ?? p.id}</p>
                  <p className="text-xs text-muted-dim">{p.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:min-w-[240px]">
                <Select
                  value={String(p.enabled ?? false)}
                  onChange={(v) => handleUpdate(p.id, "enabled", v)}
                  disabled={saving.has(p.id)}
                  options={[
                    { label: "Enabled", value: "true" },
                    { label: "Disabled", value: "false" },
                  ]}
                />
                <input
                  type="number"
                  value={p.max_concurrency ?? ""}
                  onChange={(e) => handleUpdate(p.id, "max_concurrency", e.target.value)}
                  disabled={saving.has(p.id)}
                  placeholder="Concurrency"
                  className="rounded-xl border border-border px-3 py-1.5 text-sm bg-surface-1 w-24 focus:border-iris/60 focus:outline-none transition-colors"
                />
                <input
                  type="number"
                  value={p.max_requests_per_minute ?? ""}
                  onChange={(e) => handleUpdate(p.id, "max_requests_per_minute", e.target.value)}
                  disabled={saving.has(p.id)}
                  placeholder="RPM"
                  className="rounded-xl border border-border px-3 py-1.5 text-sm bg-surface-1 w-24 focus:border-iris/60 focus:outline-none transition-colors"
                />
              </div>
              <StatusChip status={String(p.enabled ?? false) === "true" ? "Enabled" : "Disabled"} />
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
