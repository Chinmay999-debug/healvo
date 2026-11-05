import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hmacSha256Hex, runCreateCheckout, runVerifyPayment } from "./subscriptionHandler";

const db = vi.hoisted(() => ({
  quote: {} as Record<string, unknown>,
  order: null as Record<string, unknown> | null,
  inserted: [] as Record<string, unknown>[],
  confirm: [] as Record<string, unknown>[],
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "o@clinic.test" } }, error: null }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "is_clinic_member") return { data: true, error: null };
      if (fn === "billing_checkout_context") return { data: { recurring_enabled: false, recurring_pilot: false }, error: null };
      if (fn === "billing_checkout_quote") return { data: db.quote, error: null };
      if (fn === "confirm_subscription_payment") {
        db.confirm.push(args);
        return { data: { success: true }, error: null };
      }
      return { data: null, error: { message: `unmocked ${fn}` } };
    },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({
          data: { id: "plan-1", code: "core_annual", name: "Core Annual", interval: "year", base_price_paise: 598800, currency: "INR", entitlement_months: 12, billing_mode: "one_time" },
          error: null,
        }),
        maybeSingle: async () => ({ data: db.order, error: null }),
        insert: async (row: Record<string, unknown>) => {
          db.inserted.push({ table, ...row });
          return { error: null };
        },
      };
      return chain;
    },
  }),
}));

const ENV = {
  VITE_SUPABASE_URL: "http://db.test",
  VITE_SUPABASE_PUBLISHABLE_KEY: "pub",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
  RAZORPAY_KEY_ID: "rzp_test_Fallback",
  RAZORPAY_KEY_SECRET: "secret",
};

const quote = (over: Record<string, unknown> = {}) => ({
  reference_paise: 1197600,
  discount_paise: 598800,
  taxable_paise: 598800,
  gst_rate_bps: 0,
  gst_paise: 0,
  payable_paise: 598800,
  access_months: 14,
  coupon_code: "NEWUSER50",
  coupon_status: "applied",
  coupon_message: "Launch code applied.",
  ...over,
});

describe("Vercel fallback checkout uses the server quote", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    db.quote = quote();
    db.order = null;
    db.inserted = [];
    db.confirm = [];
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("charges the quoted amount and records the snapshot", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "order_1", amount: 598800 })));
    const res = await runCreateCheckout(ENV, "Bearer t", { clinicId: "c1", planCode: "core_annual", couponCode: "newuser50" });
    expect(res.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).amount).toBe(598800);
    expect(db.inserted[0]).toMatchObject({ amount_paise: 598800, coupon_code: "NEWUSER50", key_mode: "test", reference_amount_paise: 1197600 });
  });

  it("stops on a rejected code before reaching Razorpay", async () => {
    db.quote = quote({ coupon_status: "invalid", coupon_message: "That code isn't valid." });
    const res = await runCreateCheckout(ENV, "Bearer t", { clinicId: "c1", planCode: "core_annual", couponCode: "NOPE" });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "That code isn't valid." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses more than one code", async () => {
    const res = await runCreateCheckout(ENV, "Bearer t", { clinicId: "c1", planCode: "core_annual", couponCode: ["A", "B"] });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies against the order amount, not the plan's launch price", async () => {
    db.order = { clinic_id: "c1", amount_paise: 1197600, currency: "INR" };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "pay_1", order_id: "order_1", amount: 1197600, currency: "INR", status: "captured" })),
    );
    const res = await runVerifyPayment(ENV, "Bearer t", {
      clinicId: "c1",
      planCode: "core_annual",
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: hmacSha256Hex("secret", "order_1|pay_1"),
    });
    expect(res.status).toBe(200);
    expect(db.confirm[0]).toMatchObject({ p_amount_paise: 1197600, p_key_mode: "test" });
  });

  it("refuses an order belonging to another clinic", async () => {
    db.order = { clinic_id: "other", amount_paise: 598800, currency: "INR" };
    const res = await runVerifyPayment(ENV, "Bearer t", {
      clinicId: "c1",
      planCode: "core_annual",
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: hmacSha256Hex("secret", "order_1|pay_1"),
    });
    expect(res.status).toBe(400);
    expect(db.confirm).toHaveLength(0);
  });
});
