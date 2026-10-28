"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/dashboard/panel";

type EvidenceObservation = {
  id: string;
  prompt: string;
  promptText?: string | null;
  answerExcerpt?: string | null;
  engine: string;
  provider?: string | null;
  observationType: string;
  model?: string | null;
  country?: string | null;
  language?: string | null;
  capturedAt?: string | null;
  domain: string;
  url: string;
  title?: string | null;
  brandMatches?: string[];
  competitorMatches?: string[];
};

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  observation?: EvidenceObservation | null;
}

export function EvidenceDrawer({ open, onClose, observation }: EvidenceDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    </div>
  );
}

/**
 * Desktop evidence drawer – slides in from the right.
 */
export function EvidenceDrawerDesktop({
  open,
  onClose,
  observation,
}: EvidenceDrawerProps & { width?: string }) {
  if (!open) return null;
  const obs = observation;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-[560px] flex flex-col border-l border-line bg-ink-900 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Citation evidence"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-ink-850 px-6 py-4">
        <div>
          <h2 className="font-semibold text-chalk">Evidence details</h2>
          <p className="mt-1 text-xs text-mist-dim">
            Observation {obs?.id ?? "—"} • {obs?.engine ?? "—"}
          </p>
        </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg text-mist hover:text-chalk hover:bg-surface-2 p-2"
            aria-label="Close evidence drawer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto px-6 py-6">
        {!obs ? (
          <div className="h-64 flex items-center justify-center text-center">
            <p className="text-mist-dim">No evidence available.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Prompt */}
            <section>
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Monitored prompt</p>
              <p className="mt-1.5 text-sm text-chalk break-words">“{obs.prompt}”</p>
            </section>

            {/* AI answer excerpt */}
            <section>
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">AI answer excerpt</p>
              <div className="mt-1.5 rounded-lg border border-line bg-surface p-4 text-sm text-mist leading-relaxed">
                {obs.answerExcerpt || "No excerpt captured."}
              </div>
            </section>

            {/* Metadata grid */}
            <section>
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Observation metadata</p>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[0.55rem] uppercase tracking-widest text-mist-dim">Engine</p>
                  <p className="text-sm font-medium text-chalk">{obs.engine}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.55rem] uppercase tracking-widest text-mist-dim">Provider</p>
                  <p className="text-sm font-medium text-mist">{obs.provider ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.55rem] uppercase tracking-widest text-mist-dim">Observation type</p>
                  <p className="text-sm font-medium text-mist">{obs.observationType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.55rem] uppercase tracking-widest text-mist-dim">Model</p>
                  <p className="text-sm font-medium text-mist">{obs.model ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.55rem] uppercase tracking-widest text-mist-dim">Country / language</p>
                  <p className="text-sm font-medium text-mist">
                    {obs.country ?? "—"} / {obs.language ?? "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.55rem] uppercase tracking-widest text-mist-dim">Collected at</p>
                  <p className="text-sm font-medium text-mist-dim">{obs.capturedAt ?? "—"}</p>
                </div>
              </div>
            </section>

            {/* Matches */}
            <section>
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Brand &amp; competitor matches</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(obs.brandMatches ?? []).map((m) => (
                  <span key={m} className="rounded-full bg-mint/15 border border-mint/30 px-2.5 py-1 font-mono text-[0.6rem] text-mint">
                    Brand: {m}
                  </span>
                ))}
                {(obs.competitorMatches ?? []).map((m) => (
                  <span key={m} className="rounded-full bg-coral/15 border border-coral/30 px-2.5 py-1 font-mono text-[0.6rem] text-coral">
                    Competitor: {m}
                  </span>
                ))}
                {(obs.brandMatches?.length ?? 0) === 0 && (obs.competitorMatches?.length ?? 0) === 0 && (
                  <p className="text-xs text-mist-dim">No brand or competitor matches detected.</p>
                )}
              </div>
            </section>

            {/* Cited URL */}
            <section>
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Cited source</p>
              <div className="mt-1.5 flex items-start gap-3">
                <StatusChip status="cited" />
                <div>
                  <p className="text-sm font-medium text-chalk truncate">{obs.domain}</p>
                  <a
                    href={obs.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 font-mono text-[0.64rem] text-mist-dim underline underline-offset-4 hover:text-chalk"
                  >
                    {obs.url}
                  </a>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line bg-ink-850 px-6 py-4">
        <Button variant="ghost" size="sm" onClick={onClose} className="w-full">
          Close
        </Button>
      </div>
    </div>
  );
}
