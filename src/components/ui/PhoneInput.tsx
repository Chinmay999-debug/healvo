import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { DEFAULT_COUNTRY_CODE } from "../../lib/phone";

type Size = "sm" | "md";

const sizeClasses: Record<Size, { prefix: string; input: string }> = {
  sm: { prefix: "px-3 text-[13px]", input: "px-3 py-2 text-[13px]" },
  md: { prefix: "px-3.5 text-[14px]", input: "px-3.5 py-2.5 text-[14px]" },
};

interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "size"> {
  value: string;
  onChange: (localNumber: string) => void;
  size?: Size;
}

/**
 * Compact "[ +91 ] [ 98765 43210 ]" phone entry field. India is the only
 * supported country for now, so the country code is a fixed, non-editable
 * prefix — `value`/`onChange` only ever deal with the 10-digit local number.
 * The full E.164-style value is assembled once via normalizePhone() at the
 * point a patient record is created (see state/clinicData.tsx), not here.
 */
export function PhoneInput({
  value,
  onChange,
  size = "sm",
  className,
  placeholder = "98765 43210",
  ...props
}: PhoneInputProps) {
  const { prefix, input } = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:border-[var(--color-teal)] focus-within:ring-2 focus-within:ring-[var(--color-teal)]/15",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center border-r border-[var(--color-border)] bg-[var(--color-canvas)] font-semibold text-[var(--color-muted)]",
          prefix,
        )}
      >
        {DEFAULT_COUNTRY_CODE}
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder={placeholder}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]",
          input,
        )}
        {...props}
      />
    </div>
  );
}
