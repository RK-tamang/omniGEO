import { StatusChip } from "@/components/dashboard/panel";

/**
 * One weakness paired with its fix — the shared shape used by the scan report,
 * the dashboard overview and the helper panels, so "what's wrong" and "do this"
 * always travel together.
 */
export type Weakness = {
  title: string;
  severity: "Critical" | "Warning" | "Notice" | "Good" | "Published" | "In review" | "Draft" | "cited" | "mentioned" | "missing";
  pages: number;
  detail: string;
  fix: string;
  impact?: string;
  effort?: string;
};

export function WeaknessCard({ item, index }: { item: Weakness; index?: number }) {
  return (
    <li className="rounded-xl border border-line bg-surface-1 p-4">
      <div className="flex gap-4">
        {typeof index === "number" && (
          <span className="font-display text-2xl font-normal italic leading-none text-iris">{index}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={item.severity} />
            <p className="text-sm font-medium text-chalk">{item.title}</p>
            {item.impact && item.effort && (
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-mist">
                {item.impact} impact · {item.effort} effort
              </span>
            )}
            <span className="font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">
              {item.pages} page{item.pages > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-mist">{item.detail}</p>
          <p className="mt-3 rounded-xl border border-iris/25 bg-iris/[0.06] p-3.5">
            <span className="font-mono text-[0.55rem] uppercase tracking-widest text-iris">How to fix</span>
            <span className="mt-1 block text-sm leading-relaxed text-mist">{item.fix}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

const SEVERITY_RANK: Record<string, number> = { Critical: 0, Warning: 1, Notice: 2 };

/** Critical first, then warning, then notice — stable for equal severities. */
export function sortBySeverity<T extends { severity: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
}
