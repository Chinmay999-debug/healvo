import { supabase } from "../lib/supabaseClient";
import type { ClinicBillingState } from "../types/subscription";
import type { RazorpayCheckoutResponse } from "./subscription";

/**
 * Healvo platform billing for recurring Monthly (Razorpay Subscriptions).
 * Separate from patient billing (services/billing.ts). These calls go only to
 * the Supabase Edge Functions; the Vercel fallback deliberately has no
 * recurring logic. Every decision (plan, amount, subscription, grant) is made
 * server-side.
 */

export async function getClinicBillingState(clinicId: string): Promise<ClinicBillingState | null> {
  const { data, error } = await supabase.rpc("get_clinic_billing_state", { p_clinic_id: clinicId });
  if (error) throw error;
  const rows = (data ?? []) as ClinicBillingState[];
  return rows[0] ?? null;
}

/** Access that the server's 3-day failed-renewal grace still allows. */
export function hasGraceAccess(billing: ClinicBillingState | null, asOf: Date = new Date()): boolean {
  if (!billing?.grace_ends_at) return false;
  return new Date(billing.grace_ends_at).getTime() > asOf.getTime();
}

async function invokeBilling<T>(fn: string, body: Record<string, unknown>, fallbackError: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (!error) return data as T;

  // Surface the server's user-facing message when there is one.
  const context = (error as { context?: Response }).context;
  const payload = context ? await context.json().catch(() => null) : null;
  throw new Error((payload as { error?: string } | null)?.error || fallbackError);
}

export interface RecurringCheckout {
  razorpay_subscription_id: string;
  razorpay_key_id: string;
}

export function createRecurringSubscription(clinicId: string, planCode: string): Promise<RecurringCheckout> {
  return invokeBilling<RecurringCheckout>(
    "create-razorpay-subscription",
    { clinicId, planCode },
    "Couldn't start checkout. Please try again.",
  );
}

export const RECURRING_PLAN_CODE = "healvo_dental_monthly";

export interface RecurringVerifyResult {
  success: boolean;
  charged: boolean;
  auto_renew: boolean;
  current_period_ends_at?: string;
  invoice_number?: string;
  /** Set when the first automatic charge is scheduled for later (paid time remains). */
  starts_at?: string | null;
}

export function verifyRecurringSubscription(
  clinicId: string,
  response: RazorpayCheckoutResponse,
): Promise<RecurringVerifyResult> {
  return invokeBilling<RecurringVerifyResult>(
    "verify-razorpay-subscription",
    {
      clinicId,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_subscription_id: response.razorpay_subscription_id,
      razorpay_signature: response.razorpay_signature,
    },
    "We couldn't confirm your payment yet.",
  );
}

export function cancelAutoRenewal(clinicId: string): Promise<{ success: boolean; access_until: string | null }> {
  return invokeBilling("cancel-razorpay-subscription", { clinicId }, "Couldn't turn off automatic renewal. Please try again.");
}

export function paymentMethodName(method: ClinicBillingState["payment_method"]): string | null {
  if (method === "upi") return "UPI AutoPay";
  if (method === "card") return "Card";
  return null;
}
