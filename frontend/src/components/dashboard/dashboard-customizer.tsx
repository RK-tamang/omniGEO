"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardBlocks } from "@/components/dashboard/dashboard-blocks";
import {
  DASHBOARD_BLOCKS,
  DASHBOARD_BLOCK_GROUPS,
  DASHBOARD_PRESETS,
  normalizeDashboardLayout,
  presetBlocks,
  type DashboardLayout,
} from "@/lib/dashboard-layout";

/**
 * The full-page dashboard customiser.
 *
 * Same model as the inline editor on the dashboard home — pick a preset, add
 * or remove blocks, reorder them — but with a live preview of the result.
 */
export function DashboardCustomizer({
  initial,
  workspaceName,
}: {
  initial: DashboardLayout;
  workspaceName: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<DashboardLayout>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showPreview, setShowPreview] = useState(true);
  const [, startTransition] = useTransition();

  const hiddenBlocks = useMemo(
    () => DASHBOARD_BLOCKS.filter((b) => !current.blocks.includes(b.id)),
    [current.blocks],
  );
  const preset = DASHBOARD_PRESETS.find((p) => p.id === current.preset);

  async function persist(next: DashboardLayout) {
    setStatus("saving");
    try {
      const res = await fetch("/api/dashboard/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; layout?: DashboardLayout };
      if (!res.ok || !data.ok || !data.layout) {
        setStatus("error");
        return;
      }
      setCurrent(data.layout);
      setStatus("saved");
      startTransition(() => router.refresh());
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  function applyPreset(presetId: string) {
    void persist({ preset: presetId, blocks: presetBlocks(presetId) });
  }

  function toggleBlock(id: string) {
    const has = current.blocks.includes(id);
    const blocks = has ? current.blocks.filter((b) => b !== id) : [...current.blocks, id];
    void persist(normalizeDashboardLayout({ preset: "custom", blocks }));
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const blocks = [...current.blocks];
    const index = blocks.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    void persist(normalizeDashboardLayout({ preset: "custom", blocks }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">Customise dashboard</h1>
          <p className="mt-1 text-sm text-mist">
            {workspaceName} · {preset ? preset.name : "Custom"} view · {current.blocks.length} blocks
            {status === "saving" ? " · saving…" : status === "saved" ? " · saved" : status === "error" ? " · could not save" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
          >
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-pressed={showPreview}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Editor */}
        <div className="space-y-6">
          <section className="glass elevate rounded-2xl p-6">
            <h2 className="text-sm font-medium text-chalk">Start from a preset</h2>
            <p className="mt-1 text-xs text-mist-dim">
              Each preset is a layout built for one job. You can adjust it afterwards.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {DASHBOARD_PRESETS.map((p) => {
                const active = current.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    aria-pressed={active}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? "border-iris/50 bg-iris/8"
                        : "border-line bg-surface/50 hover:border-line-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-chalk">{p.name}</span>
                      {active && (
                        <span className="rounded-full bg-iris/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-iris">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-mist-dim">{p.blurb}</p>
                    <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                      {p.blocks.length} blocks
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass elevate rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-chalk">
                On your dashboard ({current.blocks.length})
              </h2>
              <button
                type="button"
                onClick={() => void persist({ preset: "executive", blocks: presetBlocks("executive") })}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-mist transition-colors hover:border-line-strong hover:text-chalk"
              >
                Reset
              </button>
            </div>
            <p className="mt-1 text-xs text-mist-dim">Reorder with the arrows. Changes save as you make them.</p>

            <ul className="mt-4 space-y-2">
              {current.blocks.map((id, index) => {
                const block = DASHBOARD_BLOCKS.find((b) => b.id === id);
                if (!block) return null;
                return (
                  <li key={id} className="flex items-center gap-3 rounded-xl border border-line bg-surface/50 px-4 py-3">
                    <span className="font-mono text-[0.65rem] text-mist-dim">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-chalk">{block.label}</p>
                      <p className="truncate text-xs text-mist-dim">{block.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveBlock(id, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${block.label} up`}
                        className="flex size-7 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-line-strong hover:text-chalk disabled:opacity-30 disabled:hover:border-line disabled:hover:text-mist"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(id, 1)}
                        disabled={index === current.blocks.length - 1}
                        aria-label={`Move ${block.label} down`}
                        className="flex size-7 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-line-strong hover:text-chalk disabled:opacity-30 disabled:hover:border-line disabled:hover:text-mist"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBlock(id)}
                        aria-label={`Remove ${block.label}`}
                        className="flex size-7 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-coral/50 hover:text-coral"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {hiddenBlocks.length > 0 && (
            <section className="glass elevate rounded-2xl p-6">
              <h2 className="text-sm font-medium text-chalk">Add a block ({hiddenBlocks.length})</h2>
              <p className="mt-1 text-xs text-mist-dim">
                Every block, grouped by the product area it belongs to.
              </p>
              <div className="mt-4 space-y-5">
                {DASHBOARD_BLOCK_GROUPS.map((g) => {
                  const groupBlocks = hiddenBlocks.filter((b) => b.group === g.id);
                  if (groupBlocks.length === 0) return null;
                  return (
                    <div key={g.id}>
                      <p className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">{g.label}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {groupBlocks.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => toggleBlock(b.id)}
                            className="group flex items-start gap-3 rounded-xl border border-dashed border-line bg-surface/30 px-4 py-3 text-left transition-colors hover:border-iris/40 hover:bg-surface/50"
                          >
                            <span className="mt-0.5 text-mist-dim transition-colors group-hover:text-iris">+</span>
                            <span className="min-w-0">
                              <span className="block text-sm text-mist transition-colors group-hover:text-chalk">
                                {b.label}
                              </span>
                              <span className="block text-xs leading-relaxed text-mist-dim">{b.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Live preview */}
        {showPreview && (
          <div className="space-y-4">
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">Live preview</p>
            <div className="rounded-2xl border border-line bg-surface/40 p-5">
              <DashboardBlocks blocks={current.blocks} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
