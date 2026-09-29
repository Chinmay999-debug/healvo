import { useEffect, useState } from "react";
import {
  Check,
  LoaderCircle,
  Lock,
  MessageCircle,
  Minus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { formatPriceINR, getActiveSubscriptionPlans } from "../../services/subscription";
import type { CheckoutPhase } from "../../state/useSubscriptionCheckout";

export const CORE_PLAN_CODE = "core";
export const PREMIUM_PLAN_CODE = "premium";
export const CORE_ANNUAL_PLAN_CODE = "core_annual";
export const PREMIUM_ANNUAL_PLAN_CODE = "premium_annual";

const PLAN_CODES = [CORE_PLAN_CODE, PREMIUM_PLAN_CODE, CORE_ANNUAL_PLAN_CODE, PREMIUM_ANNUAL_PLAN_CODE];
const ANNUAL_CODES = [CORE_ANNUAL_PLAN_CODE, PREMIUM_ANNUAL_PLAN_CODE];

type Interval = "monthly" | "annual";
type Tier = "Core" | "Premium";

/** Shown until the live catalog loads (and if it can't). Mirrors subscription_plans. */
const DEFAULT_PRICES: Record<string, number> = {
  [CORE_PLAN_CODE]: 49900,
  [PREMIUM_PLAN_CODE]: 99900,
  [CORE_ANNUAL_PLAN_CODE]: 598800,
  [PREMIUM_ANNUAL_PLAN_CODE]: 1198800,
};

/** Every row is a real Healvo feature. The last two are what Premium adds. */
const COMPARISON: { feature: string; premiumOnly?: boolean; icon?: LucideIcon }[] = [
  { feature: "Patient management" },
  { feature: "Appointments" },
  { feature: "Dental chart" },
  { feature: "Billing & payments" },
  { feature: "Reports" },
  { feature: "Online booking" },
  { feature: "AI Assistant", premiumOnly: true, icon: Sparkles },
  { feature: "WhatsApp appointment confirmations", premiumOnly: true, icon: MessageCircle },
];

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
  onSelect: (planCode: string) => void;
  recurringMonthly?: boolean;
  hasPaidTime?: boolean;
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
  autoRenewOn = false,
  trialActive = false,
}: PlanPickerProps) {
  const currentIsAnnual = currentPlanCode ? ANNUAL_CODES.includes(currentPlanCode) : false;
  const [interval, setBillingInterval] = useState<Interval>(currentIsAnnual ? "annual" : "monthly");
  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_PRICES);

  useEffect(() => {
    getActiveSubscriptionPlans()
      .then((apiPlans) => {
        const live: Record<string, number> = {};
        for (const p of apiPlans) {
          if (PLAN_CODES.includes(p.code)) live[p.code] = p.base_price_paise;
        }
        if (live[CORE_PLAN_CODE] && live[PREMIUM_PLAN_CODE]) {
          setPrices((prev) => ({ ...prev, ...live }));
        }
      })
      .catch(() => {});
  }, []);

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
    pricePaise: prices[code] ?? DEFAULT_PRICES[code],
    annual,
    isCurrent: currentPlanCode === code,
    action: getAction(code),
    isPending: pendingPlanCode === code,
    phase,
    onSelect,
  });

  return (
    <div>
      <BillingToggle value={interval} onChange={setBillingInterval} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <CorePlanCard {...cardProps(coreCode)} />
        <PremiumPlanCard {...cardProps(premiumCode)} />
      </div>

      <ComparisonTable />

      {trialActive && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-3 text-[12.5px]">
          <span className="font-bold text-[var(--color-ink)]">During your free trial</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--color-ink)]">
            <Check size={14} strokeWidth={3} className="text-[var(--color-mint-text)]" />
            AI Assistant included
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--color-muted)]">
            <Minus size={14} strokeWidth={3} className="text-[var(--color-muted-soft)]" />
            WhatsApp confirmations start with Premium
          </span>
        </div>
      )}

      <p className="mt-4 text-center text-[12px] text-[var(--color-muted)]">
        Prices in INR, plus applicable GST.
      </p>
    </div>
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

      <div className="flex min-h-[24px] items-center gap-2 text-[12.5px]">
        {annual ? (
          <span key="annual" className="plan-fade-in inline-flex items-center gap-2">
            <FreeMonthsBadge />
            <span className="font-semibold text-[var(--color-ink)]">Pay for 12 months, get 14 months</span>
          </span>
        ) : (
          <button
            key="monthly"
            type="button"
            onClick={() => onChange("annual")}
            className="plan-fade-in cursor-pointer text-[var(--color-muted)] transition-colors hover:text-[var(--color-teal)]"
          >
            Go annual and get <span className="font-bold text-[var(--color-teal)]">2 months free</span>
          </button>
        )}
      </div>
    </div>
  );
}

function FreeMonthsBadge({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-[3px] text-[10.5px] font-extrabold tracking-[0.08em] uppercase",
        onDark
          ? "bg-[#2dd4bf]/15 text-[#5eead4] ring-1 ring-[#2dd4bf]/30 ring-inset"
          : "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)] ring-1 ring-[var(--color-mint-text)]/20 ring-inset",
      )}
    >
      2 months free
    </span>
  );
}

/* ----------------------------------------------------------------- cards -- */

interface PlanCardProps {
  code: string;
  pricePaise: number;
  annual: boolean;
  isCurrent: boolean;
  action: { label: string; disabled: boolean };
  isPending: boolean;
  phase: CheckoutPhase;
  onSelect: (planCode: string) => void;
}

function PriceBlock({ pricePaise, annual, onDark }: { pricePaise: number; annual: boolean; onDark: boolean }) {
  return (
    <div key={`${pricePaise}-${annual}`} className="plan-fade-in mt-5">
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[38px] leading-none font-extrabold tracking-[-0.035em] tabular-nums",
            onDark ? "text-white" : "text-[var(--color-ink)]",
          )}
        >
          {formatPriceINR(pricePaise)}
        </span>
        {!annual && (
          <span className={cn("text-[14px] font-semibold", onDark ? "text-white/55" : "text-[var(--color-muted)]")}>
            / month
          </span>
        )}
      </div>
      <div className="mt-2.5 flex min-h-[22px] flex-wrap items-center gap-2">
        {annual ? (
          <>
            <FreeMonthsBadge onDark={onDark} />
            <span className={cn("text-[12.5px] font-semibold", onDark ? "text-white/80" : "text-[var(--color-ink)]")}>
              Pay for 12 months, get 14 months
            </span>
          </>
        ) : (
          <span className={cn("text-[12.5px]", onDark ? "text-white/55" : "text-[var(--color-muted)]")}>
            Billed monthly
          </span>
        )}
      </div>
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

function CorePlanCard({ code, pricePaise, annual, isCurrent, action, isPending, phase, onSelect }: PlanCardProps) {
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
        Everything to run your clinic, day to day.
      </p>

      <PriceBlock pricePaise={pricePaise} annual={annual} onDark={false} />

      <ul className="mt-5 space-y-2.5 border-t border-[var(--color-border)] pt-5 text-[13px]">
        <li className="flex items-center gap-2.5 font-semibold text-[var(--color-ink)]">
          <Check size={15} strokeWidth={2.75} className="shrink-0 text-[var(--color-teal)]" />
          All clinic management features
        </li>
        <li className="flex items-center gap-2.5 text-[var(--color-muted)]">
          <Minus size={15} strokeWidth={2.5} className="shrink-0 text-[var(--color-muted-soft)]" />
          AI Assistant not included
        </li>
        <li className="flex items-center gap-2.5 text-[var(--color-muted)]">
          <Minus size={15} strokeWidth={2.5} className="shrink-0 text-[var(--color-muted-soft)]" />
          WhatsApp confirmations not included
        </li>
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

function PremiumPlanCard({ code, pricePaise, annual, isCurrent, action, isPending, phase, onSelect }: PlanCardProps) {
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
        Everything in Core, plus AI and WhatsApp.
      </p>

      <div className="relative">
        <PriceBlock pricePaise={pricePaise} annual={annual} onDark />
      </div>

      <ul className="relative mt-5 space-y-2.5 border-t border-white/10 pt-5 text-[13px]">
        <li className="flex items-center gap-2.5 font-semibold">
          <Check size={15} strokeWidth={2.75} className="shrink-0 text-[#5eead4]" />
          Everything in Core
        </li>
        <li className="flex items-center gap-2.5 font-semibold">
          <Sparkles size={15} strokeWidth={2.25} className="shrink-0 text-[#5eead4]" />
          AI Assistant
        </li>
        <li className="flex items-center gap-2.5 font-semibold">
          <MessageCircle size={15} strokeWidth={2.25} className="shrink-0 text-[#5eead4]" />
          WhatsApp appointment confirmations
        </li>
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
            {COMPARISON.map(({ feature, premiumOnly, icon: Icon }) => (
              <tr key={feature} className={premiumOnly ? "bg-[var(--color-teal)]/[0.035]" : undefined}>
                <th scope="row" className="px-4 py-3 font-semibold text-[var(--color-ink)]">
                  <span className="flex items-center gap-2">
                    {Icon && <Icon size={14} strokeWidth={2.25} className="shrink-0 text-[var(--color-teal)]" />}
                    {feature}
                  </span>
                </th>
                <td className="px-2 py-3 text-center">
                  {premiumOnly ? (
                    <span className="inline-flex text-[var(--color-muted-soft)]" aria-label="Not included">
                      <Minus size={16} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <IncludedMark subtle />
                  )}
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
