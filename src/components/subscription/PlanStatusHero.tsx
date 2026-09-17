import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";

export type PlanTone = "trial" | "active" | "attention" | "expired";

/** The hero sits on a fixed dark brand surface in both themes, so its accent
 * colors are literal rather than theme tokens — the tokens would flip to
 * light-mode values and disappear against the navy. */
const TONE_ACCENT: Record<PlanTone, string> = {
  trial: "#5eead4",
  active: "#34d399",
  attention: "#fbbf24",
  expired: "#93a3b5",
};

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function DaysRing({
  days,
  percentUsed,
  accent,
  caption,
}: {
  days: number;
  percentUsed: number;
  accent: string;
  caption: string;
}) {
  const remaining = Math.max(0, Math.min(100, 100 - percentUsed));
  const offset = RING_CIRCUMFERENCE * (1 - remaining / 100);

  return (
    <div
      role="progressbar"
      aria-label="Time left in this period"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(remaining)}
      aria-valuetext={`${days} ${days === 1 ? "day" : "days"} left`}
      className="relative h-[104px] w-[104px] shrink-0 sm:h-[124px] sm:w-[124px]"
    >
      <svg viewBox="0 0 124 124" className="h-full w-full -rotate-90">
        <circle
          cx="62"
          cy="62"
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="9"
        />
        <circle
          cx="62"
          cy="62"
          r={RING_RADIUS}
          fill="none"
          stroke={accent}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="plan-ring-value"
          style={{ "--ring-circumference": `${RING_CIRCUMFERENCE}` } as CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] leading-none font-extrabold tracking-tight text-white tabular-nums sm:text-[30px]">
          {days}
        </span>
        <span className="mt-1 text-[10.5px] font-semibold tracking-wide text-white/55 sm:text-[11px]">{caption}</span>
      </div>
    </div>
  );
}

export interface PlanStatusHeroProps {
  clinicName: string;
  /** Short status word shown in the pill, e.g. "Free trial", "Auto-renews". */
  statusLabel: string;
  tone: PlanTone;
  /** The plan line, e.g. "Monthly plan" or "7-day free trial". */
  title: string;
  /** Supporting sentence under the title — the renewal or expiry promise. */
  caption: ReactNode;
  daysRemaining: number;
  /** Percent of the current window already elapsed; null when unknown. */
  percentUsed: number | null;
  facts: { label: string; value: string }[];
}

export function PlanStatusHero({
  clinicName,
  statusLabel,
  tone,
  title,
  caption,
  daysRemaining,
  percentUsed,
  facts,
}: PlanStatusHeroProps) {
  const accent = TONE_ACCENT[tone];
  const expired = tone === "expired";

  return (
    <section
      className="relative overflow-hidden rounded-xl p-5 shadow-[0_18px_40px_-24px_rgba(10,22,38,0.7)] sm:p-6"
      style={{
        background:
          "radial-gradient(900px circle at 88% -20%, rgba(45,212,191,0.30), transparent 58%)," +
          "radial-gradient(760px circle at -10% 120%, rgba(8,145,178,0.32), transparent 58%)," +
          "var(--color-surface-dark)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10 ring-inset"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em] text-white/50 uppercase">
            Your Healvo plan
          </p>
          <h2 className="mt-1.5 truncate text-[19px] font-extrabold tracking-tight text-white sm:text-[21px]">
            {clinicName}
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white ring-1 ring-white/15 ring-inset">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          {statusLabel}
        </span>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-4 sm:mt-6 sm:gap-8">
        <div className="min-w-0">
          <div className="text-[17px] font-bold text-white sm:text-[18px]">{title}</div>
          {caption && (
            <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-white/65">{caption}</p>
          )}
        </div>

        {percentUsed !== null && !expired && (
          <DaysRing
            days={daysRemaining}
            percentUsed={percentUsed}
            accent={accent}
            caption={daysRemaining === 1 ? "day left" : "days left"}
          />
        )}
      </div>

      {facts.length > 0 && (
        <dl
          className={cn(
            "relative mt-6 grid gap-y-4 border-t border-white/10 pt-4 sm:divide-x sm:divide-white/10",
            facts.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {facts.map((fact, index) => (
            <div key={fact.label} className={index > 0 ? "sm:pl-5" : undefined}>
              <dt className="text-[11px] font-semibold tracking-[0.06em] text-white/45 uppercase">
                {fact.label}
              </dt>
              <dd className="mt-1.5 truncate text-[14px] font-bold text-white tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
