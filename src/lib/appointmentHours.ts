// Shared clinic-hours/break-period logic for the Appointments settings
// form. Real slot-availability computation (public booking, P4.7) lives
// server-side in public_booking_slots_for_date() — see
// healvo-backend/supabase/migrations/20260911100000_public_booking.sql —
// since it must be authoritative for an untrusted anonymous caller, not
// just client-side validation. That SQL function mirrors this break-overlap
// concept independently rather than sharing this JS module (there is no
// mechanism to share code between the two runtimes).

import { timeToMinutes } from "./utils";
import type { BreakPeriod } from "../data/mockData";

function overlaps(a: BreakPeriod, b: BreakPeriod): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Validates the clinic's opening/closing times. Overnight hours aren't
 * supported, so closing must be strictly after opening — the same rule the
 * database enforces (clinics_closing_after_opening_check). Returns a short
 * user-facing message, or null when the hours are valid.
 */
export function validateClinicHours(openingTime: string, closingTime: string): string | null {
  if (timeToMinutes(closingTime) <= timeToMinutes(openingTime)) {
    return "Closing time must be later than opening time.";
  }
  return null;
}

/**
 * Validates a single break against clinic hours and every other break.
 * Returns a short user-facing message, or null when the break is valid.
 */
export function validateBreak(
  brk: BreakPeriod,
  openingTime: string,
  closingTime: string,
  otherBreaks: BreakPeriod[],
): string | null {
  const start = timeToMinutes(brk.startTime);
  const end = timeToMinutes(brk.endTime);

  if (start >= end) {
    return "Break must end after it starts.";
  }
  if (start < timeToMinutes(openingTime) || end > timeToMinutes(closingTime)) {
    return "Break must fall within clinic opening hours.";
  }
  if (otherBreaks.some((other) => overlaps(brk, other))) {
    return "Breaks cannot overlap.";
  }
  return null;
}
