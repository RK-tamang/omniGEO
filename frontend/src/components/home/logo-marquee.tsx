const brands = [
  "Northwind Labs",
  "Kestrel Systems",
  "Brightline",
  "Halcyon Health",
  "Meridian Retail",
  "Copperfield & Co",
  "Vantage Freight",
  "Lumen Studio",
];

export function LogoMarquee() {
  return (
    <section className="border-y border-line bg-ink-900/40 py-10" aria-label="Trusted by teams">
      <div className="container-page">
        <p className="text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-mist-dim">
          Trusted by 5,700+ growth teams
        </p>
        <div className="marquee-mask mt-7 overflow-hidden">
          <div className="animate-marquee flex w-max items-center gap-14 pr-14">
            {[...brands, ...brands].map((b, i) => (
              <span
                key={i}
                className="whitespace-nowrap font-display text-xl text-mist-dim transition-colors hover:text-mist"
                aria-hidden={i >= brands.length}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
