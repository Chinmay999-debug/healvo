import { cn } from "../../lib/utils";

export function Logo({
  className,
  light = false,
}: {
  className?: string;
  /** White-on-dark variant for the gradient auth brand panel — everywhere
   * else renders on a light surface and uses the default ink/teal pair. */
  light?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-extrabold tracking-tight text-[22px] leading-none select-none",
        className,
      )}
    >
      <span className={light ? "text-white" : "text-[var(--color-ink)]"}>Heal</span>
      <span className={light ? "text-white/70" : "text-[var(--color-teal)]"}>vo</span>
    </span>
  );
}
