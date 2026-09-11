import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { cn, formatINR, formatINRCompact, dateFromISO, todayISO } from "../../lib/utils";
import { useClinicData } from "../../state/clinicData";
import { bucketPayments, sumPayments } from "../../lib/revenue";
import { getPreviousPeriodRange, getReportBuckets, type DateRange } from "../../lib/reportPeriod";

type RevenueRange = "7d" | "30d" | "3m";

const ranges: { key: RevenueRange; label: string; days: number }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
];

function trailingRange(days: number): DateRange {
  const end = dateFromISO(todayISO());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
}

export function RevenueChart() {
  const [rangeKey, setRangeKey] = useState<RevenueRange>("30d");
  const { bills, dataLoading } = useClinicData();

  const selected = ranges.find((r) => r.key === rangeKey)!;
  // "3 months" trends best at weekly resolution (~13 points) — daily would
  // be ~90 near-illegible ticks; 7/30-day views stay daily, same as before.
  const granularity = rangeKey === "3m" ? "week" : "day";

  const { data, total, comparisonPct } = useMemo(() => {
    const range = trailingRange(selected.days);
    const buckets = getReportBuckets(range, granularity);
    const totals = bucketPayments(bills, range, buckets, granularity);

    const data = buckets.map((b) => ({ label: b.label, value: totals.get(b.key) ?? 0 }));
    const total = data.reduce((sum, p) => sum + p.value, 0);

    const previousRange = getPreviousPeriodRange(range);
    const previousTotal = sumPayments(bills, previousRange);
    const comparisonPct =
      previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;

    return { data, total, comparisonPct };
  }, [bills, selected.days, granularity]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
            Revenue Trend
          </h2>
          {dataLoading && total === 0 ? (
            <div className="mt-1 text-[13px] text-[var(--color-muted)]">Loading…</div>
          ) : total > 0 ? (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[19px] font-extrabold tracking-tight text-[var(--color-ink)]">
                {formatINR(total)}
              </span>
              {comparisonPct !== null && (
                <Badge tone={comparisonPct >= 0 ? "mint" : "amber"}>
                  {comparisonPct >= 0 ? "↑" : "↓"} {Math.abs(comparisonPct).toFixed(1)}%
                </Badge>
              )}
              <span className="text-[12px] text-[var(--color-muted)]">
                · {selected.label}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-[13px] text-[var(--color-muted)]">
              No revenue collected in the last {selected.label}.
            </div>
          )}
        </div>

        <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-0.5">
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                rangeKey === r.key
                  ? "bg-[var(--color-surface-raised)] text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 h-[130px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-teal)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-teal)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 5"
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--color-muted-soft)" }}
              interval={data.length > 12 ? Math.ceil(data.length / 8) : 0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--color-muted-soft)" }}
              tickFormatter={formatINRCompact}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              formatter={(value) => [formatINR(Number(value)), "Revenue"]}
              contentStyle={{
                borderRadius: 10,
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-surface-raised)",
                color: "var(--color-ink)",
                fontSize: 12.5,
                boxShadow: "0 4px 16px rgba(15, 34, 58, 0.08)",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-teal)"
              strokeWidth={2.25}
              fill="url(#revenueFill)"
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
