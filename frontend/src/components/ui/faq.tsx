export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="mx-auto mt-14 max-w-3xl divide-y divide-line rounded-2xl border border-line bg-surface-1">
      {items.map((item) => (
        <details key={item.q} className="faq-row group px-6 py-5 sm:px-8">
          <summary className="flex items-start justify-between gap-6">
            <span className="text-[0.95rem] font-medium text-chalk">{item.q}</span>
            <span className="faq-icon mt-0.5 shrink-0 text-mist-dim group-open:text-iris" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <p className="mt-4 pr-8 text-sm leading-relaxed text-mist">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
