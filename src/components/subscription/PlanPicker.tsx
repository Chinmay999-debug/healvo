import { useEffect, useState } from "react";
import { Check, LoaderCircle, Lock, Zap } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { formatPriceINR, getActiveSubscriptionPlans } from "../../services/subscription";
import type { CheckoutPhase } from "../../state/useSubscriptionCheckout";

export const CORE_PLAN_CODE = "core";
export const PREMIUM_PLAN_CODE = "premium";
export const CORE_ANNUAL_PLAN_CODE = "core_annual";
export const PREMIUM_ANNUAL_PLAN_CODE = "premium_annual";

interface PlanDisplay {
  code: string;
  name: string;
  pricePaise: number;
  periodLabel: string;
}

const DEFAULT_PLANS: Record<string, PlanDisplay> = {
  [CORE_PLAN_CODE]: { code: CORE_PLAN_CODE, name: "Core", pricePaise: 49900, periodLabel: "month" },
  [PREMIUM_PLAN_CODE]: { code: PREMIUM_PLAN_CODE, name: "Premium", pricePaise: 99900, periodLabel: "month" },
  [CORE_ANNUAL_PLAN_CODE]: { code: CORE_ANNUAL_PLAN_CODE, name: "Core", pricePaise: 598800, periodLabel: "year" },
  [PREMIUM_ANNUAL_PLAN_CODE]: { code: PREMIUM_ANNUAL_PLAN_CODE, name: "Premium", pricePaise: 1198800, periodLabel: "year" },
};

const CORE_INCLUDED = [
  "FDI dental chart, status and notes per tooth",
  "Consultations with prescriptions",
  "Billing: UPI, cash, card, part payments",
  "Online booking page for patients",
];

const PREMIUM_INCLUDED = [
  ...CORE_INCLUDED,
  "Healvo AI clinic assistant",
  "WhatsApp Cloud API integration",
];

function busyLabel(phase: CheckoutPhase) {
  if (phase === "initializing") return "Starting...";
  if (phase === "waiting_for_gateway") return "Loading secure checkout...";
  if (phase === "verifying") return "Confirming payment...";
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
}

export function PlanPicker({
  mode,
  currentPlanCode = null,
  phase,
  pendingPlanCode,
  onSelect,
  recurringMonthly = false,
  hasPaidTime = false,
  autoRenewOn = false,
}: PlanPickerProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<Record<string, PlanDisplay>>(DEFAULT_PLANS);

  useEffect(() => {
    getActiveSubscriptionPlans().then((apiPlans) => {
      const mapped: Record<string, PlanDisplay> = {};
      for (const p of apiPlans) {
        if ([CORE_PLAN_CODE, PREMIUM_PLAN_CODE, CORE_ANNUAL_PLAN_CODE, PREMIUM_ANNUAL_PLAN_CODE].includes(p.code)) {
          mapped[p.code] = {
            code: p.code,
            name: p.name.replace(" Monthly", "").replace(" Annual", ""),
            pricePaise: p.basePricePaise,
            periodLabel: p.interval,
          };
        }
      }
      if (mapped[CORE_PLAN_CODE] && mapped[PREMIUM_PLAN_CODE]) {
        setPlans(mapped);
      }
    }).catch(() => {});
  }, []);

  const coreCode = billingInterval === "monthly" ? CORE_PLAN_CODE : CORE_ANNUAL_PLAN_CODE;
  const premiumCode = billingInterval === "monthly" ? PREMIUM_PLAN_CODE : PREMIUM_ANNUAL_PLAN_CODE;

  const core = plans[coreCode] || DEFAULT_PLANS[coreCode];
  const premium = plans[premiumCode] || DEFAULT_PLANS[premiumCode];

  const getAction = (planCode: string) => {
    if (currentPlanCode === planCode && autoRenewOn && billingInterval === "monthly") {
      return { label: "Auto-renewal is on", disabled: true };
    }
    // For annual purchases, even if they currently hold the annual plan, they can manually renew it early.
    // If they hold monthly and click annual, they are switching to annual.
    const isPremium = planCode === PREMIUM_PLAN_CODE || planCode === PREMIUM_ANNUAL_PLAN_CODE;
    
    if (currentPlanCode && currentPlanCode !== planCode) {
      if (planCode === CORE_ANNUAL_PLAN_CODE || planCode === PREMIUM_ANNUAL_PLAN_CODE) {
        return { label: `Switch to Annual ${isPremium ? "Premium" : "Core"}`, disabled: false };
      }
      return { label: `Switch to ${isPremium ? "Premium" : "Core"}`, disabled: false };
    }
    
    if (planCode === CORE_ANNUAL_PLAN_CODE || planCode === PREMIUM_ANNUAL_PLAN_CODE) {
      return { label: `Pay for 12 months, get 14 months`, disabled: false };
    }
    
    return { label: `Start ${isPremium ? "Premium" : "Core"}`, disabled: false };
  };

  const options = [
    {
      plan: core,
      featured: false,
      ribbon: null,
      tagline: "Essential tools to run your clinic",
      priceNote: billingInterval === "monthly" ? "Charged automatically every month" : "One-time payment for 14 months access",
      highlights: CORE_INCLUDED,
      action: getAction(coreCode),
    },
    {
      plan: premium,
      featured: true,
      ribbon: "Most Popular",
      tagline: "Advanced AI and WhatsApp automation",
      priceNote: billingInterval === "monthly" ? "Charged automatically every month" : "One-time payment for 14 months access",
      highlights: [
        "Everything in Core, plus:",
        "Healvo AI clinic assistant",
        "Automated WhatsApp confirmations"
      ],
      action: getAction(premiumCode),
    },
  ];

  return (
    <div>
      <div className="flex justify-center mb-8">
        <div className="bg-[var(--color-surface)] p-1 rounded-lg inline-flex items-center border border-[var(--color-border)] shadow-sm">
          <button
            type="button"
            className={cn(
              "px-4 py-1.5 text-[13.5px] font-semibold rounded-md transition-colors",
              billingInterval === "monthly"
                ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            )}
            onClick={() => setBillingInterval("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "px-4 py-1.5 text-[13.5px] font-semibold rounded-md transition-colors flex items-center gap-1.5",
              billingInterval === "annual"
                ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            )}
            onClick={() => setBillingInterval("annual")}
          >
            Annual
            <span className={cn(
              "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded",
              billingInterval === "annual" ? "bg-[var(--color-canvas)] text-[var(--color-ink)]" : "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]"
            )}>
              Get 2 Mo Free
            </span>
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {options.map(({ plan, featured, ribbon, tagline, priceNote, highlights, action }) => {
          const isCurrent = plan.code === currentPlanCode;
          const isPending = plan.code === pendingPlanCode;
          const locked = action.disabled && !isPending;

          return (
            <div
              key={plan.code}
              className={cn(
                "relative flex flex-col rounded-xl border p-5 transition-shadow h-full",
                featured
                  ? "border-[var(--color-teal)] bg-[var(--color-surface)] shadow-[0_0_0_1px_var(--color-teal),0_14px_32px_-22px_rgba(14,165,183,0.75)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]",
                locked && "opacity-70",
              )}
            >
              {ribbon && (
                <span className="absolute -top-2.5 left-5 inline-flex items-center rounded-full bg-[var(--color-ink-solid)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[var(--color-ink-solid-text)] shadow-sm">
                  {ribbon}
                </span>
              )}

              <div className="flex min-h-[22px] items-center justify-between gap-2">
                <span className="text-[15px] font-extrabold tracking-tight text-[var(--color-ink)] flex items-center gap-1.5">
                  {plan.name}
                  {featured && <Zap size={14} className="text-[var(--color-teal)] fill-[var(--color-teal)]" />}
                </span>
                {isCurrent && billingInterval === "monthly" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-mint-bg)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--color-mint-text)]">
                    <Check size={11} strokeWidth={3} />
                    Current plan
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-[var(--color-muted)]">{tagline}</p>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-[34px] leading-none font-extrabold tracking-tight text-[var(--color-ink)] tabular-nums">
                  {formatPriceINR(plan.pricePaise)}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] text-[var(--color-muted)]">{priceNote}</p>
              
              {billingInterval === "annual" && (
                <div className="mt-2 text-[13px] font-bold text-[var(--color-mint-text)] bg-[var(--color-mint-bg)] inline-block px-2 py-1 rounded">
                  Pay for 12 months, get 14 months
                </div>
              )}

              <ul className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
                {highlights.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-[var(--color-ink)]">
                    <Check
                      size={15}
                      strokeWidth={2.75}
                      className="mt-px shrink-0 text-[var(--color-teal)]"
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="flex-1" />

              <Button
                variant={featured ? "primary" : "outline"}
                className="mt-5 min-h-11 w-full justify-center text-[13.5px]"
                disabled={phase !== "idle" || action.disabled}
                aria-busy={isPending}
                onClick={() => onSelect(plan.code)}
              >
                {isPending ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    {busyLabel(phase)}
                  </>
                ) : (
                  <>
                    {locked && <Lock size={13} strokeWidth={2.5} />}
                    {action.label}
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
      
      <p className="mt-5 text-center text-[12px] text-[var(--color-muted)]">
        Prices in INR, plus applicable GST. Start with a 15-day free trial on Premium, no credit card required.
      </p>
    </div>
  );
}
