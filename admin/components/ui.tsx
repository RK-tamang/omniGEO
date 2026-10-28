"use client";

export function KpiCard({
  label,
  value,
  delta,
  sub,
  trend,
  color = "iris",
}: {
  label: string;
  value: string | number;
  delta?: number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  const deltaColor = trend === "up" ? "text-mint" : trend === "down" ? "text-coral" : "text-muted-dim";
  const deltaIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const accent = color === "iris" ? "border-iris/30 bg-iris/5" : color === "aqua" ? "border-aqua/30 bg-aqua/5" : color === "mint" ? "border-mint/30 bg-mint/5" : color === "gold" ? "border-gold/30 bg-gold/5" : "border-coral/30 bg-coral/5";
  return (
    <section className={`rounded-2xl border border-border bg-surface/60 backdrop-blur-xl elevate p-5 ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-widest text-muted-dim">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-chalk">{value}</span>
            {delta !== undefined && (
              <span className={`font-mono text-xs ${deltaColor}`}>{deltaIcon} {Math.abs(delta)}%</span>
            )}
          </div>
          {sub && <p className="mt-1.5 text-xs text-muted-dim">{sub}</p>}
        </div>
        <div className="size-8 rounded-xl border border-border/60 bg-surface-2 flex items-center justify-center text-[0.9rem]">
          <span className={color === "iris" ? "text-iris" : color === "aqua" ? "text-aqua" : color === "mint" ? "text-mint" : color === "gold" ? "text-gold" : "text-coral"}>◈</span>
        </div>
      </div>
    </section>
  );
}

export function SectionHeader({ title, sub, aside }: { title: string; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-chalk">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: { key: string; label: string }[]; rows: Record<string, React.ReactNode>[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface/60 backdrop-blur-xl elevate p-5">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3.5 font-mono text-[0.6rem] uppercase tracking-widest text-muted-dim align-top">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors group">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3.5 text-sm text-chalk">
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="size-12 rounded-full border border-border/50 bg-surface/50 flex items-center justify-center text-xl text-muted-dim">◈</div>
      <p className="text-sm font-medium text-chalk">{title}</p>
      <p className="text-xs text-muted-dim max-w-xs">{sub}</p>
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "border-green/20 text-green bg-green/10",
    active: "border-green/20 text-green bg-green/10",
    Paused: "border-gold/20 text-gold bg-gold/10",
    paused: "border-gold/20 text-gold bg-gold/10",
    Archived: "border-mist/20 text-mist bg-mist/10",
    archived: "border-mist/20 text-mist bg-mist/10",
    Canceled: "border-coral/20 text-coral bg-coral/10",
    canceled: "border-coral/20 text-coral bg-coral/10",
    "Past due": "border-coral/20 text-coral bg-coral/10",
    past_due: "border-coral/20 text-coral bg-coral/10",
    Pending: "border-aqua/20 text-aqua bg-aqua/10",
    pending: "border-aqua/20 text-aqua bg-aqua/10",
    Verified: "border-mint/20 text-mint bg-mint/10",
    verified: "border-mint/20 text-mint bg-mint/10",
    Enabled: "border-mint/20 text-mint bg-mint/10",
    enabled: "border-mint/20 text-mint bg-mint/10",
    Disabled: "border-mist/20 text-mist bg-mist/10",
    disabled: "border-mist/20 text-mist bg-mist/10",
    Paid: "border-mint/20 text-mint bg-mint/10",
    paid: "border-mint/20 text-mint bg-mint/10",
    Unpaid: "border-coral/20 text-coral bg-coral/10",
    unpaid: "border-coral/20 text-coral bg-coral/10",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${styles[status] ?? "border-line/50 text-muted-dim"}`}>
      {status}
    </span>
  );
}

export function Select({ value, onChange, options, className = "", disabled }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; className?: string; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`rounded-xl border border-border px-3 py-1.5 text-sm bg-surface-1 focus:border-iris/60 focus:outline-none transition-colors ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
