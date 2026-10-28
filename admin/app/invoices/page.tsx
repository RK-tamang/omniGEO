"use client";

import { SectionHeader, DataTable, EmptyState } from "@/components/ui";
import { AdminShell } from "@/components/shell";

const invoices = [
  { id: "INV-001", org: "AsterFlow", amount: "$29.00", status: "Paid", date: "2026-10-01" },
  { id: "INV-002", org: "Nova Labs", amount: "$79.00", status: "Paid", date: "2026-10-05" },
  { id: "INV-003", org: "Zenith Co", amount: "$199.00", status: "Unpaid", date: "2026-10-15" },
  { id: "INV-004", org: "Orbit Systems", amount: "$29.00", status: "Unpaid", date: "2026-10-20" },
];

export default function InvoicesPage() {
  return (
    <AdminShell>
      <SectionHeader title="Invoices" sub="Billing invoices across all organizations." />
      {invoices.length === 0 ? (
        <EmptyState title="No invoices" sub="Invoices will appear here once generated." />
      ) : (
        <DataTable
          columns={[
            { key: "id", label: "Invoice" },
            { key: "org", label: "Organization" },
            { key: "amount", label: "Amount" },
            { key: "status", label: "Status" },
            { key: "date", label: "Date" },
          ]}
          rows={invoices.map((inv) => ({ ...inv, status: <span>{inv.status}</span> }))}
        />
      )}
    </AdminShell>
  );
}
