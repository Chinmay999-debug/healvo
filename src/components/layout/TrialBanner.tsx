import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSubscription } from "../../state/subscriptionContext";
import { planDisplayName } from "../../services/subscription";

const SUBSCRIPTION_PATH = "/settings/subscription";

/**
 * Slim app-wide notice for the moments that need action: a failed automatic
 * payment still inside its grace period, an active free trial, and a plan that
 * will not renew by itself within 7 days of ending.
 */
export function TrialBanner() {
  const { isTrial, isActive, inGrace, autoRenew, daysRemaining, activePlan } = useSubscription();
  const { pathname } = useLocation();

  if (pathname === SUBSCRIPTION_PATH) return null;

  const endingSoon = isActive && !autoRenew && daysRemaining <= 7;
  if (!inGrace && !isTrial && !endingSoon) return null;

  const days = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  let message: ReactNode;
  let action: string;

  if (inGrace) {
    message = (
      <>
        <strong className="font-semibold">Your latest payment didn't go through.</strong>
        <span className="hidden text-[var(--color-muted)] sm:inline"> We'll retry automatically.</span>
      </>
    );
    action = "Review payment";
  } else if (isTrial) {
    message = (
      <>
        <strong className="font-semibold">Free trial: {days} left.</strong>
        <span className="hidden text-[var(--color-muted)] sm:inline"> No card needed until you pick a plan.</span>
      </>
    );
    action = "Choose a plan";
  } else {
    message = (
      <>
        <strong className="font-semibold">
          Your {planDisplayName(activePlan?.interval).toLowerCase()} plan ends in {days}.
        </strong>
        <span className="hidden text-[var(--color-muted)] sm:inline"> Renew to keep access.</span>
      </>
    );
    action = "Renew";
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-amber-bg)] px-4 py-2 text-[12.5px] text-[var(--color-ink)] sm:px-8">
      <span className="min-w-0 truncate">{message}</span>
      <Link
        to={SUBSCRIPTION_PATH}
        className="shrink-0 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
      >
        {action}
      </Link>
    </div>
  );
}
