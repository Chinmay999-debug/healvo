import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-ink-solid)] text-[var(--color-ink-solid-text)] hover:bg-[var(--color-ink-solid-hover)] border border-transparent",
  secondary:
    "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)] hover:bg-[var(--color-mint-bg-hover)] border border-transparent",
  outline:
    "bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] border border-[var(--color-border-strong)]",
  ghost:
    "bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-canvas)] border border-transparent",
  danger:
    "bg-[var(--color-surface)] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] border border-[var(--color-danger-text)]/30",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
