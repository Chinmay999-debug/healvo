import { describe, it, expect, vi } from "vitest";

// platformBilling imports the Supabase client, which can't be constructed
// under Node 20 (no WebSocket). The routing functions under test never use it.
vi.mock("../lib/supabaseClient", () => ({ supabase: {} }));

import { RECURRING_PLAN_CODES, checkoutRouteFor, isRecurringPlanCode } from "./platformBilling";

describe("checkout routing", () => {
  it("routes Core Monthly to a recurring subscription", () => {
    expect(checkoutRouteFor("core", true)).toBe("recurring");
  });

  it("routes Premium Monthly to a recurring subscription", () => {
    expect(checkoutRouteFor("premium", true)).toBe("recurring");
  });

  it("routes Core Annual to a one-time order", () => {
    expect(checkoutRouteFor("core_annual", true)).toBe("one_time");
    expect(checkoutRouteFor("core_annual", false)).toBe("one_time");
  });

  it("routes Premium Annual to a one-time order", () => {
    expect(checkoutRouteFor("premium_annual", true)).toBe("one_time");
    expect(checkoutRouteFor("premium_annual", false)).toBe("one_time");
  });

  it("falls back to a one-time order for monthly when the clinic has no recurring billing", () => {
    expect(checkoutRouteFor("core", false)).toBe("one_time");
    expect(checkoutRouteFor("premium", false)).toBe("one_time");
  });

  it("never treats the legacy healvo_dental_monthly plan as a recurring checkout", () => {
    expect(isRecurringPlanCode("healvo_dental_monthly")).toBe(false);
    expect(checkoutRouteFor("healvo_dental_monthly", true)).toBe("one_time");
    expect(RECURRING_PLAN_CODES).not.toContain("healvo_dental_monthly");
  });

  it("never opens an annual Razorpay subscription", () => {
    for (const code of ["core_annual", "premium_annual", "healvo_dental_annual"]) {
      expect(isRecurringPlanCode(code)).toBe(false);
    }
    expect(RECURRING_PLAN_CODES.some((code) => code.includes("annual"))).toBe(false);
  });

  it("recurring plans are exactly Core and Premium monthly", () => {
    expect([...RECURRING_PLAN_CODES].sort()).toEqual(["core", "premium"]);
  });
});
