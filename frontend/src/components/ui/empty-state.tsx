import type { ReactNode } from "react";

/**
 * The honest answer when a workspace has nothing to show yet.
 *
 * Used wherever a panel would otherwise render placeholder numbers — the
 * point is to say plainly that there is no data, and what to do about it.
 */
export function EmptyState({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-10 text-center">
      <span
        className="flex size-9 items-center justify-center rounded-full border border-line text-mist-dim"
        aria-hidden
      >
        ◌
      </span>
      <p className="text-sm font-medium text-chalk">{title}</p>
      {sub ? <p className="max-w-sm text-sm leading-relaxed text-mist">{sub}</p> : null}
      {action}
    </div>
  );
}
