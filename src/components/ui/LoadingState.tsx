/** Shared placeholder for a list/table's initial Supabase fetch — same
 * footprint (px-8 py-16, centered) as the empty states next to it, so a
 * table doesn't jump size when loading resolves into either rows or a real
 * empty state. Kept to plain muted text, matching the "Loading…" convention
 * already used by the detail pages (PatientRecord, BillDetail, Settings)
 * rather than introducing a spinner/skeleton language of its own. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center px-8 py-16 text-center">
      <p className="text-[13.5px] text-[var(--color-muted)]">{label}</p>
    </div>
  );
}
