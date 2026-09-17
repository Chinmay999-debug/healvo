import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  FileText,
  ReceiptText,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge, type BadgeTone } from "../ui/Badge";
import { MONTHLY_PLAN_CODE, PlanPicker } from "../subscription/PlanPicker";
import { CheckoutOutcomeBanner } from "../subscription/CheckoutOutcomeBanner";
import { PlanStatusHero, type PlanTone } from "../subscription/PlanStatusHero";
import { useAuth } from "../../state/authContext";
import { useSubscription } from "../../state/subscriptionContext";
import { useSubscriptionCheckout } from "../../state/useSubscriptionCheckout";
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

const MONTHLY_FALLBACK_PAISE = 49900;

/** The one section header used across this page's cards. */
function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15.5px] font-extrabold tracking-tight text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function AttentionCard({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-[var(--color-amber-text)]/25 bg-[var(--color-amber-bg)] px-4 py-3.5"
    >
      <AlertTriangle
        size={16}
        strokeWidth={2.25}
        className="mt-px shrink-0 text-[var(--color-amber-text)]"
      />
      <p className="text-[13px] leading-relaxed font-semibold text-[var(--color-amber-text)]">
        {message}
      </p>
    </div>
  );
}

function ManageRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof RefreshCw;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="flex items-center gap-2.5 text-[13px] text-[var(--color-muted)]">
        <Icon size={15} strokeWidth={2} className="shrink-0 text-[var(--color-muted-soft)]" />
        {label}
      </dt>
      <dd className="text-[13px] font-bold text-[var(--color-ink)] tabular-nums">{value}</dd>
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
  const recurringPrice = formatPriceINR(subscription?.base_price_paise ?? MONTHLY_FALLBACK_PAISE);
  const monthlyLocked =
    recurringMonthly && hasPaidAccess && subscription?.plan_interval === "year" && !billing?.annual_to_monthly_eligible && !autoRenewOn;

  const status: {
    tone: PlanTone;
    label: string;
    title: string;
    caption: ReactNode;
    endLabel: string;
    endValue: string;
  } = isTrial
    ? {
        tone: "trial",
        label: "Free trial",
        title: `${subscription?.trial_days ?? 7}-day free trial`,
        caption: (
          <>
            Every Healvo feature is unlocked. Your trial ends on{" "}
            <strong className="font-semibold text-white">{endDate}</strong>. Pick a plan below before then
            to keep going without a break.
          </>
        ),
        endLabel: "Trial ends",
        endValue: endDate,
      }
    : paymentDue || halted
      ? {
          tone: "attention",
          label: halted ? "Action needed" : "Payment due",
          title: `${planName} plan`,
          caption: (
            <>
              Paid through <strong className="font-semibold text-white">{endDate}</strong>.
            </>
          ),
          endLabel: "Paid through",
          endValue: endDate,
        }
      : hasPaidAccess && autoRenewOn
        ? {
            tone: "active",
            label: "Auto-renews",
            title: `${planName} plan`,
            caption: (
              <>
                Renews on its own. Next payment of {recurringPrice} on{" "}
                <strong className="font-semibold text-white">{nextPaymentDate}</strong>.
              </>
            ),
            endLabel: "Next payment",
            endValue: nextPaymentDate,
          }
        : hasPaidAccess
          ? {
              tone: endingSoon ? "attention" : "active",
              label: autoRenewOff ? "Auto-renewal off" : endingSoon ? "Ending soon" : "Active",
              title: `${planName} plan`,
              // One-time plans never renew by themselves, so the date is phrased as a deadline.
              caption: (
                <>
                  This plan doesn't renew on its own. Renew by{" "}
                  <strong className="font-semibold text-white">{endDate}</strong> to keep your clinic running.
                </>
              ),
              endLabel: "Renew by",
              endValue: endDate,
            }
          : {
              tone: "expired",
              label: "Expired",
              title: "Plan expired",
              caption: halted
                ? "Automatic payments stopped. Update your payment method to continue."
                : "Your clinic access is paused. Choose a plan below and everything will be exactly where you left it.",
              endLabel: "Ended",
              endValue: endDate,
            };

  const facts: { label: string; value: string }[] = [];
  if (accessWindow) {
    facts.push({ label: isTrial ? "Trial started" : "Started", value: formatAccessDate(accessWindow.startsAt) });
  }
  if (status.endValue) {
    facts.push({ label: status.endLabel, value: status.endValue });
  }
  if (methodName && facts.length < 3) {
    facts.push({ label: "Payment method", value: methodName });
  }

  const attention = halted
    ? "Automatic payments stopped. Update your payment method to start them again."
    : renewalCompleted
      ? "Your automatic renewal has ended. Turn it back on below to keep your plan."
      : paymentDue
        ? `Your ${endDate} payment didn't go through. We'll retry automatically, so there's nothing to do right now.`
        : null;

  const plansHeading = autoRenewOn ? "Change plan" : mode === "renew" ? "Renew your plan" : "Choose a plan";
  const plansSubtitle = autoRenewOn
    ? "Switching to annual turns off monthly auto-renewal at the end of your current month."
    : isTrial
      ? "Your paid plan starts as soon as payment goes through."
      : hasPaidAccess
        ? `Anything you add starts after ${endDate}, so you don't lose any days.`
        : "Choose a plan to restore your clinic's access.";

  return (
    <div className="space-y-5">
      <PlanStatusHero
        clinicName={activeClinic?.name ?? "Your clinic"}
        statusLabel={status.label}
        tone={status.tone}
        title={status.title}
        caption={status.caption}
        daysRemaining={daysRemaining}
        percentUsed={accessWindow ? (expired ? 100 : getAccessProgress(accessWindow)) : null}
        facts={facts}
      />

      {checkout.outcome && (
        <CheckoutOutcomeBanner outcome={checkout.outcome} onDismiss={checkout.dismissOutcome} />
      )}

      {attention && <AttentionCard message={attention} />}

      {autoRenewOn && (
        <Card className="p-5">
          <SectionHeader
            title="Manage subscription"
            subtitle={`${recurringPrice} a month, charged automatically to your saved method.`}
          />

          <dl className="mt-4 divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
            <ManageRow icon={RefreshCw} label="Automatic renewal" value="On" />
            <ManageRow icon={CalendarClock} label="Next payment" value={nextPaymentDate} />
            {methodName && <ManageRow icon={CreditCard} label="Payment method" value={methodName} />}
          </dl>

          <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--color-muted)]">
            Your subscription renews automatically. To stop future payments, manage your AutoPay mandate in
            your UPI app or with your card provider.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <SectionHeader title={plansHeading} subtitle={plansSubtitle} />

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
        <SectionHeader
          title="Billing history"
          subtitle="Invoices for your Healvo plan. Patient bills live in Billing."
          action={
            invoices.length > 0 ? (
              <span className="rounded-md bg-[var(--color-slate-bg)] px-2 py-0.5 text-[12px] font-semibold text-[var(--color-slate-text)]">
                {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
              </span>
            ) : undefined
          }
        />

        {invoicesLoading ? (
          <div className="mt-5 space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-11 animate-pulse rounded-lg bg-[var(--color-canvas)]"
                style={{ animationDelay: `${row * 90}ms` }}
              />
            ))}
            <span className="sr-only">Loading invoices…</span>
          </div>
        ) : invoicesError ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-[13px] text-[var(--color-muted)]">Couldn't load your invoices.</p>
            <Button variant="outline" onClick={() => void loadInvoices()}>
              <RotateCcw size={14} />
              Try again
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="mt-5 flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
              <ReceiptText size={18} strokeWidth={2} />
            </div>
            <p className="text-[13px] text-[var(--color-muted)]">
              No payments yet. Invoices show up here after your first payment.
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-2 sm:hidden">
              {invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-slate-bg)] text-[var(--color-slate-text)]">
                      <FileText size={15} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold text-[var(--color-ink)]">
                        {invoice.invoice_number}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                        {formatAccessDate(invoice.issued_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[13.5px] font-bold text-[var(--color-ink)] tabular-nums">
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
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[11px] tracking-[0.08em] text-[var(--color-muted)] uppercase">
                    <th className="pb-2.5 font-bold">Invoice</th>
                    <th className="pb-2.5 font-bold">Date</th>
                    <th className="pb-2.5 text-right font-bold">Amount</th>
                    <th className="pb-2.5 text-right font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="transition-colors hover:bg-[var(--color-canvas)]">
                      <td className="py-3">
                        <span className="flex items-center gap-2.5">
                          <FileText
                            size={15}
                            strokeWidth={2}
                            className="shrink-0 text-[var(--color-muted-soft)]"
                          />
                          <span className="font-bold text-[var(--color-ink)]">
                            {invoice.invoice_number}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 text-[var(--color-muted)]">
                        {formatAccessDate(invoice.issued_at)}
                      </td>
                      <td className="py-3 text-right font-bold text-[var(--color-ink)] tabular-nums">
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
