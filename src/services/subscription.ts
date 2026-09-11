import { supabase } from "../lib/supabaseClient";
import type {
  ClinicSubscription,
  SubscriptionPlan,
  PlatformInvoice,
} from "../types/subscription";

/**
 * Centrally evaluates whether a clinic currently has active subscription
 * or ongoing trial access to the Healvo platform.
 */
export function hasSubscriptionAccess(
  subscription: ClinicSubscription | null,
  asOf: Date = new Date(),
): boolean {
  if (!subscription) return false;

  const nowMs = asOf.getTime();

  switch (subscription.status) {
    case "active":
      // Active paid plan: valid if no end date set or end date is in the future
      if (!subscription.current_period_ends_at) return true;
      return new Date(subscription.current_period_ends_at).getTime() > nowMs;

    case "trialing":
      // Trial: valid strictly until trial_ends_at
      if (!subscription.trial_ends_at) return false;
      return new Date(subscription.trial_ends_at).getTime() > nowMs;

    case "past_due":
      // Past due: grace period valid through current_period_ends_at
      if (!subscription.current_period_ends_at) return false;
      return new Date(subscription.current_period_ends_at).getTime() > nowMs;

    case "cancelled":
      // Cancelled: retain access until end of prepaid period
      if (!subscription.current_period_ends_at) return false;
      return new Date(subscription.current_period_ends_at).getTime() > nowMs;

    case "expired":
    default:
      return false;
  }
}

/**
 * Returns true if the clinic is currently within its 7-day free trial.
 */
export function isTrialing(
  subscription: ClinicSubscription | null,
  asOf: Date = new Date(),
): boolean {
  if (!subscription || subscription.status !== "trialing") return false;
  if (!subscription.trial_ends_at) return false;
  return new Date(subscription.trial_ends_at).getTime() > asOf.getTime();
}

/**
 * Returns true if the clinic's trial period has elapsed and has not converted.
 */
export function isTrialExpired(
  subscription: ClinicSubscription | null,
  asOf: Date = new Date(),
): boolean {
  if (!subscription) return false;
  if (subscription.status === "expired") return true;
  if (subscription.status === "trialing" && subscription.trial_ends_at) {
    return new Date(subscription.trial_ends_at).getTime() <= asOf.getTime();
  }
  return false;
}

/**
 * Returns true if the clinic has an active paid subscription.
 */
export function isActiveSubscribed(
  subscription: ClinicSubscription | null,
  asOf: Date = new Date(),
): boolean {
  if (!subscription || subscription.status !== "active") return false;
  if (!subscription.current_period_ends_at) return true;
  return new Date(subscription.current_period_ends_at).getTime() > asOf.getTime();
}

/**
 * Returns the active plan code and name, or null.
 */
export function getActivePlan(
  subscription: ClinicSubscription | null,
): { code: string; name: string; interval: string } | null {
  if (!subscription) return null;
  return {
    code: subscription.plan_code,
    name: subscription.plan_name,
    interval: subscription.plan_interval,
  };
}

/**
 * Resolves the timestamp when current subscription access concludes.
 */
export function getAccessEndsAt(
  subscription: ClinicSubscription | null,
): Date | null {
  if (!subscription) return null;
  if (subscription.status === "trialing" && subscription.trial_ends_at) {
    return new Date(subscription.trial_ends_at);
  }
  if (subscription.current_period_ends_at) {
    return new Date(subscription.current_period_ends_at);
  }
  return null;
}

/**
 * Computes calendar days remaining until access expiry. Minimum 0.
 */
export function getDaysRemaining(
  subscription: ClinicSubscription | null,
  asOf: Date = new Date(),
): number {
  const endsAt = getAccessEndsAt(subscription);
  if (!endsAt) return 0;
  const diffMs = endsAt.getTime() - asOf.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats base monetary amount in paise to Indian Rupees display (e.g. 49900 -> ₹499).
 */
export function formatPriceINR(paise: number): string {
  const rupees = Math.floor(paise / 100);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// Data Access RPCs ------------------------------------------------------------

/**
 * Fetches the current subscription for a clinic using the authorized RLS/RPC layer.
 */
export async function getClinicSubscription(
  clinicId: string,
): Promise<ClinicSubscription | null> {
  const { data, error } = await supabase.rpc("get_clinic_subscription", {
    p_clinic_id: clinicId,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ClinicSubscription[];
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Fetches the active catalog of subscription plans available for purchase.
 */
export async function getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, code, name, interval, base_price_paise, currency, trial_days, entitlement_months, is_active")
    .eq("is_active", true)
    .order("base_price_paise", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as SubscriptionPlan[];
}

/**
 * Fetches past platform invoices for a clinic (SaaS subscription billing only).
 */
export async function getClinicPlatformInvoices(
  clinicId: string,
): Promise<PlatformInvoice[]> {
  const { data, error } = await supabase
    .from("platform_invoices")
    .select("id, clinic_id, subscription_id, invoice_number, amount_paise, currency, tax_amount_paise, total_amount_paise, status, issued_at, due_at, paid_at, created_at")
    .eq("clinic_id", clinicId)
    .order("issued_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as PlatformInvoice[];
}

// Payment Gateway Integration -------------------------------------------------

export interface CheckoutData {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  planName: string;
  planCode: string;
  interval: string;
  entitlementMonths: number;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface ConfirmPaymentResult {
  success: boolean;
  idempotent_replay?: boolean;
  subscription_id: string;
  status: string;
  current_period_ends_at: string;
  invoice_id: string;
  invoice_number: string;
}

/**
 * Loads the Razorpay Checkout.js script dynamically if not already loaded.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Initiates a server-side checkout session for the chosen plan.
 * Calls Supabase Edge Function with fallback to Vercel API.
 */
export async function createSubscriptionCheckout(
  clinicId: string,
  planCode: string,
): Promise<CheckoutData> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error("You must be signed in to initiate checkout.");
  }

  // 1. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke("create-razorpay-checkout", {
      body: { clinicId, planCode },
    });

    if (!error && data && data.orderId) {
      return data as CheckoutData;
    }
  } catch {
    // Edge function not reachable directly, fallback to /api endpoint
  }

  // 2. Fallback to API route (Vercel / Vite dev middleware)
  const res = await fetch("/api/subscription/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ clinicId, planCode }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || "Failed to create checkout session.");
  }

  return (await res.json()) as CheckoutData;
}

/**
 * Submits the Razorpay callback signature to the server for verification
 * and atomic subscription activation.
 */
export async function verifySubscriptionPayment(params: {
  clinicId: string;
  planCode: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<ConfirmPaymentResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error("You must be signed in to verify payment.");
  }

  // 1. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke("verify-razorpay-payment", {
      body: params,
    });

    if (!error && data && data.success) {
      return data as ConfirmPaymentResult;
    }
  } catch {
    // Fallback to API route
  }

  // 2. Fallback to API route
  const res = await fetch("/api/subscription/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || "Payment verification failed.");
  }

  return (await res.json()) as ConfirmPaymentResult;
}

