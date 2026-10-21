import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="strip-fill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-highlight-ink opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-highlight-ink" />
      </span>
      {children}
    </span>
  );
}

export function SectionHeading({
  kicker,
  title,
  sub,
  align = "center",
  as: Tag = "h2",
}: {
  kicker?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
  as?: "h1" | "h2";
}) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {kicker && (
        <p className="kicker mb-4">
          <span className="size-1 rounded-full bg-iris" />
          {kicker}
        </p>
      )}
      <Tag className="text-balance text-3xl font-semibold tracking-tight text-chalk sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
        {title}
      </Tag>
      {sub && <p className="mt-5 text-pretty text-base leading-relaxed text-mist sm:text-lg">{sub}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass glass-hover rounded-2xl ${className}`}>{children}</div>;
}
