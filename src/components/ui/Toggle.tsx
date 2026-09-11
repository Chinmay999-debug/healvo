import { cn } from "../../lib/utils";

export function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full border transition-colors",
        checked
          ? "border-transparent bg-[var(--color-teal)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-canvas)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-[18px] w-[18px] transform rounded-full bg-[var(--color-toggle-knob)] shadow transition-transform",
          checked ? "translate-x-[23px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
