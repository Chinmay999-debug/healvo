import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
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

  const monthlyChoice = monthlyAction();

  const options = [
    {
      plan: monthly,
      badge: null as string | null,
      lines: recurringMonthly
        ? ["Renews automatically", "Cancel anytime"]
        : [monthsOfAccess(monthly.accessMonths)],
      action: monthlyChoice,
    },
    {
      plan: annual,
      badge: "2 months free",
      lines: recurringMonthly
        ? [monthsOfAccess(annual.accessMonths), "One-time payment", "No automatic renewal"]
        : [monthsOfAccess(annual.accessMonths), "Pay for 12 and get 2 free"],
      action: { label: annualLabel(), disabled: false } as { label: string; disabled: boolean; note?: string },
    },
  ];

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ plan, badge, lines, action }) => {
          const isCurrent = plan.code === currentPlanCode;
          const isPending = plan.code === pendingPlanCode;

          return (
            <div key={plan.code} className="flex flex-col rounded-lg border border-[var(--color-border)] p-4">
              <div className="flex min-h-[22px] flex-wrap items-center justify-between gap-2">
                <span className="text-[13.5px] font-bold text-[var(--color-ink)]">{plan.name}</span>
                <span className="flex items-center gap-2">
                  {isCurrent && (
                    <span className="text-[12px] font-semibold text-[var(--color-muted)]">Current plan</span>
                  )}
                  {badge && <Badge tone="mint">{badge}</Badge>}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-[22px] font-bold text-[var(--color-ink)] tabular-nums">
                  {formatPriceINR(plan.pricePaise)}
                </span>
                <span className="text-[13px] text-[var(--color-muted)]">/ {plan.periodLabel} + GST</span>
              </div>

              <div className="mt-1 flex-1 space-y-0.5 text-[13px] text-[var(--color-muted)]">
                {lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              <Button
                variant={plan.code === ANNUAL_PLAN_CODE ? "primary" : "outline"}
                className="mt-4 min-h-11 w-full justify-center"
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
                  action.label
                )}
              </Button>
              {action.note && (
                <p className="mt-2 text-center text-[12px] text-[var(--color-muted)]">{action.note}</p>
              )}
            </div>
          );
        })}
      </div>

      {!recurringMonthly && (
        <p className="mt-3 text-[12.5px] text-[var(--color-muted)]">No automatic renewal. Every payment is one-time.</p>
      )}
    </div>
  );
}
