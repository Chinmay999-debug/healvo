import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useSubscription } from "../../state/subscriptionContext";
import { formatAccessDate } from "../../services/subscription";
import type { CheckoutOutcome } from "../../state/useSubscriptionCheckout";

const TONES: Record<CheckoutOutcome["kind"], string> = {
  success: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  autorenew_on: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  autorenew_off: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  pending: "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]",
  error: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
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

  return (
    <div
      role={outcome.kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg px-3.5 py-3 text-[13px] font-semibold",
        TONES[outcome.kind],
      )}
    >
      <p className="min-w-0 break-words">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
