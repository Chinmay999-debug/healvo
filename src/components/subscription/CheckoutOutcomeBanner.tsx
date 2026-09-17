import { AlertTriangle, CheckCircle2, Clock, X, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useSubscription } from "../../state/subscriptionContext";
import { formatAccessDate } from "../../services/subscription";
import type { CheckoutOutcome } from "../../state/useSubscriptionCheckout";

const TONES: Record<CheckoutOutcome["kind"], { wrap: string; icon: LucideIcon }> = {
  success: {
    wrap: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
    icon: CheckCircle2,
  },
  autorenew_on: {
    wrap: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
    icon: CheckCircle2,
  },
  autorenew_off: {
    wrap: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
    icon: CheckCircle2,
  },
  pending: {
    wrap: "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]",
    icon: Clock,
  },
  error: {
    wrap: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
    icon: AlertTriangle,
  },
};

export function CheckoutOutcomeBanner({
  outcome,
  onDismiss,
}: {
  outcome: CheckoutOutcome | null;
  onDismiss: () => void;
}) {
  const { endsAt } = useSubscription();
  if (!outcome) return null;

  let message: string;
  if (outcome.kind === "success") {
    // Prefer the end date the server returned for this payment; it already
    // includes any time stacked on by an early renewal.
    const until = outcome.accessEndsAt ?? endsAt;
    message = until
      ? `Payment received. Your plan is active until ${formatAccessDate(until)}.`
      : "Payment received. Your plan is active.";
  } else if (outcome.kind === "autorenew_on") {
    message = outcome.firstChargeAt
      ? `Automatic renewal is on. Your first payment of ₹499 is on ${formatAccessDate(outcome.firstChargeAt)}.`
      : "Automatic renewal is on.";
  } else if (outcome.kind === "autorenew_off") {
    const until = outcome.accessUntil ?? endsAt;
    message = until
      ? `Automatic renewal is off. You'll keep access until ${formatAccessDate(until)}.`
      : "Automatic renewal is off.";
  } else if (outcome.kind === "pending") {
    message = `We've received your payment and are confirming it. This usually takes a minute or two, so please don't pay again. Payment ID: ${outcome.paymentId}.`;
  } else {
    message = outcome.message;
  }

  const tone = TONES[outcome.kind];
  const Icon = tone.icon;

  return (
    <div
      role={outcome.kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3.5 text-[13px] font-semibold",
        tone.wrap,
      )}
    >
      <Icon size={16} strokeWidth={2.25} className="mt-px shrink-0" />
      <p className="min-w-0 flex-1 leading-relaxed break-words">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 cursor-pointer opacity-60 transition-opacity hover:opacity-100"
      >
        <X size={15} />
      </button>
    </div>
  );
}
