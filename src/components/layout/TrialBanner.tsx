import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useSubscription } from "../../state/subscriptionContext";
import { formatAccessDate, planDisplayName } from "../../services/subscription";

const SUBSCRIPTION_PATH = "/settings/subscription";

type Tone = "trial" | "attention";

const TONE: Record<Tone, { strip: string; icon: string }> = {
  trial: {
    strip: "border-[var(--color-mint-text)]/20 bg-[var(--color-mint-bg)]",
    icon: "text-[var(--color-mint-text)]",
  },
  attention: {
    strip: "border-[var(--color-amber-text)]/20 bg-[var(--color-amber-bg)]",
    icon: "text-[var(--color-amber-text)]",
  },
};

/**
 * Slim app-wide notice for the moments that need action: a failed automatic
 * payment still inside its grace period, an active free trial, and a plan that
 * will not renew by itself within 7 days of ending.
 */
export function TrialBanner() {
  const { subscription, isTrial, isActive, inGrace, autoRenew, daysRemaining, endsAt } =
    useSubscription();
  const { pathname } = useLocation();

  if (pathname === SUBSCRIPTION_PATH) return null;

  const endingSoon = isActive && !autoRenew && daysRemaining <= 7;
  if (!inGrace && !isTrial && !endingSoon) return null;

  const days = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const endLabel = endsAt ? formatAccessDate(endsAt, false) : null;

  let tone: Tone;
  let Icon: LucideIcon;
  let message: ReactNode;
  let action: string;

  if (inGrace) {
    tone = "attention";
    Icon = AlertTriangle;
    message = (
      <>
        <strong className="font-bold">Your latest payment didn't go through.</strong>
        <span className="hidden text-[var(--color-muted)] sm:inline"> We'll retry automatically.</span>
      </>
    );
    action = "Review payment";
  } else if (isTrial) {
    tone = "trial";
    Icon = CalendarClock;
    message = (
      <>
        <strong className="font-bold">Free trial: {days} left.</strong>
        <span className="hidden text-[var(--color-muted)] sm:inline">
          {endLabel
            ? ` Ends ${endLabel}. No card needed until you pick a plan.`
            : " No card needed until you pick a plan."}
        </span>
      </>
    );
    action = "Choose a plan";
  } else {
    tone = "attention";
    Icon = CalendarClock;
    message = (
      <>
        <strong className="font-bold">
          Your {planDisplayName(subscription?.plan_interval).toLowerCase()} plan ends in {days}.
        </strong>
        <span className="hidden text-[var(--color-muted)] sm:inline"> Renew to keep access.</span>
      </>
    );
    action = "Renew";
  }

  const palette = TONE[tone];

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-b px-4 py-2 text-[12.5px] text-[var(--color-ink)] sm:px-8",
        palette.strip,
      )}
    >
      <Icon size={14} strokeWidth={2.25} className={cn("shrink-0", palette.icon)} />

      <p className="min-w-0 flex-1 truncate">{message}</p>

      <Link
        to={SUBSCRIPTION_PATH}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--color-ink-solid)] px-2.5 py-1 text-[12px] font-bold text-[var(--color-ink-solid-text)] transition-colors hover:bg-[var(--color-ink-solid-hover)]"
      >
        {action}
        <ArrowRight size={12} strokeWidth={2.75} />
      </Link>
    </div>
  );
}
