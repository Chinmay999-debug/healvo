import { cn } from "../../lib/utils";

export function Avatar({
  initials,
  className,
  size = 36,
}: {
  initials: string;
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-[var(--color-mint-bg)] font-bold text-[var(--color-teal)] shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
      }}
    >
      {initials}
    </div>
  );
}
