import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  LoaderCircle,
  Lock,
  Minus,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { inputClass } from "../ui/fieldStyles";
import { WHATSAPP_GREEN, WhatsAppIcon } from "../ui/WhatsAppIcon";
import { cn } from "../../lib/utils";
import { useAuth } from "../../state/authContext";
import { checkoutRouteFor } from "../../services/platformBilling";
import { formatExactINR, formatPriceINR, getCheckoutQuotes } from "../../services/subscription";
import type { CheckoutQuote } from "../../types/subscription";
import type { CheckoutPhase } from "../../state/useSubscriptionCheckout";

export const CORE_PLAN_CODE = "core";
export const PREMIUM_PLAN_CODE = "premium";
export const CORE_ANNUAL_PLAN_CODE = "core_annual";
export const PREMIUM_ANNUAL_PLAN_CODE = "premium_annual";

const ANNUAL_CODES = [CORE_ANNUAL_PLAN_CODE, PREMIUM_ANNUAL_PLAN_CODE];

type Interval = "monthly" | "annual";
type Tier = "Core" | "Premium";

/**
 * Standard prices, shown until the server's quotes load (and if they can't).
 * Display only: what is charged always comes from the server.
 */
const DEFAULT_PRICES: Record<string, number> = {
  [CORE_PLAN_CODE]: 99800,
  [PREMIUM_PLAN_CODE]: 199800,
  [CORE_ANNUAL_PLAN_CODE]: 1197600,
  [PREMIUM_ANNUAL_PLAN_CODE]: 2397600,
};

/** Every line is a real Healvo feature, included in both plans. */
const CORE_FEATURES = [
  "Patient management",
  "Appointments",
  "Dental chart",
  "Billing & payments",
  "Reports",
  "Online booking",
];

/** What Premium adds on top of Core. */
const PREMIUM_FEATURES = ["AI Assistant", "WhatsApp appointment confirmations"] as const;

/** Sparkle for AI (tinted by `aiClassName`); WhatsApp always keeps its brand green. */
function PremiumFeatureIcon({ feature, size, aiClassName }: { feature: string; size: number; aiClassName: string }) {
  if (feature === "AI Assistant") {
    return <Sparkles size={size} strokeWidth={2.25} className={cn("shrink-0", aiClassName)} />;
  }
  return (
    <span className="inline-flex shrink-0" style={{ color: WHATSAPP_GREEN }}>
      <WhatsAppIcon size={size} />
    </span>
  );
}

function tierOf(code: string | null | undefined): Tier | null {
  if (!code) return null;
  if (code.startsWith("premium")) return "Premium";
  if (code.startsWith("core")) return "Core";
  return null;
}

function busyLabel(phase: CheckoutPhase) {
  if (phase === "starting") return "Starting checkout...";
  if (phase === "paying") return "Waiting for payment...";
  if (phase === "confirming") return "Confirming payment...";
  return "Please wait...";
}

export interface PlanPickerProps {
  mode: "choose" | "renew";
  currentPlanCode?: string | null;
  phase: CheckoutPhase;
  pendingPlanCode: string | null;
  onSelect: (planCode: string, couponCode: string | null) => void;
  recurringMonthly?: boolean;
  hasPaidTime?: boolean;
  /** Formatted end of paid access, when there is paid time left. */
  paidThrough?: string | null;
  autoRenewOn?: boolean;
  monthlyLocked?: boolean;
  /** The clinic is in its free trial: explain what the trial does and doesn't include. */
  trialActive?: boolean;
}

export function PlanPicker({
  currentPlanCode = null,
  phase,
  pendingPlanCode,
  onSelect,
  recurringMonthly = false,
  paidThrough = null,
  autoRenewOn = false,
  trialActive = false,
}: PlanPickerProps) {
  const { activeClinic } = useAuth();
  const clinicId = activeClinic?.id;
  const currentIsAnnual = currentPlanCode ? ANNUAL_CODES.includes(currentPlanCode) : false;
  const [interval, setBillingInterval] = useState<Interval>(currentIsAnnual ? "annual" : "monthly");
  // What the clinic pays with no code: the standard price, or its launch price
  // if it already has one. The cards always show this.
  const [quotes, setQuotes] = useState<Record<string, CheckoutQuote>>({});
  // The server's prices with a code that applied, used only inside checkout.
  const [couponQuotes, setCouponQuotes] = useState<Record<string, CheckoutQuote> | null>(null);
  const [coupon, setCoupon] = useState<CouponState>({ applied: null, feedback: null });
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [reviewCode, setReviewCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadQuotes = useCallback(async () => {
    if (!clinicId) return;
    const result = await getCheckoutQuotes(clinicId);
    setQuotes(Object.fromEntries(result.quotes.map((q) => [q.plan_code, q])));
    setLoadError(false);
  }, [clinicId]);

  useEffect(() => {
    loadQuotes().catch(() => {});
  }, [loadQuotes]);

  const applyCoupon = async (code: string) => {
    if (!clinicId) return;
    setCheckingCoupon(true);
    setCouponQuotes(null);
    try {
      const result = await getCheckoutQuotes(clinicId, code);
      const first = result.quotes[0];
      if (!first) throw new Error("no quote");
      if (first.coupon_status === "applied") {
        setCouponQuotes(Object.fromEntries(result.quotes.map((q) => [q.plan_code, q])));
        setCoupon({ applied: first.coupon_code, feedback: null });
      } else {
        setCoupon({
          applied: null,
          feedback: {
            // A clinic that already has launch pricing has lost nothing.
            tone: first.price_tier === "launch" ? "ok" : "bad",
            text: first.coupon_message ?? "That code can't be used.",
          },
        });
      }
    } catch {
      setCoupon({ applied: null, feedback: { tone: "bad", text: "Couldn't check that code. Please try again." } });
    } finally {
      setCheckingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCouponQuotes(null);
    setCoupon({ applied: null, feedback: null });
  };

  // A plan can only be reviewed with the server's price in hand.
  const reviewPlan = async (code: string) => {
    if (!quotes[code]) {
      try {
        await loadQuotes();
      } catch {
        setLoadError(true);
        return;
      }
    }
    setReviewCode(code);
  };

  const closeReview = () => {
    setReviewCode(null);
    removeCoupon();
  };

  const annual = interval === "annual";
  const coreCode = annual ? CORE_ANNUAL_PLAN_CODE : CORE_PLAN_CODE;
  const premiumCode = annual ? PREMIUM_ANNUAL_PLAN_CODE : PREMIUM_PLAN_CODE;
  const currentTier = tierOf(currentPlanCode);

  const getAction = (planCode: string): { label: string; disabled: boolean } => {
    if (currentPlanCode === planCode && autoRenewOn && !annual) {
      return { label: "Current plan · renews automatically", disabled: true };
    }
    const tier = tierOf(planCode)!;
    const targetAnnual = ANNUAL_CODES.includes(planCode);
    const suffix = targetAnnual ? " Annual" : "";

    if (!currentPlanCode) return { label: `Choose ${tier}${suffix}`, disabled: false };
    if (currentPlanCode === planCode) return { label: `Renew ${tier}${suffix}`, disabled: false };
    if (currentTier === "Core" && tier === "Premium") return { label: `Upgrade to Premium${suffix}`, disabled: false };
    if (currentTier === tier) return { label: `Switch to ${targetAnnual ? "annual" : "monthly"}`, disabled: false };
    return { label: `Switch to ${tier}${suffix}`, disabled: false };
  };

  const cardProps = (code: string) => ({
    code,
    quote: quotes[code] ?? null,
    annual,
    recurring: recurringMonthly,
    isCurrent: currentPlanCode === code,
    action: getAction(code),
    isPending: pendingPlanCode === code,
    phase,
    onSelect: (code: string) => void reviewPlan(code),
  });

  const gstRate = Object.values(quotes)[0]?.gst_rate_bps ?? 0;
  const reviewing = reviewCode ? couponQuotes?.[reviewCode] ?? quotes[reviewCode] ?? null : null;

  return (
    <div>
      <BillingToggle value={interval} onChange={setBillingInterval} />

      {loadError && (
        <p role="alert" className="mt-4 text-center text-[12.5px] font-semibold text-[var(--color-danger-text)]">
          Couldn't load prices. Check your connection and try again.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <CorePlanCard {...cardProps(coreCode)} />
        <PremiumPlanCard {...cardProps(premiumCode)} />
      </div>

      <ComparisonTable />

      {trialActive && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-3 text-[12.5px]">
          <span className="font-bold text-[var(--color-ink)]">During your 30-Day Free Trial</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--color-ink)]">
            <Check size={14} strokeWidth={3} className="text-[var(--color-mint-text)]" />
            AI Assistant included
          </span>
          <span className="inline-flex items-start gap-1.5 text-[var(--color-muted)]">
            <Minus size={14} strokeWidth={3} className="mt-px shrink-0 text-[var(--color-muted-soft)]" />
            WhatsApp appointment confirmations start with Premium
          </span>
        </div>
      )}

      <p className="mt-4 text-center text-[12px] text-[var(--color-muted)]">
        {gstRate > 0 ? "Prices in INR, plus GST." : "Prices in INR. No GST is charged right now."}
      </p>

      <CheckoutSummary
        quote={reviewing}
        coupon={coupon}
        checkingCoupon={checkingCoupon}
        hasLaunchPricing={Boolean(reviewCode && quotes[reviewCode]?.price_tier === "launch")}
        onApplyCoupon={applyCoupon}
        onRemoveCoupon={removeCoupon}
        recurring={Boolean(reviewCode) && checkoutRouteFor(reviewCode ?? "", recurringMonthly) === "recurring"}
        trialActive={trialActive}
        paidThrough={paidThrough}
        onClose={closeReview}
        onConfirm={() => {
          if (!reviewCode) return;
          const code = coupon.applied;
          closeReview();
          onSelect(reviewCode, code);
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- coupon -- */

interface CouponState {
  applied: string | null;
  feedback: { tone: "ok" | "bad"; text: string } | null;
}

function CouponField({
  applied,
  feedback,
  checking,
  hidden,
  onApply,
  onRemove,
}: CouponState & {
  checking: boolean;
  hidden: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState("");

  if (hidden) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim() && !checking) onApply(value.trim());
  };

  return (
    <div className="mb-4">
      {applied ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-mint-text)]/25 bg-[var(--color-mint-bg)] px-3.5 py-2.5 text-[13px]">
          <span className="inline-flex min-w-0 items-center gap-2 font-bold text-[var(--color-mint-text)]">
            <CheckCircle2 size={15} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">{applied} applied</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setValue("");
              onRemove();
            }}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[12.5px] font-semibold text-[var(--color-mint-text)] hover:underline"
          >
            <X size={13} strokeWidth={2.5} />
            Remove
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Tag
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted-soft)]"
            />
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Coupon code"
              aria-label="Coupon code"
              maxLength={64}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={cn(inputClass, "pl-8 uppercase placeholder:normal-case")}
            />
          </div>
          <Button type="submit" variant="outline" disabled={checking || !value.trim()} className="shrink-0 rounded-xl">
            {checking ? <LoaderCircle size={14} className="animate-spin" /> : "Apply"}
          </Button>
        </form>
      )}
      {feedback && !applied && (
        <p
          role={feedback.tone === "bad" ? "alert" : "status"}
          className={cn(
            "mt-2 text-[12.5px] font-semibold",
            feedback.tone === "bad" ? "text-[var(--color-danger-text)]" : "text-[var(--color-mint-text)]",
          )}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- summary -- */

function SummaryRow({ label, value, strong = false, accent = false }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "text-[15px] font-extrabold text-[var(--color-ink)]" : "text-[13px]")}>
      <dt className={strong ? undefined : "text-[var(--color-muted)]"}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          accent ? "font-bold text-[var(--color-mint-text)]" : !strong && "font-semibold text-[var(--color-ink)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CheckoutSummary({
  quote,
  coupon,
  checkingCoupon,
  hasLaunchPricing,
  onApplyCoupon,
  onRemoveCoupon,
  recurring,
  trialActive,
  paidThrough,
  onClose,
  onConfirm,
}: {
  quote: CheckoutQuote | null;
  coupon: CouponState;
  checkingCoupon: boolean;
  hasLaunchPricing: boolean;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  recurring: boolean;
  trialActive: boolean;
  paidThrough: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!quote) return null;

  const annual = quote.interval === "year";
  const payable = formatExactINR(quote.payable_paise);
  // Autopay on top of remaining paid time charges nothing today.
  const chargesLater = recurring && Boolean(paidThrough);
  const tier = quote.plan_code.startsWith("premium") ? "Premium" : "Core";

  return (
    <Modal open onClose={onClose} title={`Healvo ${tier} · ${annual ? "Annual" : "Monthly"}`} className="max-w-md">
      <CouponField
        applied={coupon.applied}
        feedback={coupon.feedback}
        checking={checkingCoupon}
        hidden={hasLaunchPricing}
        onApply={onApplyCoupon}
        onRemove={onRemoveCoupon}
      />

      <dl className="space-y-2.5">
        <SummaryRow label="Standard price" value={formatExactINR(quote.reference_paise)} />
        {quote.discount_paise > 0 && (
          <SummaryRow
            label={quote.coupon_code ? `Coupon ${quote.coupon_code}` : "Launch pricing"}
            value={`− ${formatExactINR(quote.discount_paise)}`}
            accent
          />
        )}
        <SummaryRow
          label={quote.gst_rate_bps > 0 ? `GST (${quote.gst_rate_bps / 100}%)` : "GST"}
          value={quote.gst_rate_bps > 0 ? formatExactINR(quote.gst_paise) : "Not charged"}
        />
        <div className="border-t border-[var(--color-border)] pt-2.5">
          <SummaryRow label={chargesLater ? `Due on ${paidThrough}` : "Payable now"} value={payable} strong />
        </div>
      </dl>

      <ul className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-[var(--color-muted)]">
        {annual ? (
          <li>One payment for 12 months. It doesn't renew by itself.</li>
        ) : recurring ? (
          <li>Renews automatically at {payable} a month until you stop it.</li>
        ) : (
          <li>Covers one month. It doesn't renew by itself.</li>
        )}
        {trialActive && <li>Paying now ends your free trial today, and your paid plan starts straight away.</li>}
        {paidThrough && !chargesLater && <li>This starts after your current plan ends on {paidThrough}.</li>}
        {chargesLater && <li>Nothing extra is charged today. Your new plan starts on {paidThrough}.</li>}
      </ul>

      <div className="mt-5 flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1 justify-center rounded-xl">
          Back
        </Button>
        <Button onClick={onConfirm} className="flex-[2] justify-center rounded-xl font-bold">
          {chargesLater ? "Set up autopay" : `Pay ${payable}`}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- toggle -- */

function BillingToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  const annual = value === "annual";
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="relative inline-grid grid-cols-2 rounded-full border border-[var(--color-border)] bg-[var(--color-canvas)] p-1"
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-[var(--color-surface-raised)] shadow-[0_1px_2px_rgba(15,34,58,0.08),0_4px_12px_-4px_rgba(15,34,58,0.18)] ring-1 ring-[var(--color-border)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            annual && "translate-x-full",
          )}
        />
        {(["monthly", "annual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "relative z-10 w-[118px] cursor-pointer rounded-full py-2 text-[13.5px] font-bold capitalize transition-colors",
              value === option
                ? "text-[var(--color-ink)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {option}
          </button>
        ))}
      </div>

    </div>
  );
}

/* ----------------------------------------------------------------- cards -- */

interface PlanCardProps {
  code: string;
  quote: CheckoutQuote | null;
  annual: boolean;
  recurring: boolean;
  isCurrent: boolean;
  action: { label: string; disabled: boolean };
  isPending: boolean;
  phase: CheckoutPhase;
  onSelect: (planCode: string) => void;
}

function PriceBlock({
  code,
  quote,
  annual,
  recurring,
  onDark,
}: {
  code: string;
  quote: CheckoutQuote | null;
  annual: boolean;
  recurring: boolean;
  onDark: boolean;
}) {
  const standard = quote?.reference_paise ?? DEFAULT_PRICES[code];
  // Only a clinic that already has launch pricing sees anything else here.
  const price = quote?.payable_paise ?? standard;

  return (
    <div key={`${code}-${price}`} className="plan-fade-in mt-5">
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[38px] leading-none font-extrabold tracking-[-0.035em] tabular-nums",
            onDark ? "text-white" : "text-[var(--color-ink)]",
          )}
        >
          {formatPriceINR(price)}
        </span>
        <span className={cn("text-[14px] font-semibold", onDark ? "text-white/55" : "text-[var(--color-muted)]")}>
          / {annual ? "year" : "month"}
        </span>
      </div>
      <p className={cn("mt-2.5 min-h-[22px] text-[12.5px]", onDark ? "text-white/55" : "text-[var(--color-muted)]")}>
        {annual ? "12 months access" : recurring ? "Billed monthly" : "Pay each month. No auto-renewal."}
      </p>
    </div>
  );
}

function CurrentBadge({ onDark }: { onDark: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
        onDark
          ? "bg-white/10 text-white ring-1 ring-white/20 ring-inset"
          : "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
      )}
    >
      <Check size={11} strokeWidth={3} />
      Current plan
    </span>
  );
}

function CtaContent({ isPending, phase, locked, label }: { isPending: boolean; phase: CheckoutPhase; locked: boolean; label: string }) {
  if (isPending) {
    return (
      <>
        <LoaderCircle size={15} className="animate-spin" />
        {busyLabel(phase)}
      </>
    );
  }
  return (
    <>
      {locked && <Lock size={13} strokeWidth={2.5} />}
      {label}
    </>
  );
}

function CorePlanCard({ code, quote, annual, recurring, isCurrent, action, isPending, phase, onSelect }: PlanCardProps) {
  const locked = action.disabled && !isPending;
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-[var(--color-surface)] p-6 transition-shadow",
        isCurrent ? "border-[var(--color-mint-text)]/40" : "border-[var(--color-border)]",
      )}
    >
      <div className="flex min-h-[26px] items-center justify-between gap-2">
        <h3 className="text-[18px] font-extrabold tracking-tight text-[var(--color-ink)]">Core</h3>
        {isCurrent && <CurrentBadge onDark={false} />}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">
        Everything a clinic needs to run day-to-day
      </p>

      <PriceBlock code={code} quote={quote} annual={annual} recurring={recurring} onDark={false} />

      <ul className="mt-5 space-y-2.5 border-t border-[var(--color-border)] pt-5 text-[13px]">
        {CORE_FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 font-semibold text-[var(--color-ink)]">
            <Check size={15} strokeWidth={2.75} className="shrink-0 text-[var(--color-teal)]" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="flex-1" />

      <Button
        variant="outline"
        className="mt-6 min-h-11 w-full justify-center rounded-xl text-[14px] font-bold"
        disabled={phase !== "idle" || action.disabled}
        aria-busy={isPending}
        onClick={() => onSelect(code)}
      >
        <CtaContent isPending={isPending} phase={phase} locked={locked} label={action.label} />
      </Button>
    </div>
  );
}

function PremiumPlanCard({ code, quote, annual, recurring, isCurrent, action, isPending, phase, onSelect }: PlanCardProps) {
  const locked = action.disabled && !isPending;
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl p-6 text-white shadow-[0_24px_48px_-28px_rgba(8,145,178,0.75)]"
      style={{
        background:
          "radial-gradient(520px circle at 100% 0%, rgba(45,212,191,0.22), transparent 60%)," +
          "radial-gradient(480px circle at 0% 110%, rgba(8,145,178,0.28), transparent 60%)," +
          "#0d1b2a",
      }}
    >
      {/* gradient hairline border */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl p-px"
        style={{
          background: "linear-gradient(140deg, rgba(45,212,191,0.75), rgba(8,145,178,0.25) 45%, rgba(255,255,255,0.08))",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      <div className="relative flex min-h-[26px] items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[18px] font-extrabold tracking-tight">
          Premium
          <Sparkles size={15} className="text-[#5eead4]" />
        </h3>
        {isCurrent ? (
          <CurrentBadge onDark />
        ) : (
          <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-white/75 ring-1 ring-white/10 ring-inset">
            AI + WhatsApp
          </span>
        )}
      </div>
      <p className="relative mt-1 text-[13px] leading-relaxed text-white/60">
        Everything in Core, plus AI & WhatsApp
      </p>

      <div className="relative">
        <PriceBlock code={code} quote={quote} annual={annual} recurring={recurring} onDark />
      </div>

      <ul className="relative mt-5 space-y-2.5 border-t border-white/10 pt-5 text-[13px]">
        <li className="flex items-center gap-2.5 font-semibold">
          <Check size={15} strokeWidth={2.75} className="shrink-0 text-[#5eead4]" />
          Everything in Core
        </li>
        {PREMIUM_FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 font-semibold">
            <PremiumFeatureIcon feature={feature} size={15} aiClassName="text-[#5eead4]" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="flex-1" />

      <button
        type="button"
        className="relative mt-6 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2dd4bf] to-[#0891b2] px-4 text-[14px] font-bold text-[#04232a] shadow-[0_8px_20px_-8px_rgba(45,212,191,0.7)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
        disabled={phase !== "idle" || action.disabled}
        aria-busy={isPending}
        onClick={() => onSelect(code)}
      >
        <CtaContent isPending={isPending} phase={phase} locked={locked} label={action.label} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ comparison -- */

function ComparisonTable() {
  return (
    <div className="mt-8">
      <h3 className="text-[13px] font-extrabold tracking-tight text-[var(--color-ink)]">Compare plans</h3>
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-[var(--color-canvas)] text-[11px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">
              <th scope="col" className="px-4 py-3 font-bold">Feature</th>
              <th scope="col" className="w-[72px] px-2 py-3 text-center font-bold sm:w-[110px]">Core</th>
              <th scope="col" className="w-[82px] bg-[var(--color-teal)]/[0.08] px-2 py-3 text-center font-bold text-[var(--color-teal)] sm:w-[110px]">
                Premium
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {CORE_FEATURES.map((feature) => (
              <tr key={feature}>
                <th scope="row" className="px-4 py-3 font-semibold text-[var(--color-ink)]">
                  {feature}
                </th>
                <td className="px-2 py-3 text-center">
                  <IncludedMark subtle />
                </td>
                <td className="bg-[var(--color-teal)]/[0.08] px-2 py-3 text-center">
                  <IncludedMark />
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--color-teal)]/[0.035]">
              <th
                scope="rowgroup"
                colSpan={3}
                className="px-4 pt-3 pb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--color-teal)] uppercase"
              >
                Premium adds
              </th>
            </tr>
            {PREMIUM_FEATURES.map((feature) => (
              <tr key={feature} className="bg-[var(--color-teal)]/[0.035]">
                <th scope="row" className="px-4 py-3 font-semibold text-[var(--color-ink)]">
                  <span className="flex items-center gap-2">
                    <PremiumFeatureIcon feature={feature} size={14} aiClassName="text-[var(--color-teal)]" />
                    {feature}
                  </span>
                </th>
                <td className="px-2 py-3 text-center">
                  <span
                    className="inline-flex text-[14px] font-semibold text-[var(--color-muted-soft)]"
                    aria-label="Available with Premium"
                  >
                    —
                  </span>
                </td>
                <td className="bg-[var(--color-teal)]/[0.08] px-2 py-3 text-center">
                  <IncludedMark />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncludedMark({ subtle = false }: { subtle?: boolean }) {
  return (
    <span
      aria-label="Included"
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full",
        subtle
          ? "text-[var(--color-teal)]"
          : "bg-gradient-to-br from-[#2dd4bf] to-[#0891b2] text-white shadow-[0_2px_6px_-2px_rgba(8,145,178,0.6)]",
      )}
    >
      <Check size={subtle ? 16 : 12} strokeWidth={3} />
    </span>
  );
}
