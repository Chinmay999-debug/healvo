import { cn } from "../../lib/utils";

/** Compact horizontal choice control — same teal active/selected treatment
 * used for date/time pills on the public booking page (BookAppointment.tsx),
 * so the Consultation page stays visually consistent with the rest of Healvo. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  activeClassName,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (value: T) => void;
  /** Optional per-option override for the "selected" pill's classes — falls
   * back to the default solid teal fill when omitted, so existing callers
   * (Follow-up, Visit outcome) render exactly as before. */
  activeClassName?: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border px-3.5 py-2 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50",
              selected
                ? (activeClassName?.(option.value) ??
                  "border-transparent bg-[var(--color-teal)] text-white")
                : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
