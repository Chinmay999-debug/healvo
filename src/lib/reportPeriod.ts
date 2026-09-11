// Shared report-period logic for the Reports tab — a single source of truth
// for the selected date range so Revenue Trend and Patient Trend always
// derive from exactly the same window.

import { dateFromISO, isoDate, parseTimeOnDate } from "./utils";

export type ReportPeriodKey = "today" | "week" | "month" | "6m" | "year" | "custom";

export interface ReportPeriodOption {
  key: ReportPeriodKey;
  label: string;
}

export const REPORT_PERIOD_OPTIONS: ReportPeriodOption[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "6m", label: "Last 6 months" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom range" },
];

export interface DateRange {
  /** Local midnight of the first included day. */
  start: Date;
  /** Local midnight of the last included day (inclusive). */
  end: Date;
}

export interface CustomRange {
  from: string;
  to: string;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function minDate(a: Date, b: Date) {
  return a < b ? a : b;
}

// Report windows never extend past today — a clinic can't have collected
// revenue or seen visits on days that haven't happened yet.
export function getPeriodRange(key: ReportPeriodKey, custom?: CustomRange | null): DateRange {
  const today = startOfDay(new Date());

  switch (key) {
    case "today":
      return { start: today, end: today };
    case "week":
      return { start: startOfWeek(today), end: minDate(endOfWeek(today), today) };
    case "month":
      return { start: startOfMonth(today), end: minDate(endOfMonth(today), today) };
    case "6m":
      return { start: new Date(today.getFullYear(), today.getMonth() - 5, 1), end: today };
    case "year":
      return { start: new Date(today.getFullYear(), 0, 1), end: today };
    case "custom": {
      if (custom?.from && custom?.to) {
        const from = startOfDay(dateFromISO(custom.from));
        const to = startOfDay(dateFromISO(custom.to));
        return from <= to ? { start: from, end: to } : { start: to, end: from };
      }
      return { start: today, end: today };
    }
  }
}

/** e.g. "01 Aug – 25 Aug 2026" */
export function formatPeriodRangeLabel(range: DateRange) {
  const sameYear = range.start.getFullYear() === range.end.getFullYear();
  const startLabel = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(range.start);
  const endLabel = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(range.end);
  return `${startLabel} – ${endLabel}`;
}

export function isWithinRange(iso: string, range: DateRange) {
  const d = dateFromISO(iso);
  return d >= range.start && d <= range.end;
}

// The equal-length window immediately preceding the current range — the
// standard "vs previous period" comparison baseline.
export function getPreviousPeriodRange(range: DateRange): DateRange {
  const durationMs = range.end.getTime() - range.start.getTime();
  const previousEnd = new Date(range.start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { start: previousStart, end: previousEnd };
}

// ==========================================================================
// Real time-series bucketing — hour/day/week/month resolution driven by the
// selected report period, so a trend chart never collapses a multi-bucket
// window into a single aggregate. Shared by every Reports trend card.
// ==========================================================================

export type ReportGranularity = "hour" | "day" | "week" | "month";

/** Unit word for "Average / ___" style summary lines — shared by every trend card. */
export const GRANULARITY_UNIT_LABEL: Record<ReportGranularity, string> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
};

export interface ReportBucket {
  /** Stable identity for this bucket, used to accumulate matching records. */
  key: string;
  /** Short axis label, e.g. "9 AM", "Mon", "Week 3", "Aug". */
  label: string;
  /** Primary tooltip line, e.g. "9:00 AM", "Tuesday, 25 Aug", "Week 3", "August 2026". */
  tooltipTitle: string;
  /** Secondary tooltip line, only present when the primary label needs disambiguation (weeks). */
  tooltipSubtitle?: string;
  /** Inclusive lower/upper bounds this bucket covers (exact for hour, whole days otherwise). */
  start: Date;
  end: Date;
}

const CLINIC_START_HOUR = 9;
const CLINIC_END_HOUR = 19; // 7 PM

function reportDayCount(range: DateRange) {
  return Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
}

// today -> hourly (real intraday trend); week -> daily; month -> calendar
// weeks; 6m/year -> monthly; custom scales by how long the picked range is.
export function getReportGranularity(
  periodKey: ReportPeriodKey,
  range: DateRange,
): ReportGranularity {
  switch (periodKey) {
    case "today":
      return "hour";
    case "week":
      return "day";
    case "month":
      return "week";
    case "6m":
    case "year":
      return "month";
    case "custom": {
      const days = reportDayCount(range);
      if (days <= 7) return "day";
      if (days <= 60) return "week";
      return "month";
    }
  }
}

function formatHourLabel(hour: number, withMinutes: boolean) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return withMinutes ? `${displayHour}:00 ${period}` : `${displayHour} ${period}`;
}

function getHourBuckets(range: DateRange): ReportBucket[] {
  const buckets: ReportBucket[] = [];
  for (let hour = CLINIC_START_HOUR; hour <= CLINIC_END_HOUR; hour++) {
    const start = new Date(range.start);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(range.start);
    end.setHours(hour, 59, 59, 999);
    buckets.push({
      key: `h${hour}`,
      label: formatHourLabel(hour, false),
      tooltipTitle: formatHourLabel(hour, true),
      start,
      end,
    });
  }
  return buckets;
}

function getDayBuckets(range: DateRange): ReportBucket[] {
  const buckets: ReportBucket[] = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    const day = startOfDay(cursor);
    buckets.push({
      key: isoDate(cursor),
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(cursor),
      tooltipTitle: new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(cursor),
      start: day,
      end: day,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function formatWeekSubtitle(start: Date, end: Date) {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    end,
  );
  return `${startLabel}–${endLabel}`;
}

// Weeks align to real Mon–Sun calendar boundaries (clipped to the selected
// range), so a partial first/last week is exactly as long as it really is —
// never an arbitrary 7-day chunk starting from day 1.
function getWeekBuckets(range: DateRange): ReportBucket[] {
  const buckets: ReportBucket[] = [];
  let cursor = new Date(range.start);
  let index = 0;

  while (cursor <= range.end) {
    const weekStart = startOfWeek(cursor);
    const weekEnd = endOfWeek(cursor);
    const bucketStart = weekStart < range.start ? range.start : weekStart;
    const bucketEnd = weekEnd > range.end ? range.end : weekEnd;
    index += 1;

    buckets.push({
      key: isoDate(weekStart),
      label: `Week ${index}`,
      tooltipTitle: `Week ${index}`,
      tooltipSubtitle: formatWeekSubtitle(bucketStart, bucketEnd),
      start: bucketStart,
      end: bucketEnd,
    });

    cursor = new Date(bucketEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function getMonthBuckets(range: DateRange): ReportBucket[] {
  const buckets: ReportBucket[] = [];
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const last = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  const referenceYear = range.end.getFullYear();

  while (cursor <= last) {
    const monthStart = startOfMonth(cursor);
    const monthEndCalendar = endOfMonth(cursor);
    const bucketStart = monthStart < range.start ? range.start : monthStart;
    const bucketEnd = monthEndCalendar > range.end ? range.end : monthEndCalendar;
    const showYear = cursor.getFullYear() !== referenceYear;

    buckets.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-IN", {
        month: "short",
        year: showYear ? "2-digit" : undefined,
      }).format(cursor),
      tooltipTitle: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
        cursor,
      ),
      start: bucketStart,
      end: bucketEnd,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

export function getReportBuckets(range: DateRange, granularity: ReportGranularity): ReportBucket[] {
  switch (granularity) {
    case "hour":
      return getHourBuckets(range);
    case "day":
      return getDayBuckets(range);
    case "week":
      return getWeekBuckets(range);
    case "month":
      return getMonthBuckets(range);
  }
}

// Locates which bucket a record belongs to. Hour buckets clamp out-of-hours
// timestamps to the nearest edge bucket rather than silently dropping them.
export function findReportBucket(
  buckets: ReportBucket[],
  dateIso: string,
  granularity: ReportGranularity,
  time?: string,
): ReportBucket | undefined {
  if (buckets.length === 0) return undefined;

  if (granularity === "hour") {
    const at = parseTimeOnDate(dateIso, time ?? "12:00 PM");
    if (at <= buckets[0].start) return buckets[0];
    if (at >= buckets[buckets.length - 1].end) return buckets[buckets.length - 1];
    return buckets.find((b) => at >= b.start && at <= b.end);
  }

  const d = dateFromISO(dateIso);
  return buckets.find((b) => d >= b.start && d <= b.end);
}

// Calendar-aware "previous period" for comparisons — a full previous
// week/month/year rather than a mechanically shifted window, except for
// custom ranges where an equal-length lookback is the only sensible default.
export function getComparisonPeriodRange(
  periodKey: ReportPeriodKey,
  range: DateRange,
): DateRange {
  switch (periodKey) {
    case "today": {
      const prevDay = new Date(range.start);
      prevDay.setDate(prevDay.getDate() - 1);
      return { start: prevDay, end: prevDay };
    }
    case "week": {
      const prevStart = new Date(range.start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(prevStart);
      prevEnd.setDate(prevEnd.getDate() + 6);
      return { start: prevStart, end: prevEnd };
    }
    case "month": {
      const prevMonthStart = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
      const prevMonthEnd = new Date(range.start.getFullYear(), range.start.getMonth(), 0);
      return { start: prevMonthStart, end: prevMonthEnd };
    }
    case "6m": {
      const prevEnd = new Date(range.start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - 5, 1);
      return { start: prevStart, end: prevEnd };
    }
    case "year": {
      const prevYear = range.start.getFullYear() - 1;
      return { start: new Date(prevYear, 0, 1), end: new Date(prevYear, 11, 31) };
    }
    case "custom":
    default:
      return getPreviousPeriodRange(range);
  }
}

export const COMPARISON_PERIOD_LABELS: Record<ReportPeriodKey, string> = {
  today: "vs yesterday",
  week: "vs last week",
  month: "vs last month",
  "6m": "vs previous 6 months",
  year: "vs last year",
  custom: "vs previous period",
};
