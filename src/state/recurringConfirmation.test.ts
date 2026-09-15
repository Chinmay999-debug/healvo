import { describe, expect, it, vi } from "vitest";
import {
  RECURRING_CONFIRM_ATTEMPTS,
  RECURRING_CONFIRM_INTERVAL_MS,
  RECURRING_REFRESH_FALLBACK_DELAY_MS,
  confirmRecurringCheckout,
  isAuthorizationPendingError,
  type RecurringConfirmationDeps,
} from "./recurringConfirmation";
import type { RecurringVerifyResult } from "../services/platformBilling";
import type { ClinicSubscription } from "../types/subscription";

const PREVIOUS_END = "2026-09-22T19:17:29.392Z";
const GRANTED_END = "2026-10-15T20:16:22.000Z";

const authorizationPending = () => new Error("Authorization is not complete yet.");

function subscription(overrides: Partial<ClinicSubscription> = {}): ClinicSubscription {
  return {
    subscription_id: "sub-row",
    clinic_id: "clinic",
    plan_id: "plan",
    plan_code: "healvo_dental_monthly",
    plan_name: "Healvo Dental Monthly",
    plan_interval: "month",
    base_price_paise: 49900,
    currency: "INR",
    trial_days: 7,
    entitlement_months: 1,
    status: "trialing",
    trial_started_at: "2026-09-15T19:17:29.392Z",
    trial_ends_at: PREVIOUS_END,
    current_period_started_at: "2026-09-15T19:17:29.392Z",
    current_period_ends_at: PREVIOUS_END,
    cancelled_at: null,
    created_at: "2026-09-15T19:17:29.392Z",
    ...overrides,
  };
}

const charged: RecurringVerifyResult = {
  success: true,
  charged: true,
  auto_renew: true,
  invoice_number: "HLV-SUB-202609-01022",
  current_period_ends_at: GRANTED_END,
};

function makeDeps(overrides: Partial<RecurringConfirmationDeps> = {}) {
  const deps = {
    verify: vi.fn<RecurringConfirmationDeps["verify"]>(async () => {
      throw authorizationPending();
    }),
    getSubscription: vi.fn<RecurringConfirmationDeps["getSubscription"]>(async () => subscription()),
    getBillingState: vi.fn<RecurringConfirmationDeps["getBillingState"]>(async () => null),
    hasAccess: vi.fn<RecurringConfirmationDeps["hasAccess"]>(() => true),
    refresh: vi.fn<RecurringConfirmationDeps["refresh"]>(async () => {}),
    wait: vi.fn<RecurringConfirmationDeps["wait"]>(async () => {}),
  };
  return Object.assign(deps, overrides);
}

describe("confirmRecurringCheckout", () => {
  it("polls for about three minutes", () => {
    expect(RECURRING_CONFIRM_ATTEMPTS * RECURRING_CONFIRM_INTERVAL_MS).toBe(180_000);
  });

  it("finishes immediately when verify succeeds", async () => {
    const deps = makeDeps({ verify: vi.fn(async () => charged) });

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result).toEqual({ kind: "success", invoiceNumber: "HLV-SUB-202609-01022", accessEndsAt: GRANTED_END });
    expect(deps.verify).toHaveBeenCalledTimes(1);
    expect(deps.wait).not.toHaveBeenCalled();
    expect(deps.getSubscription).not.toHaveBeenCalled();
    expect(deps.refresh).toHaveBeenCalledTimes(1);
  });

  it("returns auto-renewal on when verify reports a future first charge", async () => {
    const deps = makeDeps({
      verify: vi.fn(async () => ({ success: true, charged: false, auto_renew: true, starts_at: GRANTED_END })),
    });

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result).toEqual({ kind: "autorenew_on", firstChargeAt: GRANTED_END });
    expect(deps.verify).toHaveBeenCalledTimes(1);
    expect(deps.refresh).toHaveBeenCalledTimes(1);
  });

  it("retries verify on the transient authorization 409 until it succeeds", async () => {
    const verify = vi
      .fn<RecurringConfirmationDeps["verify"]>()
      .mockRejectedValueOnce(authorizationPending())
      .mockRejectedValueOnce(authorizationPending())
      .mockResolvedValueOnce(charged);
    const deps = makeDeps({ verify });

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result.kind).toBe("success");
    expect(verify).toHaveBeenCalledTimes(3);
    expect(deps.wait).toHaveBeenCalledTimes(2);
    expect(deps.wait).toHaveBeenCalledWith(RECURRING_CONFIRM_INTERVAL_MS);
    expect(deps.refresh).toHaveBeenCalledTimes(1);
  });

  it("finishes when the webhook grant appears while verify is still pending", async () => {
    const getSubscription = vi
      .fn<RecurringConfirmationDeps["getSubscription"]>()
      .mockResolvedValueOnce(subscription())
      .mockResolvedValueOnce(subscription())
      .mockResolvedValue(subscription({ status: "active", current_period_ends_at: GRANTED_END }));
    const deps = makeDeps({ getSubscription });

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result).toEqual({ kind: "success", invoiceNumber: null, accessEndsAt: GRANTED_END });
    expect(deps.verify).toHaveBeenCalledTimes(3);
    expect(deps.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not retry verify on a non-transient error and keeps waiting for server state", async () => {
    const deps = makeDeps({
      verify: vi.fn(async () => {
        throw new Error("Invalid payment signature verification");
      }),
    });

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result).toEqual({ kind: "pending" });
    expect(deps.verify).toHaveBeenCalledTimes(1);
    expect(deps.getSubscription).toHaveBeenCalledTimes(RECURRING_CONFIRM_ATTEMPTS + 1);
  });

  it("stops calling verify once it confirms authorization without a charge", async () => {
    const deps = makeDeps({ verify: vi.fn(async () => ({ success: true, charged: false, auto_renew: true })) });

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result).toEqual({ kind: "pending" });
    expect(deps.verify).toHaveBeenCalledTimes(1);
  });

  it("falls back to one delayed refresh when polling times out", async () => {
    const deps = makeDeps();

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result).toEqual({ kind: "pending" });
    expect(deps.verify).toHaveBeenCalledTimes(RECURRING_CONFIRM_ATTEMPTS);
    expect(deps.wait).toHaveBeenCalledTimes(RECURRING_CONFIRM_ATTEMPTS);
    expect(deps.wait).toHaveBeenLastCalledWith(RECURRING_REFRESH_FALLBACK_DELAY_MS);
    expect(deps.refresh).toHaveBeenCalledTimes(1);
    // The refresh happens only after the full polling window.
    expect(deps.refresh.mock.invocationCallOrder[0]).toBeGreaterThan(deps.wait.mock.invocationCallOrder.at(-1)!);
  });

  it("reports success if the grant is visible right after the fallback refresh", async () => {
    let reads = 0;
    const deps = makeDeps({
      getSubscription: vi.fn(async () => {
        reads += 1;
        return reads > RECURRING_CONFIRM_ATTEMPTS
          ? subscription({ status: "active", current_period_ends_at: GRANTED_END })
          : subscription();
      }),
    });

    const result = await confirmRecurringCheckout(deps, PREVIOUS_END);

    expect(result).toEqual({ kind: "success", invoiceNumber: null, accessEndsAt: GRANTED_END });
    expect(deps.refresh).toHaveBeenCalledTimes(1);
  });

  it("never treats a state read failure as a grant", async () => {
    const deps = makeDeps({
      getSubscription: vi.fn(async () => {
        throw new Error("network");
      }),
      getBillingState: vi.fn(async () => {
        throw new Error("network");
      }),
    });

    await expect(confirmRecurringCheckout(deps, PREVIOUS_END)).resolves.toEqual({ kind: "pending" });
  });
});

describe("isAuthorizationPendingError", () => {
  it("matches only verify's transient authorization message", () => {
    expect(isAuthorizationPendingError(new Error("Authorization is not complete yet."))).toBe(true);
    expect(isAuthorizationPendingError(new Error("Authorization is not complete yet"))).toBe(true);
    expect(isAuthorizationPendingError(new Error("No subscription checkout is waiting for confirmation."))).toBe(false);
    expect(isAuthorizationPendingError(new Error("We couldn't confirm your payment yet."))).toBe(false);
    expect(isAuthorizationPendingError("Authorization is not complete yet.")).toBe(false);
  });
});
