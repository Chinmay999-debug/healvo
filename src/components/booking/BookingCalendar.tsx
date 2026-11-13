import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, dateFromISO, isoDate, weekdayDateLabel } from "../../lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** First of the month for an ISO date, as "YYYY-MM". */
function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return isoDate(d).slice(0, 7);
}

/**
 * Month calendar for the public booking page. It does not decide
 * availability: only the ISO dates in `bookableDates` (from
 * public_booking_get_dates, which applies the clinic's working days, hours,
 * breaks, lead time, existing bookings and booking window) can be picked.
 * Everything else — past days, closed days, fully booked days, days beyond
 * the window — renders disabled.
 */
export function BookingCalendar({
  bookableDates,
  selected,
  today,
  windowDays,
  onSelect,
}: {
  bookableDates: string[];
  selected: string | null;
  /** Clinic-relative "today" as ISO, used only to mark the current day. */
  today: string;
  /** Booking window length; month navigation stops at today + windowDays. */
  windowDays: number;
  onSelect: (iso: string) => void;
}) {
  const bookable = useMemo(() => new Set(bookableDates), [bookableDates]);
  // Navigation spans the booking window. Which days are selectable is still
  // decided only by bookableDates (server-computed in the clinic timezone).
  const windowEnd = dateFromISO(today);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  const firstMonth = monthKey(today);
  const lastMonth = monthKey(isoDate(windowEnd));

  const [month, setMonth] = useState(() =>
    selected && bookable.has(selected) ? monthKey(selected) : firstMonth,
  );

  const cells = useMemo(() => {
    const first = dateFromISO(`${month}-01`);
    const lead = first.getDay();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      out.push(`${month}-${String(day).padStart(2, "0")}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    dateFromISO(`${month}-01`),
  );
  const canPrev = month > firstMonth;
  const canNext = month < lastMonth;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          disabled={!canPrev}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-[13.5px] font-bold text-[var(--color-ink)]" aria-live="polite">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={!canNext}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-[11px] font-semibold text-[var(--color-muted-soft)]">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`blank-${i}`} />;
          const enabled = bookable.has(iso);
          const isSelected = iso === selected;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(iso)}
              aria-label={weekdayDateLabel(dateFromISO(iso))}
              aria-pressed={isSelected}
              className={cn(
                "mx-auto flex h-9 w-full max-w-[40px] items-center justify-center rounded-lg text-[13px] font-semibold transition-colors",
                isSelected && "bg-[var(--color-teal)] text-white",
                !isSelected && enabled &&
                  "text-[var(--color-ink)] hover:bg-[var(--color-canvas)] border border-[var(--color-border-strong)]",
                !enabled && "cursor-not-allowed text-[var(--color-muted-soft)] opacity-40",
                isToday && !isSelected && "underline underline-offset-4",
              )}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11.5px] text-[var(--color-muted)]">
        Greyed-out dates are closed, fully booked or outside the booking window.
      </p>
    </div>
  );
}
