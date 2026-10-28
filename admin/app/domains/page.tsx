"use client";

import { SectionHeader, DataTable, EmptyState } from "@/components/ui";
import { AdminShell } from "@/components/shell";

const domains = [
  { domain: "asterflow.example", workspace: "AsterFlow", status: "Verified", ssl: "Active" },
  { domain: "nova.example", workspace: "Nova Labs", status: "Verified", ssl: "Active" },
  { domain: "zenith.example", workspace: "Zenith Co", status: "Pending", ssl: "Pending" },
  { domain: "orbit.example", workspace: "Orbit Systems", status: "Verified", ssl: "Active" },
];

export default function DomainsPage() {
  return (
    <AdminShell>
      <SectionHeader title="Domains" sub="Whitelisted domains across all workspaces." />
      {domains.length === 0 ? (
        <EmptyState title="No domains" sub="Domains will appear here once added." />
      ) : (
        <DataTable
          columns={[
            { key: "domain", label: "Domain" },
            { key: "workspace", label: "Workspace" },
            { key: "status", label: "Status" },
            { key: "ssl", label: "SSL" },
          ]}
          rows={domains}
        />
      )}
    </AdminShell>
  );
}
