export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <circle cx="13" cy="13" r="11.5" stroke="url(#lg)" strokeWidth="1.6" />
        <circle cx="13" cy="13" r="4.5" fill="url(#lg)" />
        <path d="M13 1.5v4M13 20.5v4M1.5 13h4M20.5 13h4" stroke="url(#lg)" strokeWidth="1.6" strokeLinecap="round" />
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="26" y2="26">
            <stop stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-[1.05rem] font-semibold tracking-tight text-chalk">
        Omni<span className="text-gradient">GEO</span>
      </span>
    </span>
  );
}
