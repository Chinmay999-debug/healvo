// The compact input/label pairing used by every modal form across the app
// (Add/Edit Patient, Add Staff, Walk-in, Create Bill, Add Document, Settings
// panels) — previously the exact same string was redeclared locally in each
// of those files. Centralized here so the shared style has one source of
// truth instead of nine copies that could drift. Distinct from (and not a
// replacement for) onboarding/fieldStyles.ts, which is deliberately a size
// step up for the roomier full-page onboarding forms.
export const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15";

export const labelClass = "text-[12px] font-semibold text-[var(--color-muted)]";
