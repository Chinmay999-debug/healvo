export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Extracts a human-readable message from a caught `unknown` error.
 * Supabase-js's `{ data, error }` tuple returns `error` as a plain object
 * (`{ message, code, details, hint }`, parsed straight from the response
 * body) — NOT a real `Error` instance — even though every call site in this
 * app does `if (error) throw error`. A bare `err instanceof Error` check
 * therefore fails for the overwhelming majority of real Supabase failures
 * (unique-constraint violations, RLS denials, validation errors) and
 * silently falls back to a generic message, hiding the actual cause from
 * both the user and anyone debugging a bug report. This handles both
 * shapes so a real error message always reaches the UI. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string" &&
    (err as { message: string }).message
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact axis/tick form of a rupee amount — e.g. "₹5k", "₹1,50,000" stays
 * exact below ₹1,000 rather than rounding to "₹0k" or "₹1k". Shared by
 * every revenue chart so a small clinic's real amounts never get mangled
 * by a "divide by 1000" tick formatter tuned only for large numbers. */
export function formatINRCompact(amount: number) {
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}k`;
  return `₹${Math.round(amount)}`;
}

export function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase();
}

/** The public booking route for a given clinic slug — the single place
 * that builds this URL, so every internal "open/copy booking link" spot
 * (Today.tsx, PatientRecordHeader.tsx, QuickActionMenu.tsx,
 * BookingSettingsPanel.tsx) derives it from the real active clinic's slug
 * instead of each hardcoding its own copy of the old mock path. */
export function buildBookingUrl(slug: string) {
  return {
    path: `/book/${slug}`,
    displayUrl: `healvo.in/book/${slug}`,
  };
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return isoDate(new Date());
}

/** e.g. "25 August 2026" */
export function fullDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** e.g. "Tuesday, 26 August" */
export function weekdayDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** e.g. "Wed, 27 Aug" */
export function shortWeekdayDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** e.g. "25 Aug 2026" */
export function shortDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Parses an ISO "YYYY-MM-DD" string into a local Date. */
export function dateFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** e.g. "10:42 AM" — matches the "hh:mm AM/PM" format used across mock visit times */
export function nowTimeLabel() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Parses "hh:mm AM/PM" into minutes since midnight. */
export function timeToMinutes(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return 0;
  const [, h, m, period] = match;
  let hours = parseInt(h, 10) % 12;
  if (period.toUpperCase() === "PM") hours += 12;
  return hours * 60 + parseInt(m, 10);
}

/** e.g. "Just now", "12m ago", "3h ago", "Yesterday", "5d ago", "3w ago" —
 * falls back to `shortDateLabel` beyond a month. */
export function relativeTimeLabel(date: Date) {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return shortDateLabel(date);
}

/** e.g. "2.4 MB" or "180 KB" */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "09:30 AM" -> "09:30:00", for Postgres `time` columns. */
export function labelToTime24(label: string): string {
  const minutes = timeToMinutes(label);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** "09:30:00" or "09:30" (Postgres `time`) -> "09:30 AM". */
export function time24ToLabel(time: string): string {
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10) % 24;
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export function parseTimeOnDate(iso: string, time: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setMinutes(timeToMinutes(time));
  return date;
}
