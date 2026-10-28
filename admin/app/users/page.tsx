"use client";

import { SectionHeader, EmptyState, Select, StatusChip } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { getUsers, updateUser } from "@/lib/api";
import { useEffect, useState } from "react";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getUsers();
        if (!active) return;
        setUsers(data.users ?? []);
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

  async function handleUpdate(userId: string, field: string, value: string) {
    setSaving((prev) => new Set([...prev, userId]));
    try {
      await updateUser(userId, { [field]: value });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, [field]: value } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }

  if (loading) {
    return (
      <AdminShell>
        <SectionHeader title="Users" sub="Loading users…" />
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <SectionHeader title="Users" sub="Unable to load users." />
        <EmptyState title="Backend unreachable" sub={error} />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <SectionHeader
        title="Users"
        sub="Manage platform users across all workspaces. Edit role or plan inline."
      />
      {users.length === 0 ? (
        <EmptyState title="No users" sub="Users will appear here once tracked." />
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="rounded-2xl border border-border bg-surface/60 backdrop-blur-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="size-6 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-xs font-medium text-chalk">
                  {(u.name ?? u.email).charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-chalk">{u.name ?? "—"}</p>
                  <p className="text-xs text-muted-dim">{u.email ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:min-w-[200px]">
                <Select
                  value={u.role ?? "member"}
                  onChange={(v) => handleUpdate(u.id as string, "role", v)}
                  disabled={saving.has(u.id as string)}
                  options={[
                    { label: "Owner", value: "owner" },
                    { label: "Admin", value: "admin" },
                    { label: "Member", value: "member" },
                  ]}
                />
                <Select
                  value={u.plan ?? "starter"}
                  onChange={(v) => handleUpdate(u.id as string, "plan", v)}
                  disabled={saving.has(u.id as string)}
                  options={[
                    { label: "Starter", value: "starter" },
                    { label: "Pro", value: "pro" },
                    { label: "Enterprise", value: "enterprise" },
                  ]}
                />
              </div>
              <StatusChip status={u.status ?? "Active"} />
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
