import { Link } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";
import { useSubscription } from "../../state/subscriptionContext";

export function TrialBanner() {
  const { isTrial, daysRemaining } = useSubscription();

  if (!isTrial) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[12.5px] font-medium text-amber-900 dark:text-amber-200 sm:px-8">
      <div className="flex items-center gap-2 truncate">
        <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="truncate">
          <strong className="font-semibold">7-Day Free Trial:</strong>{" "}
          {daysRemaining === 0
            ? "Trial ends today."
            : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining.`}{" "}
          No card required, zero auto-charge.
        </span>
      </div>
      <Link
        to="/settings/subscription"
        className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--color-teal)] hover:underline shrink-0"
      >
        Choose a Plan <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
