"use client";

import { SectionHeader, EmptyState } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { getSettings, upsertSetting } from "@/lib/api";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getSettings();
        if (!active) return;
        const map: Record<string, unknown> = {};
        for (const s of (data.settings ?? [])) {
          map[s.key] = s.value;
        }
        setSettings(map);
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

  async function handleUpsert(key: string, value: unknown) {
    setSaving((prev) => new Set([...prev, key]));
    try {
      await upsertSetting({ key, value });
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <SectionHeader title="System settings" sub="Loading settings…" />
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <SectionHeader title="System settings" sub="Unable to load settings." />
        <EmptyState title="Backend unreachable" sub={error} />
      </AdminShell>
    );
  }

  const entries = Object.entries(settings);

  return (
    <AdminShell>
      <SectionHeader title="System settings" sub="Platform-wide configuration. Edit any setting inline." />
      {entries.length === 0 ? (
        <EmptyState title="No settings" sub="Settings will appear here once configured." />
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-border bg-surface/60 backdrop-blur-xl p-4 flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-muted-dim truncate">{key}</span>
              <input
                type="text"
                value={typeof value === "string" ? value : JSON.stringify(value)}
                onChange={(e) => handleUpsert(key, e.target.value)}
                disabled={saving.has(key)}
                className="flex-1 rounded-xl border border-border px-3 py-1.5 text-sm bg-surface-1 focus:border-iris/60 focus:outline-none transition-colors"
              />
              {saving.has(key) && <span className="text-xs text-muted-dim">Saving…</span>}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
