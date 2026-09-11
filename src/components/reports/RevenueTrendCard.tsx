import { useMemo } from "react";
import { Card } from "../ui/Card";
import { cn, formatINR, formatINRCompact } from "../../lib/utils";
import { useClinicData } from "../../state/clinicData";
import { bucketPayments, sumPayments } from "../../lib/revenue";
import {
  COMPARISON_PERIOD_LABELS,
  GRANULARITY_UNIT_LABEL,
  REPORT_PERIOD_OPTIONS,
  formatPeriodRangeLabel,
  getComparisonPeriodRange,
  getReportBuckets,
  getReportGranularity,
  type DateRange,
  type ReportPeriodKey,
} from "../../lib/reportPeriod";
import { TrendChart, type TrendChartPoint } from "./TrendChart";

const REVENUE_COLOR = "var(--color-teal)";

export function RevenueTrendCard({
  range,
  periodKey,
}: {
  range: DateRange;
  periodKey: ReportPeriodKey;
}) {
  const { bills } = useClinicData();

  const { data, total, highest, average, comparisonPct, granularity } = useMemo(() => {
    const granularity = getReportGranularity(periodKey, range);
    const buckets = getReportBuckets(range, granularity);
    const totals = bucketPayments(bills, range, buckets, granularity);

    const data: TrendChartPoint[] = buckets.map((b) => ({
      label: b.label,
      tooltipTitle: b.tooltipTitle,
      tooltipSubtitle: b.tooltipSubtitle,
      value: totals.get(b.key) ?? 0,
    }));

    const total = data.reduce((sum, p) => sum + p.value, 0);
    const highest = data.reduce((max, p) => (p.value > max.value ? p : max), data[0]);
    const average = data.length > 0 ? total / data.length : 0;

    const previousRange = getComparisonPeriodRange(periodKey, range);
    const previousTotal = sumPayments(bills, previousRange);
    const comparisonPct = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;

    return { data, total, highest, average, comparisonPct, granularity };
  }, [bills, range, periodKey]);

  const periodDisplayLabel =
    periodKey === "custom"
      ? formatPeriodRangeLabel(range)
      : (REPORT_PERIOD_OPTIONS.find((o) => o.key === periodKey)?.label ?? "");

  const unit = GRANULARITY_UNIT_LABEL[granularity];

  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Revenue Trend</h2>
      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">Collection over time</p>

      {total > 0 ? (
        <div className="mt-3.5">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted-soft)]">
            Revenue · {periodDisplayLabel}
          </div>
          <div className="mt-1 text-[26px] font-extrabold tracking-tight text-[var(--color-ink)]">
            {formatINR(total)}
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
          <h3 className="text-[15px] font-bold text-[var(--color-ink)]">No revenue yet</h3>
          <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
            There hasn&apos;t been any collection during this period.
          </p>
        </div>
      )}

      <div className="mt-3.5">
        <TrendChart
          data={data}
          granularity={granularity}
          color={REVENUE_COLOR}
          gradientId="reportsRevenueFill"
          yTickFormatter={formatINRCompact}
          tooltipValueFormatter={formatINR}
        />
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center gap-6 border-t border-[var(--color-border)] pt-3.5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-soft)]">
              Highest
            </div>
            <div className="mt-0.5 text-[14px] font-bold text-[var(--color-ink)]">
              {formatINR(highest.value)}
            </div>
            <div className="text-[11.5px] text-[var(--color-muted)]">{highest.tooltipTitle}</div>
          </div>
          <div className="h-8 w-px bg-[var(--color-border)]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-soft)]">
              Average
            </div>
            <div className="mt-0.5 text-[14px] font-bold text-[var(--color-ink)]">
              {formatINR(average)}{" "}
              <span className="text-[12px] font-normal text-[var(--color-muted)]">/ {unit}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
