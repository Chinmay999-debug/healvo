export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type SubscriptionInterval = "month" | "year";

export type PlatformInvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible";

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  interval: SubscriptionInterval;
  base_price_paise: number;
  currency: string;
  trial_days: number;
  entitlement_months: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClinicSubscription {
  subscription_id: string;
  clinic_id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  plan_interval: SubscriptionInterval;
  base_price_paise: number;
  currency: string;
  trial_days: number;
  entitlement_months: number;
  status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface PlatformInvoice {
  id: string;
  clinic_id: string;
  subscription_id: string | null;
  invoice_number: string;
  amount_paise: number;
  currency: string;
  tax_amount_paise: number;
  total_amount_paise: number;
  status: PlatformInvoiceStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}
