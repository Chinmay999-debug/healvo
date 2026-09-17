import { useEffect, useState } from "react";
import { Check, LoaderCircle, Lock, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { formatPriceINR, getActiveSubscriptionPlans } from "../../services/subscription";
import type { CheckoutPhase } from "../../state/useSubscriptionCheckout";

export const MONTHLY_PLAN_CODE = "healvo_dental_monthly";
export const ANNUAL_PLAN_CODE = "healvo_dental_annual";

interface PlanDisplay {
  code: string;
  name: string;
  pricePaise: number;
  periodLabel: string;
  accessMonths: number;
}

// Locked commercial terms, shown until the live catalog loads. What is actually
// charged always comes from subscription_plans on the server.
const DEFAULT_PLANS: Record<string, PlanDisplay> = {
  [MONTHLY_PLAN_CODE]: {
    code: MONTHLY_PLAN_CODE,
    name: "Monthly",
    pricePaise: 49900,
    periodLabel: "month",
    accessMonths: 1,
  },
  [ANNUAL_PLAN_CODE]: {
    code: ANNUAL_PLAN_CODE,
    name: "Annual",
    pricePaise: 598800,
    periodLabel: "year",
    accessMonths: 14,
  },
};

// One product, one feature set — the plans differ only in how you pay. Kept in
// step with the pricing section on the marketing site.
const INCLUDED = [
  "FDI dental chart, status and notes per tooth",
  "Consultations with prescriptions",
  "Billing: UPI, cash, card, part payments",
  "Online booking page for patients",
  "Healvo AI clinic assistant",
  "Documents, X-rays and photos",
  "Doctor and reception logins",
  "Reports and follow-ups",
];

function usePlanCatalog() {
  const [plans, setPlans] = useState(DEFAULT_PLANS);

  useEffect(() => {
    let cancelled = false;
    getActiveSubscriptionPlans()
      .then((rows) => {
        if (cancelled) return;
        setPlans((current) => {
          const next = { ...current };
          for (const row of rows) {
            if (next[row.code]) {
              next[row.code] = {
                ...next[row.code],
                pricePaise: row.base_price_paise,
                accessMonths: row.entitlement_months,
              };
            }
          }
          return next;
        });
      })
      .catch(() => {
        // Keep the locked defaults; checkout still prices from the server.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return plans;
}

function busyLabel(phase: CheckoutPhase) {
  if (phase === "confirming") return "Confirming payment…";
  if (phase === "paying") return "Waiting for payment…";
  return "Opening checkout…";
}

const monthsOfAccess = (months: number) => `${months} month${months === 1 ? "" : "s"} of access`;

export interface PlanPickerProps {
  /** "choose" for a first purchase, "renew" once the clinic has paid before. */
  mode: "choose" | "renew";
  /** The plan the clinic is currently paying for, if any. */
  currentPlanCode?: string | null;
  phase: CheckoutPhase;
  pendingPlanCode: string | null;
  onSelect: (planCode: string) => void;
  /** Monthly is sold as an automatically renewing subscription. */
  recurringMonthly?: boolean;
  /** The clinic still has paid access (monthly then turns on auto-renewal). */
  hasPaidTime?: boolean;
  /** Monthly auto-renewal is already on. */
  autoRenewOn?: boolean;
  /** Annual holder outside the final 30 days: monthly is not offered yet. */
  monthlyLocked?: boolean;
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
  monthlyLocked = false,
}: PlanPickerProps) {
  const plans = usePlanCatalog();
  const monthly = plans[MONTHLY_PLAN_CODE];
  const annual = plans[ANNUAL_PLAN_CODE];

  const monthlyAction = (): { label: string; disabled: boolean; note?: string } => {
    if (!recurringMonthly) return { label: `${mode === "choose" ? "Choose" : "Renew"} monthly`, disabled: false };
    if (autoRenewOn) return { label: "Auto-renewal is on", disabled: true };
    if (monthlyLocked) {
      return {
        label: "Turn on auto-renewal",
        disabled: true,
        note: "Available in the last 30 days of your annual plan.",
      };
    }
    return { label: hasPaidTime ? "Turn on auto-renewal" : "Start monthly plan", disabled: false };
  };

  const annualLabel = () => {
    if (currentPlanCode === MONTHLY_PLAN_CODE) return "Switch to annual";
    return `${mode === "choose" ? "Choose" : "Renew"} annual`;
  };

  // Both figures come from the live catalog, so they stay honest if pricing moves.
  const perMonthPaise = Math.round(annual.pricePaise / Math.max(1, annual.accessMonths));
  const savingsPaise = monthly.pricePaise * annual.accessMonths - annual.pricePaise;

  const options = [
    {
      plan: monthly,
      featured: false,
      ribbon: null as string | null,
      tagline: recurringMonthly ? "Pay as you go, month by month" : "Try Healvo month by month",
      priceNote: recurringMonthly ? "Charged automatically every month" : "One payment, no auto-renewal",
      highlights: recurringMonthly
        ? ["7-day free trial · no card required", "Renews automatically each month"]
        : [monthsOfAccess(monthly.accessMonths), "Renew whenever you're ready"],
      action: monthlyAction(),
    },
    {
      plan: annual,
      featured: true,
      ribbon: savingsPaise > 0 ? `Save ${formatPriceINR(savingsPaise)}` : "Best value",
      tagline: "The whole year sorted, in one payment",
      priceNote: `About ${formatPriceINR(perMonthPaise)} a month`,
      highlights: [
        `${monthsOfAccess(annual.accessMonths)} — pay for 12, get 2 free`,
        "One payment, nothing renews on its own",
      ],
      action: { label: annualLabel(), disabled: false } as { label: string; disabled: boolean; note?: string },
    },
  ];

  return (
    <div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {options.map(({ plan, featured, ribbon, tagline, priceNote, highlights, action }) => {
          const isCurrent = plan.code === currentPlanCode;
          const isPending = plan.code === pendingPlanCode;
          const locked = action.disabled && !isPending;

          return (
            <div
              key={plan.code}
              className={cn(
                "relative flex flex-col rounded-xl border p-5 transition-shadow",
                featured
                  ? "border-[var(--color-teal)] bg-[var(--color-surface)] shadow-[0_0_0_1px_var(--color-teal),0_14px_32px_-22px_rgba(14,165,183,0.75)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]",
                locked && "opacity-70",
              )}
            >
              {ribbon && (
                <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-[var(--color-ink-solid)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[var(--color-ink-solid-text)] shadow-sm">
                  <Sparkles size={11} strokeWidth={2.5} />
                  {ribbon}
                </span>
              )}

              <div className="flex min-h-[22px] items-center justify-between gap-2">
                <span className="text-[15px] font-extrabold tracking-tight text-[var(--color-ink)]">
                  {plan.name}
                </span>
                {isCurrent && (
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
                <span className="text-[13.5px] font-semibold text-[var(--color-muted)]">
                  / {plan.periodLabel}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] text-[var(--color-muted)]">{priceNote}</p>

              <ul className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
                {highlights.map((line) => (
                  <li key={line} className="flex gap-2.5 text-[13px] leading-snug text-[var(--color-ink)]">
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
              {action.note && (
                <p className="mt-2 text-center text-[12px] text-[var(--color-muted)]">{action.note}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4 sm:p-5">
        <p className="text-[11px] font-bold tracking-[0.12em] text-[var(--color-muted)] uppercase">
          Included in every plan
        </p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 text-[13px] leading-snug text-[var(--color-ink)]"
            >
              <Check size={15} strokeWidth={2.75} className="mt-px shrink-0 text-[var(--color-teal)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] text-[var(--color-muted)]">
          Prices in INR, plus applicable GST. No feature tiers and nothing to unlock later.
        </p>
      </div>
    </div>
  );
}
