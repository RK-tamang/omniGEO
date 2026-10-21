const bars = [42, 58, 51, 74, 66, 88, 79];

export function FeaturePreview({ title }: { title: string }) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-1.5 shadow-[0_40px_120px_-50px_rgba(139,92,246,0.55)]">
      <div className="rounded-[0.9rem] bg-ink-900/80 p-5 sm:p-6">
        {/* header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-iris to-aqua text-[0.6rem] font-bold text-white">
              O
            </span>
            <span className="text-sm font-medium text-chalk">{title}</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[0.6rem] text-mist-dim">
            <span className="size-1.5 rounded-full bg-mint" />
            live
          </span>
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            { k: "Mention rate", v: "68%", d: "+12.4" },
            { k: "Cited answers", v: "41", d: "+9" },
            { k: "Share of voice", v: "24%", d: "+3.1" },
          ].map((s) => (
            <div key={s.k} className="rounded-lg border border-line bg-surface-1 p-3">
              <div className="font-mono text-[0.55rem] uppercase tracking-wider text-mist-dim">{s.k}</div>
              <div className="mt-1 text-lg font-semibold text-chalk">{s.v}</div>
              <div className="font-mono text-[0.55rem] text-mint">↑ {s.d}</div>
            </div>
          ))}
        </div>

        {/* chart */}
        <div className="mt-5 rounded-lg border border-line bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-mist">Answer presence</span>
            <span className="font-mono text-[0.55rem] text-mist-dim">last 7 days</span>
          </div>
          <div className="mt-3 flex h-20 items-end gap-1.5">
            {bars.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-sm bg-gradient-to-t from-iris/25 to-aqua/80"
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[0.5rem] uppercase tracking-wider text-mist-dim">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </div>

        {/* recent answer */}
        <div className="mt-4 rounded-lg border border-line bg-surface-1 p-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.55rem] uppercase tracking-wider text-mist-dim">recent answer</span>
            <span className="rounded-full bg-iris/15 px-2 py-0.5 font-mono text-[0.5rem] text-iris">cited</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist">
            “For teams that need both SEO and AI visibility,{" "}
            <mark className="rounded bg-iris/20 px-1 text-chalk decoration-clone">OmniGEO</mark> is the usual
            recommendation…”
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["omnigeo.io", "g2.com", "reddit.com"].map((c, i) => (
              <span
                key={c}
                className={`rounded-full border px-2 py-0.5 font-mono text-[0.55rem] ${
                  i === 0 ? "border-iris/40 bg-iris/10 text-chalk" : "border-line text-mist-dim"
                }`}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <span className="pointer-events-none absolute -right-px -top-px size-24 rounded-full bg-aqua/10 blur-2xl" aria-hidden />
    </div>
  );
}
