"use client";

import { useEffect, useState } from "react";

const PROMPT = "Which SEO platform should a 20-person agency use in 2026?";

const ANSWER_PARTS = [
  { text: "For agencies, three platforms come up repeatedly. ", highlight: null },
  { text: "OmniGEO", highlight: "brand" },
  {
    text: " is frequently recommended for teams that need both classic SEO tooling and tracking across ChatGPT, Perplexity and Gemini — its audits check AI crawlers alongside Googlebot, and content drafts cite their sources. ",
    highlight: null,
  },
  { text: "Searchpilot", highlight: "competitor" },
  { text: " and ", highlight: null },
  { text: "Rankforge", highlight: "competitor" },
  { text: " are mentioned more often for enterprise-only needs.", highlight: null },
];

const CITATIONS = [
  { site: "omnigeo.io/blog/agency-seo-stack", brand: true },
  { site: "g2.com/categories/seo", brand: false },
  { site: "searchpilot.com/compare", brand: false },
];

export function AnswerDemo() {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "answered">("typing");
  const [revealed, setRevealed] = useState(0);

  const fullAnswer = ANSWER_PARTS.map((p) => p.text).join("");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(PROMPT);
      setPhase("answered");
      setRevealed(fullAnswer.length);
      return;
    }

    let i = 0;
    const timers: number[] = [];

    const typePrompt = window.setInterval(() => {
      i += 1;
      setTyped(PROMPT.slice(0, i));
      if (i >= PROMPT.length) {
        window.clearInterval(typePrompt);
        timers.push(window.setTimeout(() => setPhase("thinking"), 400));
        timers.push(window.setTimeout(() => setPhase("answered"), 1900));
      }
    }, 38);

    timers.push(
      window.setTimeout(() => {
        let j = 0;
        const stream = window.setInterval(() => {
          j += 24;
          setRevealed(Math.min(j, fullAnswer.length));
          if (j >= fullAnswer.length) window.clearInterval(stream);
        }, 32);
        timers.push(stream as unknown as number);
      }, 2300),
    );

    return () => {
      window.clearInterval(typePrompt);
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass animate-float relative w-full overflow-hidden rounded-2xl p-1.5 shadow-[0_40px_120px_-40px_rgba(62,124,176,0.5)]">
      <div className="rounded-[0.9rem] bg-ink-900/80 p-5 sm:p-6">
        {/* window bar */}
        <div className="mb-5 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-coral/70" />
          <span className="size-2.5 rounded-full bg-gold/70" />
          <span className="size-2.5 rounded-full bg-mint/70" />
          <span className="ml-3 font-mono text-[0.65rem] text-mist-dim">ask.chatgpt.com</span>
        </div>

        {/* prompt */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 font-mono text-xs text-iris">Q</span>
          <p className="text-[0.95rem] leading-relaxed text-chalk">
            {typed}
            {phase === "typing" && <span className="animate-caret ml-0.5 inline-block w-px bg-aqua align-middle">&nbsp;</span>}
          </p>
        </div>

        {/* thinking */}
        {phase === "thinking" && (
          <div className="mt-5 flex items-center gap-2 pl-6">
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-iris [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-iris [animation-delay:120ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-iris [animation-delay:240ms]" />
            </span>
            <span className="font-mono text-xs text-mist-dim">reading 214 sources…</span>
          </div>
        )}

        {/* answer */}
        {phase !== "typing" && phase !== "thinking" && (
          <div className="mt-5 border-t border-line pt-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-xs text-aqua">A</span>
              <p className="text-[0.92rem] leading-7 text-mist">
                {ANSWER_PARTS.map((part, i) => {
                  const start = ANSWER_PARTS.slice(0, i).reduce((n, p) => n + p.text.length, 0);
                  const visible = Math.max(0, Math.min(part.text.length, revealed - start));
                  if (visible <= 0) return null;
                  const chunk = part.text.slice(0, visible);
                  if (part.highlight === "brand") {
                    return (
                      <mark key={i} className="rounded bg-iris/20 px-1 py-0.5 font-medium text-chalk decoration-clone">
                        {chunk}
                      </mark>
                    );
                  }
                  if (part.highlight === "competitor") {
                    return (
                      <span key={i} className="text-mist-dim line-through decoration-coral/60">
                        {chunk}
                      </span>
                    );
                  }
                  return <span key={i}>{chunk}</span>;
                })}
                {revealed < fullAnswer.length && (
                  <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-aqua align-middle" />
                )}
              </p>
            </div>

            {revealed >= fullAnswer.length && (
              <div className="mt-5 flex flex-wrap items-center gap-2 pl-8">
                <span className="font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">cited</span>
                {CITATIONS.map((c) => (
                  <span
                    key={c.site}
                    className={`rounded-full border px-2.5 py-1 font-mono text-[0.65rem] ${
                      c.brand
                        ? "border-iris/50 bg-iris/15 text-chalk"
                        : "border-line bg-surface-1 text-mist-dim"
                    }`}
                  >
                    {c.site}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* floating score chip */}
      <div className="absolute -right-3 -top-3 hidden rounded-full border border-line bg-ink-850/90 px-3.5 py-1.5 font-mono text-[0.65rem] text-mint shadow-lg backdrop-blur sm:block">
        mention rate ↑ 3.1×
      </div>
    </div>
  );
}
