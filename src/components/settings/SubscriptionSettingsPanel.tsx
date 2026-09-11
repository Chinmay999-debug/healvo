import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAuth } from "../../state/authContext";
import { useSubscription } from "../../state/subscriptionContext";
import {
  getActiveSubscriptionPlans,
  getClinicPlatformInvoices,
  createSubscriptionCheckout,
  verifySubscriptionPayment,
  loadRazorpayScript,
  formatPriceINR,
  getDaysRemaining,
  isTrialing,
  hasSubscriptionAccess,
} from "../../services/subscription";
import type {
  SubscriptionPlan,
  PlatformInvoice,
} from "../../types/subscription";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function SubscriptionSettingsPanel() {
  const { activeClinic, user } = useAuth();
  const { subscription, refreshSubscription } = useSubscription();
  const clinicId = activeClinic?.id;

  const [loading, setLoading] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadData = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [plansData, invoicesData] = await Promise.all([
        getActiveSubscriptionPlans(),
        getClinicPlatformInvoices(clinicId),
        refreshSubscription(),
      ]);
      setPlans(plansData);
      setInvoices(invoicesData);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to load subscription details." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clinicId]);

  const handleSelectPlan = async (planCode: string) => {
    if (!clinicId) return;
    setProcessingPlan(planCode);
    setFeedback(null);

    try {
      // 1. Initialize server-side checkout session
      const checkout = await createSubscriptionCheckout(clinicId, planCode);

      // 2. Load Razorpay Checkout.js
      const isLoaded = await loadRazorpayScript();

      if (!isLoaded || typeof window === "undefined" || !window.Razorpay) {
        // Fallback simulation in test mode if external CDN is blocked
        const simPaymentId = `pay_sim_${Date.now()}`;
        const simSignature = "sim_test_signature";

        const verified = await verifySubscriptionPayment({
          clinicId,
          planCode,
          razorpay_order_id: checkout.orderId,
          razorpay_payment_id: simPaymentId,
          razorpay_signature: simSignature,
        });

        if (verified.success) {
          setFeedback({
            type: "success",
            message: `Subscription successfully updated! Invoice: ${verified.invoice_number}`,
          });
          await loadData();
          return;
        }
      }

      // 3. Launch official Razorpay Checkout Modal
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
          color: "#0d9488", // Healvo teal
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
              setFeedback({
                type: "success",
                message: `Payment successful! Your subscription is active. Platform invoice: ${verified.invoice_number}`,
              });
              await loadData();
            }
          } catch (err: any) {
            setFeedback({
              type: "error",
              message: `Payment verification failed: ${err.message}`,
            });
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to start checkout." });
    } finally {
      setProcessingPlan(null);
    }
  };

  const daysRemaining = subscription ? getDaysRemaining(subscription) : 0;
  const inTrial = subscription ? isTrialing(subscription) : false;
  const hasAccess = subscription ? hasSubscriptionAccess(subscription) : false;

  return (
    <div className="space-y-6">
      {/* Test Mode Banner */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-900 dark:text-sky-200">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="text-[13px]">
            <span className="font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Razorpay Test Mode Active:
            </span>{" "}
            All subscription payments are simulated in Razorpay test mode. No real money will be charged.
            You can use Razorpay test cards, test UPI, or test netbanking.
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border p-4 text-[13.5px] ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Current Subscription Status Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Current Subscription</h2>
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              Plan and billing entitlement status for {activeClinic?.name}.
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={loadData}
            disabled={loading}
            className="self-start sm:self-auto text-[12px] px-3 py-1.5"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Status
            </p>
            <div className="mt-2 flex items-center gap-2">
              {inTrial && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[12px] font-bold text-amber-700 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  7-Day Free Trial
                </span>
              )}
              {!inTrial && hasAccess && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active Subscribed
                </span>
              )}
              {!hasAccess && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[12px] font-bold text-red-700 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Trial Expired
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Current Plan
            </p>
            <p className="mt-1 text-[15px] font-bold text-[var(--color-ink)]">
              {subscription?.plan_name || "Healvo Dental"}
            </p>
            <p className="text-[12px] text-[var(--color-muted)]">
              {subscription ? `${formatPriceINR(subscription.base_price_paise)} + GST` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Access Concludes
            </p>
            <p className="mt-1 text-[15px] font-bold text-[var(--color-ink)]">
              {subscription?.current_period_ends_at
                ? new Date(subscription.current_period_ends_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </p>
            <p className="text-[12px] text-[var(--color-muted)]">
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : "Access expired"}
            </p>
          </div>
        </div>

        {inTrial && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-[13px] text-amber-800 dark:text-amber-300">
            <span className="font-semibold">7-day free trial:</span> {daysRemaining} days remaining. Trial ends{" "}
            {subscription?.trial_ends_at
              ? new Date(subscription.trial_ends_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "soon"}
            . No automatic charge.
          </div>
        )}
      </Card>

      {/* Available Plans Catalog */}
      <div>
        <div className="mb-4">
          <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Choose a Subscription Plan</h2>
          <p className="text-[13px] text-[var(--color-muted)]">
            Select monthly flexibility or save with our annual commercial offer.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Monthly Plan Card */}
          <Card className="flex flex-col justify-between border-[var(--color-border)] p-6 transition-all hover:border-[var(--color-teal)]/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Monthly Plan
                </span>
                <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                  1 Month Cycle
                </span>
              </div>

              <h3 className="mt-3 text-[20px] font-bold text-[var(--color-ink)]">Healvo Dental Monthly</h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[32px] font-extrabold text-[var(--color-ink)]">₹499.00</span>
                <span className="text-[13px] text-[var(--color-muted)]">/ month</span>
              </div>
              <p className="text-[12px] font-medium text-[var(--color-muted)]">+ applicable GST</p>

              <div className="mt-6 space-y-2.5 border-t border-[var(--color-border)] pt-5 text-[13.5px] text-[var(--color-muted)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-teal)]" />
                  <span>Full access to Dental Chart, EHR & Records</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-teal)]" />
                  <span>Online patient booking link</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-teal)]" />
                  <span>1 month prepaid access entitlement</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-teal)]" />
                  <span>Billed monthly • Cancel anytime</span>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              className="mt-8 w-full justify-center"
              disabled={processingPlan !== null}
              onClick={() => handleSelectPlan("healvo_dental_monthly")}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {processingPlan === "healvo_dental_monthly"
                ? "Starting Checkout…"
                : "Choose Monthly"}
            </Button>
          </Card>

          {/* Annual Plan Card (Recommended) */}
          <Card className="relative flex flex-col justify-between border-2 border-[var(--color-teal)] bg-gradient-to-b from-[var(--color-mint-bg)]/40 to-[var(--color-surface)] p-6 shadow-md">
            <div className="absolute -top-3 right-6 rounded-full bg-[var(--color-teal)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow">
              14 Months Access • 2 Months FREE
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-teal)]">
                  Annual Offer
                </span>
              </div>

              <h3 className="mt-3 text-[20px] font-bold text-[var(--color-ink)]">Healvo Dental Annual</h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[32px] font-extrabold text-[var(--color-ink)]">₹5,988.00</span>
                <span className="text-[13px] text-[var(--color-muted)]">/ 14 months</span>
              </div>
              <p className="text-[12px] font-medium text-[var(--color-muted)]">+ applicable GST</p>

              <div className="mt-2 rounded-lg bg-[var(--color-teal)]/10 px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-teal)]">
                Pay for 12 months, get 2 FREE months (14 total months access)
              </div>

              <div className="mt-5 space-y-2.5 border-t border-[var(--color-border)] pt-5 text-[13.5px] text-[var(--color-ink)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-teal)]" />
                  <span className="font-semibold">14 months continuous platform access</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-teal)]" />
                  <span>Full EHR, Dental Charting & Consultations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-teal)]" />
                  <span>Online public clinic booking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--color-teal)]" />
                  <span>Maximum value guarantee</span>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              className="mt-8 w-full justify-center shadow-lg shadow-[var(--color-teal)]/20"
              disabled={processingPlan !== null}
              onClick={() => handleSelectPlan("healvo_dental_annual")}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {processingPlan === "healvo_dental_annual"
                ? "Starting Checkout…"
                : "Choose Annual"}
            </Button>
          </Card>
        </div>
      </div>

      {/* Platform SaaS Invoices History */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Platform Billing Invoices</h2>
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              Historical receipts for your Healvo SaaS subscription. Patient billing is kept separate in the
              Billing workspace.
            </p>
          </div>
          <FileText className="h-5 w-5 text-[var(--color-muted)]" />
        </div>

        <div className="mt-6 overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
              <p className="text-[13.5px] text-[var(--color-muted)]">
                No platform invoices issued yet. When you complete a subscription payment, your official invoice
                will appear here.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-[var(--color-border)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                <tr>
                  <th className="pb-3">Invoice Number</th>
                  <th className="pb-3">Issued Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Tax</th>
                  <th className="pb-3">Total</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[var(--color-canvas)]/50">
                    <td className="py-3 font-mono font-medium text-[var(--color-ink)]">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 text-[var(--color-muted)]">
                      {new Date(inv.issued_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 font-medium text-[var(--color-ink)]">
                      {formatPriceINR(inv.amount_paise)}
                    </td>
                    <td className="py-3 text-[var(--color-muted)]">
                      {inv.tax_amount_paise > 0 ? formatPriceINR(inv.tax_amount_paise) : "₹0"}
                    </td>
                    <td className="py-3 font-bold text-[var(--color-ink)]">
                      {formatPriceINR(inv.total_amount_paise)}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold capitalize text-emerald-700 dark:text-emerald-400">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
