// Single definition of "revenue" for every revenue chart/KPI in Healvo:
// money actually collected — the sum of individual payment amounts, on the
// date each payment was recorded — never the billed amount, and never
// gated on a bill's overall paid/partial/unpaid status. A partially-paid
// bill still represents real money collected on the day each payment came
// in; waiting for the bill to become fully "paid" before counting any of
// it (as one earlier implementation did) understates and misdates revenue.
// This matches the definition already used by Overview's "Today's
// Collection" KPI, Billing's "Today's Collection" KPI, and the Healvo AI
// context builder (lib/aiContext.ts) — every consumer should import this
// rather than re-deriving its own sum.

import type { Bill } from "../data/mockData";
import {
  findReportBucket,
  isWithinRange,
  type DateRange,
  type ReportBucket,
  type ReportGranularity,
} from "./reportPeriod";

/** Total payments collected within `range`, across all bills regardless of
 * each bill's overall status. */
export function sumPayments(bills: Bill[], range: DateRange): number {
  let sum = 0;
  for (const bill of bills) {
    for (const payment of bill.payments) {
      if (isWithinRange(payment.date, range)) sum += payment.amount;
    }
  }
  return sum;
}

/** Buckets every payment (not bill) by the date it was actually collected,
 * for a trend chart. Bills spanning multiple payments contribute each
 * payment to its own bucket, not the whole bill to one bucket.
 *
 * `range` must be checked before calling findReportBucket, not left to it —
 * hour-granularity buckets clamp an out-of-range timestamp to the nearest
 * edge bucket (by design, so a visit logged a few minutes outside opening
 * hours still shows up) rather than reporting "no match". Without this
 * filter, every payment ever recorded — regardless of date — would clamp
 * into the first/last bucket of an hourly ("Today") view. */
export function bucketPayments(
  bills: Bill[],
  range: DateRange,
  buckets: ReportBucket[],
  granularity: ReportGranularity,
): Map<string, number> {
  const totals = new Map(buckets.map((b) => [b.key, 0]));
  for (const bill of bills) {
    for (const payment of bill.payments) {
      if (!isWithinRange(payment.date, range)) continue;
      const bucket = findReportBucket(buckets, payment.date, granularity, payment.time);
      if (!bucket) continue;
      totals.set(bucket.key, (totals.get(bucket.key) ?? 0) + payment.amount);
    }
  }
  return totals;
}
