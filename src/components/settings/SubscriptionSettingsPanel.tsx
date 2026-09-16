import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge, type BadgeTone } from "../ui/Badge";
import { MONTHLY_PLAN_CODE, PlanPicker } from "../subscription/PlanPicker";
import { CheckoutOutcomeBanner } from "../subscription/CheckoutOutcomeBanner";
import { useAuth } from "../../state/authContext";
import { useSubscription } from "../../state/subscriptionContext";
import { useSubscriptionCheckout } from "../../state/useSubscriptionCheckout";
import { cn } from "../../lib/utils";
import {
  formatAccessDate,
  formatPriceINR,
  getAccessProgress,
  getAccessWindow,
  getClinicPlatformInvoices,
  planDisplayName,
} from "../../services/subscription";
import { paymentMethodName } from "../../services/platformBilling";
import type { PlatformInvoice, PlatformInvoiceStatus } from "../../types/subscription";

const INVOICE_TONES: Record<PlatformInvoiceStatus, BadgeTone> = {
  paid: "mint",
  open: "amber",
  draft: "slate",
  void: "slate",
  uncollectible: "slate",
};

const BAR_FILL: Record<"trial" | "active" | "ending" | "expired", string> = {
  trial: "bg-[var(--color-blue-text)]",
  active: "bg-[var(--color-mint-text)]",
  ending: "bg-[var(--color-amber-text)]",
  expired: "bg-[var(--color-muted-soft)]",
};

function AccessProgress({
  startsAt,
  endsAt,
  percent,
  fill,
  startLabel,
  endLabel,
}: {
  startsAt: Date;
  endsAt: Date;
  percent: number;
  fill: string;
  startLabel: string;
  endLabel: string;
}) {
  // Years only when the window crosses one (e.g. a 14-month annual plan).
  const withYear = startsAt.getFullYear() !== endsAt.getFullYear();

  return (
    <div className="mt-4">
      <div
        role="progressbar"
        aria-label="Time used in this period"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="h-2 overflow-hidden rounded-full bg-[var(--color-slate-bg)]"
      >
        {/* A small minimum keeps a just-started period from reading as an empty track. */}
        <div className={cn("h-full min-w-2 rounded-full", fill)} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[12px]">
        <div>
          <div className="text-[var(--color-muted)]">{startLabel}</div>
          <div className="font-semibold whitespace-nowrap text-[var(--color-ink)]">
            {formatAccessDate(startsAt, withYear)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[var(--color-muted)]">{endLabel}</div>
          <div className="font-semibold whitespace-nowrap text-[var(--color-ink)]">
            {formatAccessDate(endsAt, withYear)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionSettingsPanel() {
  const { activeClinic } = useAuth();
  const {
    subscription,
    billing,
    isTrial,
    isActive,
    hasAccess,
    inGrace,
    daysRemaining,
    endsAt,
    refreshSubscription,
  } = useSubscription();
  const checkout = useSubscriptionCheckout();
  const clinicId = activeClinic?.id;

  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!clinicId) return;
    try {
      setInvoices(await getClinicPlatformInvoices(clinicId));
      setInvoicesError(false);
    } catch {
      setInvoicesError(true);
    } finally {
      setInvoicesLoading(false);
    }
  }, [clinicId]);

  // Always re-read server state when the page opens: a webhook may have
  // changed the subscription since the app last fetched it.
  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (checkout.outcome?.kind === "success") void loadInvoices();
  }, [checkout.outcome, loadInvoices]);

  const recurringMonthly = billing?.recurring_monthly_available ?? false;
  const gatewayStatus = billing?.gateway_status ?? null;
  const autoRenewOn = billing?.auto_renew ?? false;
  const paymentDue = inGrace || (autoRenewOn && gatewayStatus === "pending");
  const halted = billing?.needs_reauthorization === true && gatewayStatus === "halted";
  const renewalCompleted = billing?.needs_reauthorization === true && gatewayStatus === "completed";
  const hasPaidAccess = hasAccess && !isTrial;
  const autoRenewOff = recurringMonthly && hasPaidAccess && !autoRenewOn && subscription?.plan_code === MONTHLY_PLAN_CODE;
  const endingSoon = hasPaidAccess && daysRemaining <= 7 && !autoRenewOn;
  const expired = !hasAccess;
  const hasPaidBefore = invoices.some((invoice) => invoice.status === "paid");
  const mode = isActive || hasPaidBefore ? "renew" : "choose";
  const accessWindow = getAccessWindow(subscription);
  const endDate = endsAt ? formatAccessDate(endsAt) : "";
  const nextPaymentDate = formatAccessDate(billing?.next_charge_at ?? billing?.gateway_start_at ?? endsAt ?? new Date());
  const planName = planDisplayName(subscription?.plan_interval);
  const methodName = paymentMethodName(billing?.payment_method ?? null);
  const monthlyLocked =
    recurringMonthly && hasPaidAccess && subscription?.plan_interval === "year" && !billing?.annual_to_monthly_eligible && !autoRenewOn;

  const status = isTrial
    ? {
        badge: { tone: "blue" as BadgeTone, label: "Free trial" },
        title: `${subscription?.trial_days ?? 7}-day free trial`,
        endLine: <>Trial ends on <strong className="font-semibold text-[var(--color-ink)]">{endDate}</strong></>,
        barStart: "Trial started",
        barEnd: "Trial ends",
        fill: BAR_FILL.trial,
      }
    : paymentDue || halted
      ? {
          badge: { tone: "amber" as BadgeTone, label: halted ? "Action needed" : "Payment due" },
          title: `${planName} plan`,
          endLine: <>Paid through <strong className="font-semibold text-[var(--color-ink)]">{endDate}</strong></>,
          barStart: "Started",
          barEnd: "Paid through",
          fill: BAR_FILL.ending,
        }
      : hasPaidAccess && autoRenewOn
        ? {
            badge: { tone: "mint" as BadgeTone, label: "Auto-renews" },
            title: `${planName} plan`,
            endLine: (
              <>
                Next payment {formatPriceINR(49900)} on{" "}
                <strong className="font-semibold text-[var(--color-ink)]">{nextPaymentDate}</strong>
              </>
            ),
            barStart: "Started",
            barEnd: "Next payment",
            fill: BAR_FILL.active,
          }
        : hasPaidAccess
          ? {
              badge: autoRenewOff
                ? { tone: "slate" as BadgeTone, label: "Auto-renewal off" }
                : endingSoon
                  ? { tone: "amber" as BadgeTone, label: "Ending soon" }
                  : { tone: "mint" as BadgeTone, label: "Active" },
              title: `${planName} plan`,
              // One-time plans never renew by themselves, so the date is phrased as a deadline.
              endLine: <>Renew by <strong className="font-semibold text-[var(--color-ink)]">{endDate}</strong></>,
              barStart: "Started",
              barEnd: "Renew by",
              fill: endingSoon ? BAR_FILL.ending : BAR_FILL.active,
            }
          : {
              badge: { tone: "slate" as BadgeTone, label: "Expired" },
              title: "Plan expired",
              endLine: null,
              barStart: "Started",
              barEnd: "Ended",
              fill: BAR_FILL.expired,
            };

  const plansHeading = autoRenewOn ? "Change plan" : mode === "renew" ? "Renew your plan" : "Choose a plan";
  const plansSubtitle = autoRenewOn
    ? "Switching to annual turns off monthly auto-renewal at the end of your current month."
    : isTrial
      ? "Your paid plan starts as soon as payment goes through."
      : hasPaidAccess
        ? `Anything you add starts after ${endDate}, so you don't lose any days.`
        : "Choose a plan to restore your clinic's access.";

  const busy = checkout.phase !== "idle";

  async function handleConfirmCancel() {
    const cancelled = await checkout.cancelAutoRenew();
    if (cancelled) setConfirmingCancel(false);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[var(--color-muted)]">Your Healvo plan</p>
            <h2 className="mt-0.5 truncate text-[16px] font-bold text-[var(--color-ink)]">
              {activeClinic?.name}
            </h2>
          </div>
          <Badge tone={status.badge.tone} className="shrink-0">
            {status.badge.label}
          </Badge>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--color-border)] p-4">
          <div className="text-[13.5px] font-bold text-[var(--color-ink)]">{status.title}</div>

          {expired ? (
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              {halted ? "Automatic payments stopped." : "Your clinic access is paused."}
              <br />
              {halted ? "Update your payment method to continue." : "Choose a plan to continue."}
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[32px] leading-none font-bold text-[var(--color-ink)] tabular-nums">
                  {daysRemaining}
                </span>
                <span className="text-[13px] text-[var(--color-muted)]">
                  {daysRemaining === 1 ? "day" : "days"} remaining
                </span>
              </div>
              {status.endLine && <p className="text-[13px] text-[var(--color-muted)]">{status.endLine}</p>}
            </div>
          )}

          {accessWindow && (
            <AccessProgress
              startsAt={accessWindow.startsAt}
              endsAt={accessWindow.endsAt}
              percent={expired ? 100 : getAccessProgress(accessWindow)}
              fill={status.fill}
              startLabel={status.barStart}
              endLabel={status.barEnd}
            />
          )}

          {(paymentDue || halted || renewalCompleted) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--color-amber-bg)] px-3.5 py-3">
              <p className="text-[13px] font-semibold text-[var(--color-amber-text)]">
                {halted
                  ? "Automatic payments stopped. Update your payment method."
                  : renewalCompleted
                    ? "Your automatic renewal has ended. Turn it back on to keep your plan."
                    : `Your ${endDate} payment didn't go through. We'll retry automatically.`}
              </p>
              {(halted || renewalCompleted) && recurringMonthly && (
                <Button variant="outline" disabled={busy} onClick={() => void checkout.startCheckout(MONTHLY_PLAN_CODE)}>
                  {halted ? "Update payment method" : "Turn on auto-renewal"}
                </Button>
              )}
            </div>
          )}

          {autoRenewOff && !renewalCompleted && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-[var(--color-muted)]">Auto-renewal off</p>
              <Button variant="outline" disabled={busy} onClick={() => void checkout.startCheckout(MONTHLY_PLAN_CODE)}>
                Turn auto-renewal back on
              </Button>
            </div>
          )}
        </div>

        {checkout.outcome && (
          <div className="mt-4">
            <CheckoutOutcomeBanner outcome={checkout.outcome} onDismiss={checkout.dismissOutcome} />
          </div>
        )}
      </Card>

      {autoRenewOn && (
        <Card className="p-5">
          <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Manage subscription</h2>
          <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
            {formatPriceINR(49900)} / month, charged automatically.
          </p>

          <dl className="mt-4 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] text-[13px]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-[var(--color-muted)]">Automatic renewal</dt>
              <dd className="font-semibold text-[var(--color-ink)]">On</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-[var(--color-muted)]">Next payment</dt>
              <dd className="font-semibold text-[var(--color-ink)]">{nextPaymentDate}</dd>
            </div>
            {methodName && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-[var(--color-muted)]">Payment method</dt>
                <dd className="font-semibold text-[var(--color-ink)]">{methodName}</dd>
              </div>
            )}
          </dl>

          {confirmingCancel ? (
            <div className="mt-4 rounded-lg border border-[var(--color-border)] p-4">
              <p className="text-[13px] text-[var(--color-ink)]">
                You'll keep access until <strong className="font-semibold">{endDate}</strong> and won't be charged again.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setConfirmingCancel(false)}>
                  Keep auto-renewal
                </Button>
                <Button
                  variant="ghost"
                  className="text-[var(--color-danger-text)]"
                  disabled={busy}
                  onClick={() => void handleConfirmCancel()}
                >
                  {checkout.phase === "cancelling" && <LoaderCircle size={14} className="animate-spin" />}
                  Cancel automatic renewal
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="mt-4" disabled={busy} onClick={() => setConfirmingCancel(true)}>
              Cancel automatic renewal
            </Button>
          )}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-[16px] font-bold text-[var(--color-ink)]">{plansHeading}</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{plansSubtitle}</p>

        <div className="mt-5">
          <PlanPicker
            mode={mode}
            currentPlanCode={isActive ? subscription?.plan_code ?? null : null}
            phase={checkout.phase}
            pendingPlanCode={checkout.pendingPlanCode}
            onSelect={checkout.startCheckout}
            recurringMonthly={recurringMonthly}
            hasPaidTime={hasPaidAccess}
            autoRenewOn={autoRenewOn}
            monthlyLocked={monthlyLocked}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Billing history</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
          Invoices for your Healvo plan. Patient bills are in Billing.
        </p>

        {invoicesLoading ? (
          <p className="mt-5 text-[13px] text-[var(--color-muted)]">Loading invoices…</p>
        ) : invoicesError ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-4">
            <p className="text-[13px] text-[var(--color-muted)]">Couldn't load your invoices.</p>
            <Button variant="outline" onClick={() => void loadInvoices()}>
              Try again
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-[13px] text-[var(--color-muted)]">
            No payments yet. Invoices will show up here after your first payment.
          </p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-[var(--color-border)] sm:hidden">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                      {invoice.invoice_number}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                      {formatAccessDate(invoice.issued_at)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[13px] font-bold text-[var(--color-ink)] tabular-nums">
                      {formatPriceINR(invoice.total_amount_paise)}
                    </span>
                    <Badge tone={INVOICE_TONES[invoice.status]} className="capitalize">
                      {invoice.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-[var(--color-border)] text-[12px] text-[var(--color-muted)]">
                  <tr>
                    <th className="pb-2.5 font-semibold">Invoice</th>
                    <th className="pb-2.5 font-semibold">Date</th>
                    <th className="pb-2.5 text-right font-semibold">Amount</th>
                    <th className="pb-2.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="py-3 font-semibold text-[var(--color-ink)]">{invoice.invoice_number}</td>
                      <td className="py-3 text-[var(--color-muted)]">{formatAccessDate(invoice.issued_at)}</td>
                      <td className="py-3 text-right font-semibold text-[var(--color-ink)] tabular-nums">
                        {formatPriceINR(invoice.total_amount_paise)}
                      </td>
                      <td className="py-3 text-right">
                        <Badge tone={INVOICE_TONES[invoice.status]} className="capitalize">
                          {invoice.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
