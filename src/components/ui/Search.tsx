import { Search as SearchIcon } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Search({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        size={16}
        strokeWidth={2}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-soft)]"
      />
      <input
        type="text"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15"
        {...props}
      />
    </div>
  );
}
