import { useMemo } from "react";
import { Card } from "../ui/Card";
import { cn, todayISO } from "../../lib/utils";
import { useClinicData } from "../../state/clinicData";
import {
  COMPARISON_PERIOD_LABELS,
  GRANULARITY_UNIT_LABEL,
  REPORT_PERIOD_OPTIONS,
  findReportBucket,
  formatPeriodRangeLabel,
  getComparisonPeriodRange,
  getReportBuckets,
  getReportGranularity,
  isWithinRange,
  type DateRange,
  type ReportPeriodKey,
} from "../../lib/reportPeriod";
import { TrendChart, type TrendChartPoint } from "./TrendChart";

interface CompletedVisit {
  date?: string;
  time?: string;
  status: string;
}

const PATIENT_COLOR = "var(--color-teal)";

function formatVisits(value: number) {
  return `${value} visit${value === 1 ? "" : "s"}`;
}

function formatCount(value: number) {
  return `${value}`;
}

// A "visit" only counts once it has actually happened — a scheduled
// appointment that hasn't started yet isn't clinic activity yet, and a
// cancelled one never happened at all (it must be excluded just as
// deliberately as "scheduled", not left in by omission).
function hasOccurred(status: string) {
  return status !== "scheduled" && status !== "cancelled";
}

function sumVisits(visits: CompletedVisit[], range: DateRange) {
  let count = 0;
  for (const visit of visits) {
    if (!hasOccurred(visit.status)) continue;
    const date = visit.date ?? todayISO();
    if (!isWithinRange(date, range)) continue;
    count += 1;
  }
  return count;
}

export function PatientTrendCard({
  range,
  periodKey,
}: {
  range: DateRange;
  periodKey: ReportPeriodKey;
}) {
  const { visits } = useClinicData();

  const { data, total, highest, average, comparisonPct, granularity } = useMemo(() => {
    const granularity = getReportGranularity(periodKey, range);
    const buckets = getReportBuckets(range, granularity);
    const counts = new Map(buckets.map((b) => [b.key, 0]));

    for (const visit of visits) {
      if (!hasOccurred(visit.status)) continue;
      const date = visit.date ?? todayISO();
      if (!isWithinRange(date, range)) continue;
      const bucket = findReportBucket(buckets, date, granularity, visit.time);
      if (!bucket) continue;
      counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
    }

    const data: TrendChartPoint[] = buckets.map((b) => ({
      label: b.label,
      tooltipTitle: b.tooltipTitle,
      tooltipSubtitle: b.tooltipSubtitle,
      value: counts.get(b.key) ?? 0,
    }));

    const total = data.reduce((sum, p) => sum + p.value, 0);
    const highest = data.reduce((max, p) => (p.value > max.value ? p : max), data[0]);
    const average = data.length > 0 ? total / data.length : 0;

    const previousRange = getComparisonPeriodRange(periodKey, range);
    const previousTotal = sumVisits(visits, previousRange);
    const comparisonPct = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;

    return { data, total, highest, average, comparisonPct, granularity };
  }, [visits, range, periodKey]);

  const periodDisplayLabel =
    periodKey === "custom"
      ? formatPeriodRangeLabel(range)
      : (REPORT_PERIOD_OPTIONS.find((o) => o.key === periodKey)?.label ?? "");

  const unit = GRANULARITY_UNIT_LABEL[granularity];

  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Patient Trend</h2>
      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">Patient visits over time</p>

      {total > 0 ? (
        <div className="mt-3.5">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted-soft)]">
            Patient visits · {periodDisplayLabel}
          </div>
          <div className="mt-1 text-[26px] font-extrabold tracking-tight text-[var(--color-ink)]">
            {total}
          </div>
          {comparisonPct !== null && (
            <div
              className={cn(
                "mt-1 text-[12.5px] font-semibold",
                comparisonPct >= 0
                  ? "text-[var(--color-mint-text)]"
                  : "text-[var(--color-amber-text)]",
              )}
            >
              {comparisonPct >= 0 ? "↑" : "↓"} {Math.abs(comparisonPct).toFixed(1)}%{" "}
              <span className="font-normal text-[var(--color-muted)]">
                {COMPARISON_PERIOD_LABELS[periodKey]}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3.5">
          <h3 className="text-[15px] font-bold text-[var(--color-ink)]">No patient visits yet</h3>
          <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
            There hasn&apos;t been any patient activity during this period.
          </p>
        </div>
      )}

      <div className="mt-3.5">
        <TrendChart
          data={data}
          granularity={granularity}
          color={PATIENT_COLOR}
          gradientId="reportsPatientFill"
          yTickFormatter={formatCount}
          tooltipValueFormatter={formatVisits}
        />
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center gap-6 border-t border-[var(--color-border)] pt-3.5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-soft)]">
              Highest
            </div>
            <div className="mt-0.5 text-[14px] font-bold text-[var(--color-ink)]">
              {formatVisits(highest.value)}
            </div>
            <div className="text-[11.5px] text-[var(--color-muted)]">{highest.tooltipTitle}</div>
          </div>
          <div className="h-8 w-px bg-[var(--color-border)]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-soft)]">
              Average
            </div>
            <div className="mt-0.5 text-[14px] font-bold text-[var(--color-ink)]">
              {average.toFixed(1)}{" "}
              <span className="text-[12px] font-normal text-[var(--color-muted)]">
                visits / {unit}
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
