import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-iris to-aqua text-white shadow-[0_8px_40px_-8px_rgba(139,92,246,0.6)] hover:shadow-[0_8px_48px_-4px_rgba(139,92,246,0.8)] hover:brightness-110",
  secondary: "glass glass-hover text-chalk",
  ghost: "text-mist hover:text-chalk",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-4 py-2",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-7 py-3.5",
};

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  href?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export function Button({
  variant = "primary",
  size = "md",
  href,
  children,
  className = "",
  disabled = false,
  onClick,
  type = "button",
}: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if (!href && !onClick) {
    return (
      <button type={type} disabled={disabled} onClick={onClick} className={cls} aria-disabled={disabled}>
        {children}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }

  // href is not set but onClick is - render as button
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls} aria-disabled={disabled}>
      {children}
    </button>
  );
}

export function ButtonArrow({
  variant = "primary",
  size = "md",
  href,
  children,
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button variant={variant} size={size} href={href} className={className}>
      {children}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M1 7h12m0 0L8 2m5 5L8 12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  );
}
