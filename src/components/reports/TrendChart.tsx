import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReportGranularity } from "../../lib/reportPeriod";

// Shared chart engine for every Reports trend card — Revenue Trend and
// Patient Trend render through this exact same component so bucket
// rendering, tooltip structure, zero-value handling, axis philosophy, and
// horizontal scrolling behavior always stay identical. Only the metric
// (color, gradient id, value formatting) differs per card.

export interface TrendChartPoint {
  label: string;
  tooltipTitle: string;
  tooltipSubtitle?: string;
  value: number;
}

// A year of monthly buckets doesn't comfortably fit a normal card width —
// give each bucket real breathing room and let the chart scroll instead of
// cramming/thinning labels. Only long monthly views ever hit this.
const MIN_BUCKET_WIDTH = 90;
const AXIS_TICK_WIDTH = 40;
const AXIS_PANE_WIDTH = 52;

function ChartGradientDefs({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.22} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

function ChartTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: { payload: TrendChartPoint }[];
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 shadow-[0_4px_16px_rgba(15,34,58,0.08)]">
      <div className="text-[11.5px] font-semibold text-[var(--color-muted)]">
        {point.tooltipTitle}
      </div>
      {point.tooltipSubtitle && (
        <div className="text-[11px] text-[var(--color-muted-soft)]">{point.tooltipSubtitle}</div>
      )}
      <div className="mt-0.5 text-[13px] font-bold text-[var(--color-ink)]">
        {formatValue(point.value)}
      </div>
    </div>
  );
}

interface ChartStyle {
  data: TrendChartPoint[];
  color: string;
  gradientId: string;
  yTickFormatter: (value: number) => string;
  tooltipValueFormatter: (value: number) => string;
}

// Frozen-axis pattern: one chart renders only the Y-axis and stays fixed;
// a second, wider chart (same data, hidden Y-axis) scrolls horizontally
// underneath it. A slider mirrors the scroll position instead of relying on
// the browser's default scrollbar.
function ScrollableTrendChart({ data, color, gradientId, yTickFormatter, tooltipValueFormatter }: ChartStyle) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const innerWidth = data.length * MIN_BUCKET_WIDTH;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [data]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollPct(max > 0 ? (el.scrollLeft / max) * 100 : 0);
  }

  function handleSliderChange(e: ChangeEvent<HTMLInputElement>) {
    const el = scrollRef.current;
    if (!el) return;
    const pct = Number(e.target.value);
    const max = el.scrollWidth - el.clientWidth;
    el.scrollLeft = (pct / 100) * max;
    setScrollPct(pct);
  }

  return (
    <div>
      <div className="relative h-[200px] w-full">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 bg-[var(--color-surface)]"
          style={{ width: AXIS_PANE_WIDTH }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-soft)" }}
                tickFormatter={yTickFormatter}
                allowDecimals={false}
                width={AXIS_TICK_WIDTH}
              />
              {/* Invisible — exists only so this axis computes the exact same
                  "nice" domain as the scrolling chart below. */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill="none"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ paddingLeft: AXIS_PANE_WIDTH }}
          className="h-full overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div style={{ width: innerWidth, minWidth: "100%" }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <ChartGradientDefs id={gradientId} color={color} />
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
                  interval={0}
                  padding={{ left: 12, right: 12 }}
                />
                <YAxis hide width={0} allowDecimals={false} />
                <Tooltip
                  content={<ChartTooltip formatValue={tooltipValueFormatter} />}
                  cursor={{ stroke: "var(--color-border-strong)" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.25}
                  fill={`url(#${gradientId})`}
                  dot={{ r: 3, strokeWidth: 0, fill: color }}
                  activeDot={{ r: 4.5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {hasOverflow && (
        <input
          type="range"
          min={0}
          max={100}
          value={scrollPct}
          onChange={handleSliderChange}
          aria-label="Scroll chart horizontally"
          className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--trend-accent)]"
          style={{ ["--trend-accent" as string]: color }}
        />
      )}
    </div>
  );
}

export function TrendChart({
  data,
  granularity,
  color,
  gradientId,
  yTickFormatter,
  tooltipValueFormatter,
}: ChartStyle & { granularity: ReportGranularity }) {
  const needsScroll = granularity === "month" && data.length > 6;

  if (needsScroll) {
    return (
      <ScrollableTrendChart
        data={data}
        color={color}
        gradientId={gradientId}
        yTickFormatter={yTickFormatter}
        tooltipValueFormatter={tooltipValueFormatter}
      />
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <ChartGradientDefs id={gradientId} color={color} />
          <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-muted-soft)" }}
            interval={0}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-muted-soft)" }}
            tickFormatter={yTickFormatter}
            allowDecimals={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip formatValue={tooltipValueFormatter} />}
            cursor={{ stroke: "var(--color-border-strong)" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.25}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, strokeWidth: 0, fill: color }}
            activeDot={{ r: 4.5, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
