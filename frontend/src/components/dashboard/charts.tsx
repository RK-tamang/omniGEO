"use client";

import { useState } from "react";

export type ChartSeries = { name: string; color: string; data: number[] };

const W = 720;
const H = 250;
const PAD = { t: 14, r: 10, b: 24, l: 32 };

export function AreaChart({
  series,
  labels,
  unit = "%",
  height = 260,
}: {
  series: ChartSeries[];
  labels: string[];
  unit?: string;
  height?: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const visible = series.filter((s) => !hidden.has(s.name));
  const max = Math.max(10, ...visible.flatMap((s) => s.data)) * 1.15;

  const x = (i: number) => PAD.l + (i / (labels.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const line = (data: number[]) =>
    data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (data: number[]) =>
    `${line(data)} L${x(data.length - 1).toFixed(1)},${H - PAD.b} L${PAD.l},${H - PAD.b} Z`;

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const gridLines = [0, 0.5, 1].map((f) => ({ v: max * f, y: y(max * f) }));

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, i)));
  };

  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          role="img"
          aria-label="Visibility trend chart"
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.name} id={`grad-${s.name.replace(/\W+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={g.y} y2={g.y} stroke="rgba(255,255,255,0.06)" />
              <text x={4} y={g.y + 3.5} fill="rgba(161,161,175,0.8)" fontSize="9" fontFamily="var(--font-geist-mono)">
                {Math.round(g.v)}
                {unit}
              </text>
            </g>
          ))}

          {visible.map((s) => (
            <g key={s.name}>
              <path d={area(s.data)} fill={`url(#grad-${s.name.replace(/\W+/g, "-")})`} />
              <path d={line(s.data)} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" />
            </g>
          ))}

          {hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="3 3"
              />
              {visible.map((s) => (
                <circle key={s.name} cx={x(hover)} cy={y(s.data[hover])} r="3" fill={s.color} stroke="#05050a" strokeWidth="1.5" />
              ))}
            </g>
          )}

          {[0, Math.floor(labels.length / 2), labels.length - 1].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
              fill="rgba(161,161,175,0.8)"
              fontSize="9"
              fontFamily="var(--font-geist-mono)"
            >
              {labels[i]}
            </text>
          ))}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 -translate-x-1/2 rounded-xl border border-line bg-ink-950/95 p-3 shadow-2xl backdrop-blur"
            style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}
          >
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">{labels[hover]}</p>
            <ul className="mt-2 space-y-1">
              {visible.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-mist">
                    <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="font-mono text-chalk">
                    {s.data[hover]}
                    {unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {series.map((s) => {
          const off = hidden.has(s.name);
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => toggle(s.name)}
              aria-pressed={!off}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                off ? "border-line text-mist-dim" : "border-line-strong text-mist hover:text-chalk"
              }`}
            >
              <span
                className="size-1.5 rounded-full transition-opacity"
                style={{ background: s.color, opacity: off ? 0.3 : 1 }}
              />
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Sparkline({ data, color = "#a78bfa", className = "" }: { data: number[]; color?: string; className?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${26 - ((v - min) / range) * 20 - 3}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Bars({
  items,
}: {
  items: { label: string; value: number; display?: string; color: string; emphasis?: boolean }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={item.emphasis ? "font-medium text-chalk" : "text-mist"}>{item.label}</span>
            <span className="font-mono text-xs text-chalk">{item.display ?? `${item.value}%`}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ColumnChart({
  items,
  unit = "",
}: {
  items: { label: string; count: number }[];
  unit?: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="flex items-end gap-3" role="img" aria-label="Rank distribution">
      {items.map((item, i) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="font-mono text-xs text-mist">
            {item.count}
            {unit}
          </span>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-iris/60 to-iris/25"
            style={{ height: `${8 + (item.count / max) * 96}px`, opacity: 1 - i * 0.12 }}
          />
          <span className="font-mono text-[0.6rem] text-mist-dim">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutGauge({ value, label }: { value: number; label: string }) {
  const size = 168;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-normal italic text-chalk">{value}</span>
        <span className="mt-1 font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">{label}</span>
      </div>
    </div>
  );
}
