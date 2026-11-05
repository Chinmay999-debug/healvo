import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "jwt" } } }) },
    functions: { invoke },
  },
}));

import { createSubscriptionCheckout, verifySubscriptionPayment } from "./subscription";

const rejected = (status: number, body: unknown) => ({
  data: null,
  error: { context: new Response(JSON.stringify(body), { status }) },
});
const verifyParams = {
  clinicId: "c1",
  planCode: "core",
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: "sig",
};

describe("checkout errors from the Edge Function", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    invoke.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the server's reason and does not try the fallback", async () => {
    invoke.mockResolvedValue(rejected(422, { error: "That code has expired." }));
    await expect(createSubscriptionCheckout("c1", "core", "OLD")).rejects.toThrow("That code has expired.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a conflict message the same way", async () => {
    invoke.mockResolvedValue(rejected(409, { error: "Monthly is billed as an automatic subscription." }));
    await expect(createSubscriptionCheckout("c1", "core")).rejects.toThrow("Monthly is billed as an automatic subscription.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a successful checkout without touching the fallback", async () => {
    invoke.mockResolvedValue({ data: { orderId: "order_1", amount: 49900 }, error: null });
    await expect(createSubscriptionCheckout("c1", "core", "NEWUSER50")).resolves.toMatchObject({ orderId: "order_1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the code to the server", async () => {
    invoke.mockResolvedValue({ data: { orderId: "order_1" }, error: null });
    await createSubscriptionCheckout("c1", "core", "NEWUSER50");
    expect(invoke.mock.calls[0][1].body).toEqual({ clinicId: "c1", planCode: "core", couponCode: "NEWUSER50" });
  });

  it("uses the fallback when the function can't be reached", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Error("network") } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ orderId: "order_2" })));
    await expect(createSubscriptionCheckout("c1", "core")).resolves.toMatchObject({ orderId: "order_2" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/subscription/checkout");
  });

  it("uses the fallback when invoke itself throws", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ orderId: "order_3" })));
    await expect(createSubscriptionCheckout("c1", "core")).resolves.toMatchObject({ orderId: "order_3" });
  });

  it("uses the fallback for a gateway failure with no readable reason", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response("<html>bad gateway</html>", { status: 502 }) } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ orderId: "order_4" })));
    await expect(createSubscriptionCheckout("c1", "core")).resolves.toMatchObject({ orderId: "order_4" });
  });

  it("surfaces a verification rejection without the fallback", async () => {
    invoke.mockResolvedValue(rejected(400, { error: "Payment details do not match this order." }));
    await expect(verifySubscriptionPayment(verifyParams)).rejects.toThrow("Payment details do not match this order.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still verifies through the fallback when the function can't be reached", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await expect(verifySubscriptionPayment(verifyParams)).resolves.toMatchObject({ success: true });
  });
});
