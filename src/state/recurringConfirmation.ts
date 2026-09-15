import type { RecurringVerifyResult } from "../services/platformBilling";
import type { ClinicBillingState, ClinicSubscription } from "../types/subscription";

/**
 * Confirms a recurring (Razorpay Subscription) checkout after Razorpay's
 * Checkout callback. It never grants anything itself: it only asks the server
 * to verify, and reads state that verify or the webhook has already written.
 *
 * Razorpay can call back before the subscription is authenticated, in which
 * case verify answers "Authorization is not complete yet" (HTTP 409). That is
 * transient, so verify is retried while server state is watched in case the
 * webhook settles the charge first.
 */

export const RECURRING_CONFIRM_ATTEMPTS = 36;
export const RECURRING_CONFIRM_INTERVAL_MS = 5000;
export const RECURRING_REFRESH_FALLBACK_DELAY_MS = 5000;

const AUTHORIZATION_PENDING_MESSAGE = "authorization is not complete yet";

/** True only for verify's transient "subscription not yet authorized" response. */
export function isAuthorizationPendingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.trim().replace(/\.+$/, "").toLowerCase() === AUTHORIZATION_PENDING_MESSAGE;
}

export type RecurringConfirmationResult =
  | { kind: "success"; invoiceNumber: string | null; accessEndsAt: string | null }
  | { kind: "autorenew_on"; firstChargeAt: string | null }
  | { kind: "pending" };

export interface RecurringConfirmationDeps {
  verify: () => Promise<RecurringVerifyResult>;
  getSubscription: () => Promise<ClinicSubscription | null>;
  getBillingState: () => Promise<ClinicBillingState | null>;
  hasAccess: (subscription: ClinicSubscription) => boolean;
  refresh: () => Promise<void>;
  wait: (ms: number) => Promise<void>;
}

/** What the server already shows for this checkout, or null if nothing yet. */
async function readSettledState(
  deps: RecurringConfirmationDeps,
  previousEnd: string | null,
): Promise<RecurringConfirmationResult | null> {
  const latest = await deps.getSubscription().catch(() => null);
  if (
    latest &&
    latest.current_period_ends_at !== previousEnd &&
    latest.status === "active" &&
    deps.hasAccess(latest)
  ) {
    return { kind: "success", invoiceNumber: null, accessEndsAt: latest.current_period_ends_at };
  }

  const state = await deps.getBillingState().catch(() => null);
  if (state?.auto_renew && state.gateway_status === "authenticated" && state.gateway_start_at) {
    return { kind: "autorenew_on", firstChargeAt: state.gateway_start_at };
  }

  return null;
}

export async function confirmRecurringCheckout(
  deps: RecurringConfirmationDeps,
  previousEnd: string | null,
): Promise<RecurringConfirmationResult> {
  // Verify is called again only while it reports the transient authorization state.
  let retryVerify = true;

  for (let attempt = 0; attempt < RECURRING_CONFIRM_ATTEMPTS; attempt++) {
    if (attempt > 0) await deps.wait(RECURRING_CONFIRM_INTERVAL_MS);

    if (retryVerify) {
      try {
        const result = await deps.verify();

        if (result.charged) {
          await deps.refresh();
          return {
            kind: "success",
            invoiceNumber: result.invoice_number ?? null,
            accessEndsAt: result.current_period_ends_at ?? null,
          };
        }

        // Paid time remains: the mandate is set and the first charge is later.
        if (result.starts_at) {
          await deps.refresh();
          return { kind: "autorenew_on", firstChargeAt: result.starts_at };
        }

        // Authorized, but the first charge is still being finalised; the webhook settles it.
        retryVerify = false;
      } catch (err) {
        // Any other verify error keeps the existing behaviour: stop calling
        // verify and wait for server state instead.
        retryVerify = isAuthorizationPendingError(err);
      }
    }

    const settled = await readSettledState(deps, previousEnd);
    if (settled) {
      await deps.refresh();
      return settled;
    }
  }

  // Still unconfirmed: refresh once so a webhook grant that lands just after the
  // window reaches the page (and lifts the access gate) without a manual reload.
  await deps.wait(RECURRING_REFRESH_FALLBACK_DELAY_MS);
  await deps.refresh();
  return (await readSettledState(deps, previousEnd)) ?? { kind: "pending" };
}
