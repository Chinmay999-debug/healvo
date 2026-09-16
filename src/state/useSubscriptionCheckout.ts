import { useCallback, useRef, useState } from "react";
import { useAuth } from "./authContext";
import { useSubscription } from "./subscriptionContext";
import {
  createSubscriptionCheckout,
  getClinicSubscription,
  getSubscriptionPaymentStatus,
  hasSubscriptionAccess,
  loadRazorpayScript,
  planDisplayName,
  verifySubscriptionPayment,
  type RazorpayCheckoutResponse,
} from "../services/subscription";
import {
  RECURRING_PLAN_CODE,
  cancelAutoRenewal,
  createRecurringSubscription,
  getClinicBillingState,
  verifyRecurringSubscription,
} from "../services/platformBilling";
import { confirmRecurringCheckout } from "./recurringConfirmation";
import { getErrorMessage } from "../lib/utils";

export type CheckoutPhase = "idle" | "starting" | "paying" | "confirming" | "cancelling";

export type CheckoutOutcome =
  | { kind: "success"; invoiceNumber: string | null; accessEndsAt: string | null }
  | { kind: "autorenew_on"; firstChargeAt: string | null }
  | { kind: "autorenew_off"; accessUntil: string | null }
  | { kind: "pending"; paymentId: string }
  | { kind: "error"; message: string };

const BRAND_COLOR = "#0ea5b7";
const CONFIRMATION_POLL_ATTEMPTS = 10;
const CONFIRMATION_POLL_INTERVAL_MS = 3000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Drives plan purchases end to end and keeps the UI on server truth:
 * - Annual (and Monthly while recurring is unavailable): server-created
 *   Razorpay Order → Checkout → server verification.
 * - Monthly with recurring available: server-created Razorpay Subscription →
 *   Checkout mandate authorization → server verification; the webhook settles
 *   anything verification cannot yet.
 * Shared by Settings → Subscription and the expired-access screen.
 */
export function useSubscriptionCheckout() {
  const { activeClinic, user } = useAuth();
  const clinicId = activeClinic?.id;
  const userEmail = user?.email;
  const { subscription, billing, refreshSubscription } = useSubscription();
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [pendingPlanCode, setPendingPlanCode] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);
  const busyRef = useRef(false);

  const finish = useCallback(() => {
    busyRef.current = false;
    setPhase("idle");
    setPendingPlanCode(null);
  }, []);

  const confirmOneTimePayment = useCallback(
    async (targetClinicId: string, planCode: string, response: RazorpayCheckoutResponse) => {
      setPhase("confirming");
      try {
        const orderId = response.razorpay_order_id;
        if (orderId) {
          try {
            const result = await verifySubscriptionPayment({
              clinicId: targetClinicId,
              planCode,
              razorpay_order_id: orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await refreshSubscription();
            setOutcome({
              kind: "success",
              invoiceNumber: result.invoice_number ?? null,
              accessEndsAt: result.current_period_ends_at ?? null,
            });
            return;
          } catch {
            // The charge already went through at Razorpay and the webhook confirms
            // it independently — wait for that rather than invite a second payment.
          }

          for (let attempt = 0; attempt < CONFIRMATION_POLL_ATTEMPTS; attempt++) {
            await wait(CONFIRMATION_POLL_INTERVAL_MS);
            const status = await getSubscriptionPaymentStatus(orderId).catch(() => null);
            if (status === "captured") {
              await refreshSubscription();
              setOutcome({ kind: "success", invoiceNumber: null, accessEndsAt: null });
              return;
            }
          }
        }

        setOutcome({ kind: "pending", paymentId: response.razorpay_payment_id });
      } finally {
        finish();
      }
    },
    [refreshSubscription, finish],
  );

  const confirmRecurring = useCallback(
    async (targetClinicId: string, response: RazorpayCheckoutResponse, previousEnd: string | null) => {
      setPhase("confirming");
      try {
        // Retries verify while Razorpay is still authorizing the subscription and
        // watches server state for the webhook grant; never grants anything itself.
        const confirmation = await confirmRecurringCheckout(
          {
            verify: () => verifyRecurringSubscription(targetClinicId, response),
            getSubscription: () => getClinicSubscription(targetClinicId),
            getBillingState: () => getClinicBillingState(targetClinicId),
            hasAccess: hasSubscriptionAccess,
            refresh: refreshSubscription,
            wait,
          },
          previousEnd,
        );

        setOutcome(
          confirmation.kind === "pending"
            ? { kind: "pending", paymentId: response.razorpay_payment_id }
            : confirmation,
        );
      } finally {
        finish();
      }
    },
    [refreshSubscription, finish],
  );

  const startCheckout = useCallback(
    async (planCode: string) => {
      if (!clinicId || busyRef.current) return;

      busyRef.current = true;
      setOutcome(null);
      setPendingPlanCode(planCode);
      setPhase("starting");

      // The server makes the final call; this only picks which checkout to open.
      const recurring = planCode === RECURRING_PLAN_CODE && Boolean(billing?.recurring_monthly_available);
      const previousEnd = subscription?.current_period_ends_at ?? null;

      try {
        const scriptLoad = loadRazorpayScript();
        let paymentSubmitted = false;
        const modal = {
          confirm_close: true,
          ondismiss: () => {
            if (!paymentSubmitted) finish();
          },
        };

        let options: ConstructorParameters<NonNullable<typeof window.Razorpay>>[0];

        if (recurring) {
          const [checkout, scriptLoaded] = await Promise.all([createRecurringSubscription(clinicId, planCode), scriptLoad]);
          if (!scriptLoaded || !window.Razorpay) {
            throw new Error("Couldn't open checkout. Check your internet connection and try again.");
          }
          options = {
            key: checkout.razorpay_key_id,
            subscription_id: checkout.razorpay_subscription_id,
            name: "Healvo",
            description: "Monthly plan · renews automatically",
            prefill: { email: userEmail },
            theme: { color: BRAND_COLOR },
            config: {
              display: {
                hide: [{ method: "emandate" }]
              }
            },
            modal,
            handler: (response) => {
              paymentSubmitted = true;
              void confirmRecurring(clinicId, response, previousEnd);
            },
          };
        } else {
          const [checkout, scriptLoaded] = await Promise.all([createSubscriptionCheckout(clinicId, planCode), scriptLoad]);
          if (!scriptLoaded || !window.Razorpay) {
            throw new Error("Couldn't open checkout. Check your internet connection and try again.");
          }
          const months = checkout.entitlementMonths;
          options = {
            key: checkout.keyId,
            amount: checkout.amount,
            currency: checkout.currency,
            order_id: checkout.orderId,
            name: "Healvo",
            description: `${planDisplayName(checkout.interval)} plan · ${months} month${months === 1 ? "" : "s"} access`,
            prefill: { email: userEmail },
            theme: { color: BRAND_COLOR },
            modal,
            handler: (response) => {
              paymentSubmitted = true;
              void confirmOneTimePayment(clinicId, planCode, response);
            },
          };
        }

        const razorpay = new window.Razorpay!(options);
        razorpay.on("payment.failed", (response) => {
          const reason = response?.error?.description;
          setOutcome({
            kind: "error",
            message: reason ? `Payment didn't go through: ${reason}` : "Payment didn't go through. Please try again.",
          });
        });

        setPhase("paying");
        razorpay.open();
      } catch (err) {
        setOutcome({ kind: "error", message: getErrorMessage(err, "Couldn't start checkout. Please try again.") });
        finish();
      }
    },
    [clinicId, userEmail, billing?.recurring_monthly_available, subscription?.current_period_ends_at, confirmOneTimePayment, confirmRecurring, finish],
  );

  const cancelAutoRenew = useCallback(async (): Promise<boolean> => {
    if (!clinicId || busyRef.current) return false;
    busyRef.current = true;
    setOutcome(null);
    setPhase("cancelling");
    try {
      const result = await cancelAutoRenewal(clinicId);
      await refreshSubscription();
      setOutcome({ kind: "autorenew_off", accessUntil: result.access_until ?? null });
      return true;
    } catch (err) {
      setOutcome({ kind: "error", message: getErrorMessage(err, "Couldn't turn off automatic renewal. Please try again.") });
      return false;
    } finally {
      finish();
    }
  }, [clinicId, refreshSubscription, finish]);

  const dismissOutcome = useCallback(() => setOutcome(null), []);

  return {
    phase,
    pendingPlanCode,
    outcome,
    startCheckout,
    cancelAutoRenew,
    dismissOutcome,
  };
}
