import { supabase } from "../lib/supabaseClient";

/** Salesperson-facing data. Every call is scoped server-side to auth.uid():
 * there is no salesperson id to pass, so one salesperson cannot ask for
 * another's data (see sales_get_my_dashboard). */

export type ReferralStage =
  | "awaiting_verification"
  | "awaiting_onboarding"
  | "trial"
  | "trial_ended"
  | "no_subscription"
  | "paid"
  | "churned";

export interface SalesMetrics {
  clicks: number;
  unique_visitors: number;
  signups_started: number;
  registrations: number;
  email_verified: number;
  clinics_onboarded: number;
  active_trials: number;
  trials_ended: number;
  paid_clinics: number;
  churned_clinics: number;
  converted_ever: number;
  conversion_rate: number;
  registration_rate: number;
}

export interface SalesReferredClinic {
  clinic_name: string | null;
  doctor_name: string | null;
  registered_at: string;
  clinic_created_at: string | null;
  trial_ends_at: string | null;
  plan_name: string | null;
  stage: ReferralStage;
}

export interface SalesDashboard {
  profile: { full_name: string; email: string; phone: string | null };
  referral_code: string | null;
  link_active: boolean;
  metrics: SalesMetrics;
  clinics: SalesReferredClinic[];
}

export class NotSalespersonError extends Error {}

export async function getMySalesDashboard(): Promise<SalesDashboard> {
  const { data, error } = await supabase.rpc("sales_get_my_dashboard");
  if (error) {
    if (error.code === "42501") throw new NotSalespersonError("This account does not have sales access.");
    throw new Error("Couldn't load your dashboard. Check your connection and try again.");
  }
  return data as SalesDashboard;
}

export const STAGE_LABEL: Record<ReferralStage, string> = {
  awaiting_verification: "Email not verified",
  awaiting_onboarding: "Signed up · setup pending",
  trial: "Free trial",
  trial_ended: "Trial ended",
  no_subscription: "No plan",
  paid: "Paid",
  churned: "Cancelled / expired",
};

export type StageTone = "mint" | "blue" | "amber" | "slate";

export const STAGE_TONE: Record<ReferralStage, StageTone> = {
  awaiting_verification: "slate",
  awaiting_onboarding: "amber",
  trial: "blue",
  trial_ended: "slate",
  no_subscription: "slate",
  paid: "mint",
  churned: "slate",
};
