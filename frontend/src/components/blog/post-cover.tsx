import type { Accent } from "@/lib/blog-shared";

const accentStyles: Record<Accent, { wash: string; text: string; border: string; dot: string }> = {
  iris: {
    wash: "from-iris/30 via-iris/10 to-ink-950",
    text: "text-iris",
    border: "border-iris/40",
    dot: "bg-iris",
  },
  aqua: {
    wash: "from-aqua/25 via-aqua/8 to-ink-950",
    text: "text-aqua",
    border: "border-aqua/40",
    dot: "bg-aqua",
  },
  mint: {
    wash: "from-mint/20 via-mint/8 to-ink-950",
    text: "text-mint",
    border: "border-mint/40",
    dot: "bg-mint",
  },
  gold: {
    wash: "from-gold/20 via-gold/8 to-ink-950",
    text: "text-gold",
    border: "border-gold/40",
    dot: "bg-gold",
  },
  coral: {
    wash: "from-coral/20 via-coral/8 to-ink-950",
    text: "text-coral",
    border: "border-coral/40",
    dot: "bg-coral",
  },
};

export function PostCover({
  accent,
  label,
  index,
  className = "",
}: {
  accent: Accent;
  label: string;
  index?: string;
  className?: string;
}) {
  const a = accentStyles[accent] ?? accentStyles.iris;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${a.wash} ${className}`} aria-hidden>
      <div className="grid-bg absolute inset-0 opacity-60" />
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full border ${a.border} bg-ink-950/50 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] ${a.text}`}
          >
            {label}
          </span>
          {index && <span className="font-mono text-[0.6rem] text-mist-dim">{index}</span>}
        </div>

        <div className="flex items-end justify-between">
          <span className="font-display text-[5rem] leading-[0.7] text-chalk/10">&ldquo;</span>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`h-1 w-16 rounded-full ${a.dot} opacity-70`} />
            <span className={`h-1 w-10 rounded-full ${a.dot} opacity-40`} />
            <span className={`h-1 w-6 rounded-full ${a.dot} opacity-20`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthorAvatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-gradient-to-br from-iris/30 to-aqua/20 font-mono text-[0.6rem] text-chalk ${className}`}
      aria-hidden
    >
      {initials}
    </span>
  );
}
