"use client";

import { SectionHeader, DataTable, EmptyState } from "@/components/ui";
import { AdminShell } from "@/components/shell";

const teams = [
  { name: "Engineering", members: 12, workspaces: 4, role: "Admin" },
  { name: "Growth", members: 8, workspaces: 3, role: "Member" },
  { name: "Support", members: 5, workspaces: 2, role: "Member" },
];

export default function TeamsPage() {
  return (
    <AdminShell>
      <SectionHeader title="Teams" sub="Manage teams and their workspace access." />
      {teams.length === 0 ? (
        <EmptyState title="No teams" sub="Teams will appear here once created." />
      ) : (
        <DataTable
          columns={[
            { key: "name", label: "Team" },
            { key: "members", label: "Members" },
            { key: "workspaces", label: "Workspaces" },
            { key: "role", label: "Default role" },
          ]}
          rows={teams}
        />
      )}
    </AdminShell>
  );
}
