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
  /** Launch price, before GST. */
  base_price_paise: number;
  /** Standard price, before GST. What a clinic without launch pricing pays. */
  reference_price_paise: number | null;
  currency: string;
  trial_days: number;
  /** Paid months; any bonus months are decided per payment. */
  entitlement_months: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type CouponStatus =
  | "none"
  | "applied"
  | "invalid"
  | "expired"
  | "already_used"
  | "ineligible"
  | "not_needed";

/** The server's price for one plan and this clinic. The UI only displays it. */
export interface CheckoutQuote {
  plan_code: string;
  plan_name: string;
  interval: SubscriptionInterval;
  billing_mode: "one_time" | "recurring";
  currency: string;
  reference_paise: number;
  launch_paise: number;
  discount_paise: number;
  taxable_paise: number;
  gst_rate_bps: number;
  gst_paise: number;
  payable_paise: number;
  price_basis: "coupon" | "locked" | "list";
  price_tier: "launch" | "list";
  paid_months: number;
  bonus_months: number;
  access_months: number;
  coupon_code: string | null;
  coupon_status: CouponStatus;
  coupon_message: string | null;
}

export interface FoundingOffer {
  slot_limit: number;
  bonus_months: number;
  claimed: number;
  remaining: number;
  available: boolean;
}

export interface CheckoutQuotes {
  quotes: CheckoutQuote[];
  offer: FoundingOffer;
  /** What this clinic currently pays per purchase, if it has paid. */
  current_amount_paise: number | null;
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

/**
 * A no-charge plan grant (not a subscription): the clinic gets the plan's
 * features and app access without any payment. Only active grants are returned.
 */
export interface ClinicComplimentaryAccess {
  plan_code: string;
  plan_name: string;
  starts_at: string;
  /** null = no end date. */
  expires_at: string | null;
}

export type GatewaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

/** Server-computed billing state from get_clinic_billing_state. */
export interface ClinicBillingState {
  clinic_id: string;
  plan_code: string | null;
  billing_mode: "one_time" | "recurring" | null;
  subscription_status: SubscriptionStatus | null;
  paid_through: string | null;
  recurring_monthly_available: boolean;
  auto_renew: boolean;
  gateway_status: GatewaySubscriptionStatus | null;
  cancel_at_cycle_end: boolean;
  payment_method: "upi" | "card" | null;
  next_charge_at: string | null;
  gateway_start_at: string | null;
  gateway_current_end: string | null;
  needs_reauthorization: boolean;
  grace_ends_at: string | null;
  in_grace: boolean;
  annual_to_monthly_eligible: boolean;
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
