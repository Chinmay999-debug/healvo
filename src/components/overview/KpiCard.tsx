import {
  Wallet,
  UsersRound,
  Clock,
  UserRoundPlus,
  ReceiptText,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Card } from "../ui/Card";
import { cn } from "../../lib/utils";

export type KpiIcon =
  | "wallet"
  | "users-round"
  | "clock"
  | "user-round-plus"
  | "receipt"
  | "check-circle";
export type KpiTone = "mint" | "blue" | "amber" | "slate";

/**
 * The one page-level KPI treatment in Healvo — used for the metric row at
 * the top of Overview and Billing. For a smaller, embedded stat (a patient
 * header, an invoice total, a payment modal) use the "detail stat" scale
 * instead: a 21px value with an uppercase muted label, no icon, no card.
 */
export interface Kpi {
  id: string;
  label: string;
  value: string;
  /** Supporting context — only shown when derived from real data, never a
   * fabricated trend. Omit when there's nothing true to say. */
  trend?: string;
  trendPositive?: boolean | null;
  /** Omit for a KPI where an icon wouldn't add scannable meaning — the
   * label still carries the full weight of the card. */
  icon?: KpiIcon;
  tone: KpiTone;
}

const iconMap: Record<KpiIcon, LucideIcon> = {
  wallet: Wallet,
  "users-round": UsersRound,
  clock: Clock,
  "user-round-plus": UserRoundPlus,
  receipt: ReceiptText,
  "check-circle": CheckCircle2,
};

const toneMap: Record<KpiTone, string> = {
  mint: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  blue: "bg-[var(--color-blue-bg)] text-[var(--color-blue-text)]",
  amber: "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]",
  slate: "bg-[var(--color-slate-bg)] text-[var(--color-slate-text)]",
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon ? iconMap[kpi.icon] : null;

  return (
    <Card className="p-5">
      {Icon && (
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            toneMap[kpi.tone],
          )}
        >
          <Icon size={18} strokeWidth={2} />
        </div>
      )}
      <div className={cn("text-[13px] text-[var(--color-muted)]", Icon ? "mt-3" : "mt-0")}>
        {kpi.label}
      </div>
      <div className="mt-1 text-[26px] font-extrabold tracking-tight text-[var(--color-ink)]">
        {kpi.value}
      </div>
      {kpi.trend && (
        <div
          className={cn(
            "mt-1 text-[12.5px]",
            kpi.trendPositive === true
              ? "text-[var(--color-mint-text)]"
              : "text-[var(--color-muted)]",
          )}
        >
          {kpi.trend}
        </div>
      )}
    </Card>
  );
}
