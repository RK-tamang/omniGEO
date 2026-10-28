import { Sparkline } from "@/components/dashboard/charts";

function Delta({ delta, unit, invert }: { delta?: number; unit?: string; invert?: boolean }) {
  if (delta === undefined || delta === 0) {
    return <span className="font-mono text-xs text-mist-dim">no change</span>;
  }
  const up = delta > 0;
  const good = invert ? !up : up;
  return (
    <span className={`font-mono text-xs ${good ? "text-mint" : "text-coral"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta)}
      {unit && ` ${unit}`}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  unit,
  hint,
  spark,
  color,
  invert,
  sub,
}: {
  label: string;
  value: string | number;
  delta?: number;
  unit?: string;
  hint?: string;
  spark?: number[];
  color?: string;
  invert?: boolean;
  sub?: string;
}) {
  const accent = color ?? "#3e7cb0";

  return (
    <div className="relative glass elevate rounded-2xl p-5 transition-all duration-300 hover:elevate-hover hover:border-iris/30">
      {/* Left accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: accent }} />
      <div className="relative z-10">
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-mist-dim">{label}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <span className={`font-display text-4xl font-normal italic leading-none text-chalk`}>
            {value}
          </span>
          {spark && (
            <Sparkline data={spark} color={accent} className="hidden h-6 w-24 @2xl:block" />
          )}
        </div>
        {sub && <p className="mt-2 text-[0.6rem] leading-none text-mist-dim">{sub}</p>}
        <div className={`mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-3`}>
          {delta !== undefined && (
            <Delta delta={delta} unit={unit ?? ""} invert={invert} />
          )}
          {sub ? null : <span className="text-right text-[0.68rem] text-mist-dim">{hint ?? ""}</span>}
        </div>
      </div>
    </div>
  );
}
