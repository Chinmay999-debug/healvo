import type { ReactNode } from "react";

/** Native checkbox with its label, in the form field language. Used for
 * explicit opt-ins (WhatsApp consent), so it is never pre-checked by itself:
 * the caller always owns `checked`. */
export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug text-[var(--color-ink)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-px h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--color-border-strong)] accent-[var(--color-teal)] disabled:cursor-not-allowed"
      />
      <span>{children}</span>
    </label>
  );
}
