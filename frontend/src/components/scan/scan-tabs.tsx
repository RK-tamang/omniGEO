"use client";

import Link from "next/link";
import { useRef, useState } from "react";

export type TabDef = { id: string; title: string; locked?: boolean };

/**
 * Report workspace — two columns on desktop:
 *
 *   left  (~2/3)  the active panel
 *   right (~1/3)  the score card slot, then the tabs stacked vertically
 *
 * Locked tabs render their panel blurred and non-interactive behind a sign-up
 * card, so visitors see what is inside without getting the data for free.
 * Arrow keys move between tabs (roving tabindex); both axes work so the
 * vertical list behaves the way keyboard users expect.
 */
export function ScanTabs({
  tabs,
  panels,
  score,
}: {
  tabs: TabDef[];
  panels: React.ReactNode[];
  /** Score card, rendered at the top of the right column. */
  score?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (i: number) => {
    const idx = (i + tabs.length) % tabs.length;
    setActive(idx);
    refs.current[idx]?.focus();
  };

  // Read the current index from the DOM rather than the render closure, so rapid
  // arrow presses never act on a stale `active` value.
  const currentIndex = () => {
    const i = refs.current.findIndex((el) => el === document.activeElement);
    return i === -1 ? active : i;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const from = currentIndex();
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      select(from + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      select(from - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0);
    } else if (e.key === "End") {
      e.preventDefault();
      select(tabs.length - 1);
    }
  };

  const isLocked = !!tabs[active].locked;

  return (
    <div className="flex flex-col gap-5 lg:flex-row-reverse lg:items-start">
      {/* Right column: the score card, then the vertical tabs */}
      <div className="flex w-full flex-col gap-4 lg:sticky lg:top-24 lg:w-[334px] lg:shrink-0">
        {score}

        <div
          role="tablist"
          aria-label="Scan report sections"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {tabs.map((t, i) => {
            const selected = i === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                className={`min-w-[9rem] rounded-xl border px-4 py-2.5 text-left transition-colors lg:min-w-0 lg:w-full ${
                  selected
                    ? "border-iris/55 bg-iris/10 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]"
                    : "border-line bg-surface-1 hover:border-line-strong hover:bg-surface-2"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {t.locked && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0 text-mist-dim">
                      <rect x="2" y="5" width="8" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M4 5V3.6a2 2 0 1 1 4 0V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                    </svg>
                  )}
                  <span className={`block truncate text-[0.82rem] font-medium ${selected ? "text-chalk" : "text-mist"}`}>
                    {t.title}
                  </span>
                </span>
                <span className="sr-only">{t.locked ? "Sign up to unlock" : "Visible without an account"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Left column: the active panel */}
      <div className="min-w-0 flex-1">
        <div
          role="tabpanel"
          id={`panel-${tabs[active].id}`}
          aria-labelledby={`tab-${tabs[active].id}`}
          tabIndex={0}
          className="relative min-w-0 focus:outline-none"
        >
          {/* the panel is always rendered so the blur reads as hidden content */}
          <div
            className={isLocked ? "pointer-events-none select-none blur-[7px] saturate-[0.7]" : undefined}
            aria-hidden={isLocked || undefined}
          >
            {panels[active]}
          </div>

          {isLocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
              <SignupGate />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignupGate() {
  return (
    <div className="glass-strong w-full max-w-md rounded-2xl border border-iris/30 p-7 text-center shadow-[0_24px_80px_-20px_rgba(5,5,10,0.9)]">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-iris/40 bg-iris/10 text-iris">
        <svg width="18" height="18" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="2" y="5" width="8" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.1" />
          <path d="M4 5V3.6a2 2 0 1 1 4 0V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-chalk">
        Create a free account to reveal this section
      </h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-mist">
        The full report — every tab, the prompt table and the fix list — is free. No card, takes about 30 seconds.
      </p>
      <div className="mt-6 flex flex-col gap-2.5">
        <Link
          href="/login?next=%2Fdashboard&intent=signup"
          className="rounded-full bg-gradient-to-r from-iris to-aqua px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Create free account
        </Link>
        <Link
          href="/login?next=%2Fdashboard"
          className="rounded-full border border-line px-6 py-3 text-sm text-mist transition-colors hover:border-line-strong hover:text-chalk"
        >
          I already have an account
        </Link>
      </div>
      <p className="mt-4 font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">
        Free forever · no credit card
      </p>
    </div>
  );
}
