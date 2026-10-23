import { Sparkline } from "@/components/dashboard/charts";

function Delta({ delta, unit, invert }: { delta: number; unit: string; invert?: boolean }) {
  if (delta === 0) {
    return <span className="font-mono text-xs text-mist-dim">no change</span>;
  }
  const up = delta > 0;
  const good = invert ? !up : up;
  return (
    <span className={`font-mono text-xs ${good ? "text-mint" : "text-coral"}`}>
      {up ? "↑" : "↓"} {Math.abs(delta)}
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
}: {
  label: string;
  value: string;
  delta: number;
  unit: string;
  hint: string;
  spark?: number[];
  color?: string;
  invert?: boolean;
}) {
  return (
    <div className="glass rounded-2xl elevate p-5">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-mist-dim">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-display text-4xl font-normal italic leading-none text-chalk">{value}</span>
        {spark && (
          <Sparkline data={spark} color={color ?? "#8a93c8"} className="hidden h-7 w-24 @2xl:block" />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-3">
        <Delta delta={delta} unit={unit} invert={invert} />
        <span className="text-right text-[0.68rem] text-mist-dim">{hint}</span>
      </div>
    </div>
  );
}
