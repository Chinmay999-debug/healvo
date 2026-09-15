import { LogOut } from "lucide-react";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import { PlanPicker } from "../subscription/PlanPicker";
import { CheckoutOutcomeBanner } from "../subscription/CheckoutOutcomeBanner";
import { useAuth } from "../../state/authContext";
import { useSubscription } from "../../state/subscriptionContext";
import { useSubscriptionCheckout } from "../../state/useSubscriptionCheckout";

/**
 * Non-destructive paywall shown by RequireAuthAndClinic when the clinic has no
 * trial, paid access or renewal grace. The user stays signed in and all clinic
 * data is kept; a confirmed payment refreshes subscription state and the gate
 * lifts itself.
 */
export function SubscriptionExpiredScreen({
  clinicName,
}: {
  clinicName: string;
  clinicId: string;
}) {
  const { signOut, user } = useAuth();
  const { subscription, billing } = useSubscription();
  const checkout = useSubscriptionCheckout();

  const trialEnded = !subscription || subscription.status === "trialing";
  const paymentsStopped = billing?.needs_reauthorization === true && billing.gateway_status === "halted";

  const heading = paymentsStopped
    ? "Automatic payments stopped"
    : trialEnded
      ? "Your free trial has ended"
      : "Your plan has expired";

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <Button variant="ghost" onClick={() => void signOut()}>
            <LogOut size={14} />
            Log out
          </Button>
        </div>

        <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
          <h1 className="text-[20px] font-bold text-[var(--color-ink)] sm:text-[22px]">{heading}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">
            {paymentsStopped ? "Update your payment method to keep using Healvo at " : "To keep using Healvo at "}
            <span className="font-semibold text-[var(--color-ink)]">{clinicName}</span>, choose a plan below. Your
            patients, appointments and records are all still saved, and everything will be where you left it.
          </p>

          {checkout.outcome && (
            <div className="mt-4">
              <CheckoutOutcomeBanner outcome={checkout.outcome} onDismiss={checkout.dismissOutcome} />
            </div>
          )}

          <div className="mt-6">
            <PlanPicker
              mode={trialEnded ? "choose" : "renew"}
              phase={checkout.phase}
              pendingPlanCode={checkout.pendingPlanCode}
              onSelect={checkout.startCheckout}
              recurringMonthly={billing?.recurring_monthly_available ?? false}
            />
          </div>
        </div>

        <p className="mt-5 text-center text-[12.5px] text-[var(--color-muted)]">
          Questions about billing? Email{" "}
          <a href="mailto:support@healvo.in" className="font-semibold text-[var(--color-teal)] hover:underline">
            support@healvo.in
          </a>
          {user?.email && <span className="block sm:inline"> · Signed in as {user.email}</span>}
        </p>
      </div>
    </div>
  );
}
