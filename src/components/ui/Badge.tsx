import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type BadgeTone = "mint" | "blue" | "amber" | "slate";

const toneClasses: Record<BadgeTone, string> = {
  mint: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  blue: "bg-[var(--color-blue-bg)] text-[var(--color-blue-text)]",
  amber: "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]",
  slate: "bg-[var(--color-slate-bg)] text-[var(--color-slate-text)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "slate", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
