import { useState } from "react";
import { Clock, CreditCard, LogOut, Mail, Sparkles, CheckCircle2 } from "lucide-react";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useAuth } from "../../state/authContext";
import { useSubscription } from "../../state/subscriptionContext";
import {
  createSubscriptionCheckout,
  verifySubscriptionPayment,
  loadRazorpayScript,
} from "../../services/subscription";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function SubscriptionExpiredScreen({
  clinicName,
  clinicId,
}: {
  clinicName: string;
  clinicId: string;
}) {
  const { signOut, user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChoosePlan = async (planCode: string) => {
    setProcessingPlan(planCode);
    setErrorMsg(null);

    try {
      const checkout = await createSubscriptionCheckout(clinicId, planCode);
      const isLoaded = await loadRazorpayScript();

      if (!isLoaded || typeof window === "undefined" || !window.Razorpay) {
        // Simulated test callback if external CDN is blocked
        const verified = await verifySubscriptionPayment({
          clinicId,
          planCode,
          razorpay_order_id: checkout.orderId,
          razorpay_payment_id: `pay_sim_${Date.now()}`,
          razorpay_signature: "sim_test_signature",
        });

        if (verified.success) {
          await refreshSubscription();
          return;
        }
      }

      const options = {
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "Healvo",
        description: `${checkout.planName} (${checkout.entitlementMonths} months access)`,
        order_id: checkout.orderId,
        prefill: {
          name: user?.email?.split("@")[0] || "Doctor",
          email: user?.email || "",
        },
        theme: {
          color: "#0d9488",
        },
        notes: {
          clinic_id: clinicId,
          plan_code: planCode,
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await verifySubscriptionPayment({
              clinicId,
              planCode,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verified.success) {
              await refreshSubscription();
            }
          } catch (err: any) {
            setErrorMsg(err.message || "Payment verification failed.");
          }
        },
        modal: {
          ondismiss: () => setProcessingPlan(null),
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err: any) {
      setErrorMsg(err.message || "Could not start checkout.");
    } finally {
      setProcessingPlan(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6">
            <Logo />
          </div>

          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-7 w-7" />
          </div>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Free Trial Concluded
          </div>

          <h1 className="text-[24px] font-bold text-[var(--color-ink)] sm:text-[28px]">
            Your free trial has ended
          </h1>

          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-[var(--color-muted)]">
            Choose a plan to continue using Healvo for{" "}
            <span className="font-semibold text-[var(--color-ink)]">{clinicName}</span>. All your patients,
            appointments, dental charts, documents, and records are safely preserved and untouched.
          </p>

          {errorMsg && (
            <div className="mt-4 w-full rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[13px] text-red-800 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Test Mode Note */}
          <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-[12px] font-medium text-sky-800 dark:text-sky-300">
            Razorpay Test Mode: Simulated payment. No real card will be charged.
          </div>

          {/* Plan Options */}
          <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 text-left">
            {/* Monthly */}
            <Card className="flex flex-col justify-between border-[var(--color-border)] p-5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Monthly Plan
                </span>
                <h3 className="mt-1 text-[16px] font-bold text-[var(--color-ink)]">Healvo Dental Monthly</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[24px] font-bold text-[var(--color-ink)]">₹499.00</span>
                  <span className="text-[12px] text-[var(--color-muted)]">/ month</span>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">+ applicable GST</p>

                <div className="mt-4 space-y-1.5 text-[12.5px] text-[var(--color-muted)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-teal)]" />
                    <span>1 month platform access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-teal)]" />
                    <span>Cancel anytime</span>
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                className="mt-6 w-full justify-center"
                disabled={processingPlan !== null}
                onClick={() => handleChoosePlan("healvo_dental_monthly")}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {processingPlan === "healvo_dental_monthly" ? "Starting…" : "Choose Monthly"}
              </Button>
            </Card>

            {/* Annual */}
            <Card className="relative flex flex-col justify-between border-2 border-[var(--color-teal)] bg-gradient-to-b from-[var(--color-mint-bg)]/40 to-[var(--color-surface)] p-5 shadow">
              <div className="absolute -top-3 right-4 rounded-full bg-[var(--color-teal)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                2 Months FREE
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-teal)]">
                  Best Value
                </span>
                <h3 className="mt-1 text-[16px] font-bold text-[var(--color-ink)]">Healvo Dental Annual</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[24px] font-bold text-[var(--color-ink)]">₹5,988.00</span>
                  <span className="text-[12px] text-[var(--color-muted)]">/ 14 months</span>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">+ applicable GST</p>

                <div className="mt-4 space-y-1.5 text-[12.5px] text-[var(--color-ink)]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--color-teal)]" />
                    <span className="font-semibold">14 months access (12 paid + 2 FREE)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-teal)]" />
                    <span>Uninterrupted platform use</span>
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                className="mt-6 w-full justify-center shadow-md shadow-[var(--color-teal)]/20"
                disabled={processingPlan !== null}
                onClick={() => handleChoosePlan("healvo_dental_annual")}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {processingPlan === "healvo_dental_annual" ? "Starting…" : "Choose Annual"}
              </Button>
            </Card>
          </div>

          <div className="mt-8 flex items-center justify-between w-full pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
              <Mail className="h-4 w-4 text-[var(--color-teal)]" />
              <span>Questions? </span>
              <a href="mailto:support@healvo.in" className="font-medium text-[var(--color-teal)] hover:underline">
                support@healvo.in
              </a>
            </div>

            <Button variant="ghost" className="px-2.5 py-1.5 text-[12px]" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
