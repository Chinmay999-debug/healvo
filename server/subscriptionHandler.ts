import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export interface CheckoutRequest {
  clinicId: string;
  planCode: string;
}

export interface VerifyPaymentRequest {
  clinicId: string;
  planCode: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

type Env = Record<string, string | undefined>;

interface HandlerResult {
  status: number;
  body: unknown;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  interval: string;
  base_price_paise: number;
  currency: string;
  entitlement_months: number;
}

const RAZORPAY_API = "https://api.razorpay.com/v1";
const RAZORPAY_KEY_ID_PATTERN = /^rzp_(live|test)_[A-Za-z0-9]+$/;
// Postgres errors caused by the request's own data fail identically on retry.
const VALIDATION_ERROR_CODES = new Set(["22000", "22023", "P0002"]);
const PERMANENT_ERROR_CODES = new Set([...VALIDATION_ERROR_CODES, "42501"]);
const CHECKOUT_FAILED = "Could not start checkout. Please try again.";
const CONFIRMATION_FAILED =
  "Payment confirmation failed. If you were charged, your access will update automatically.";

const fail = (status: number, error: string): HandlerResult => ({ status, body: { error } });

export function hmacSha256Hex(key: string, message: string): string {
  return crypto.createHmac("sha256", key).update(message).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function readSupabaseEnv(env: Env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  // Deliberately no fallback to the publishable key: order records and payment
  // confirmations are written by service_role or not at all.
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceKey) return null;
  return { url, publishableKey, serviceKey };
}

// Never a placeholder key or a locally generated order id: every checkout is a
// real Razorpay order, and nothing is confirmed without the secret.
function readRazorpayCredentials(env: Env) {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !RAZORPAY_KEY_ID_PATTERN.test(keyId)) return null;
  return {
    keyId,
    keySecret,
    authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
  };
}

async function authorizeMemberForPlan(
  supabaseEnv: { url: string; publishableKey: string },
  authHeader: string,
  clinicId: string,
  planCode: string,
): Promise<{ error: HandlerResult } | { user: { id: string; email?: string }; plan: PlanRow }> {
  const userClient = createClient(supabaseEnv.url, supabaseEnv.publishableKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));

  if (userError || !user) {
    return { error: fail(401, "Unauthorized session") };
  }

  const { data: isMember, error: memberErr } = await userClient.rpc("is_clinic_member", {
    target_clinic: clinicId,
  });

  if (memberErr || !isMember) {
    return { error: fail(403, "Access denied: not a clinic member") };
  }

  const { data: plan, error: planErr } = await userClient
    .from("subscription_plans")
    .select("*")
    .eq("code", planCode)
    .eq("is_active", true)
    .single();

  if (planErr || !plan) {
    return { error: fail(404, "Subscription plan not found or inactive") };
  }

  return { user, plan: plan as PlanRow };
}

interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

async function fetchRazorpayPayment(
  paymentId: string,
  authorization: string,
): Promise<RazorpayPayment | null> {
  const res = await fetch(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authorization },
  });
  if (!res.ok) {
    console.error("[subscription/verify] Payment lookup failed", res.status, await res.text());
    return null;
  }
  return (await res.json()) as RazorpayPayment;
}

export async function runCreateCheckout(
  env: Env,
  authHeader: string | undefined,
  body: CheckoutRequest,
): Promise<HandlerResult> {
  try {
    if (!authHeader) {
      return fail(401, "Missing Authorization header");
    }

    const supabaseEnv = readSupabaseEnv(env);
    if (!supabaseEnv) {
      console.error("[subscription/checkout] Supabase environment is incomplete");
      return fail(500, "Server configuration error");
    }

    const razorpay = readRazorpayCredentials(env);
    if (!razorpay) {
      console.error("[subscription/checkout] Razorpay credentials are missing or malformed");
      return fail(503, "Payments are temporarily unavailable. Please try again shortly.");
    }

    const clinicId = typeof body?.clinicId === "string" ? body.clinicId : "";
    const planCode = typeof body?.planCode === "string" ? body.planCode : "";
    if (!clinicId || !planCode) {
      return fail(400, "clinicId and planCode are required");
    }

    const auth = await authorizeMemberForPlan(supabaseEnv, authHeader, clinicId, planCode);
    if ("error" in auth) return auth.error;
    const { user, plan } = auth;

    // Recurring billing lives only in the Supabase Edge Functions. This fallback
    // never sells a recurring plan as a one-time order once recurring monthly is
    // enabled, and never sells anything while monthly auto-renew is live (the
    // primary path must stop that subscription first, or the clinic is billed twice).
    const billingClient = createClient(supabaseEnv.url, supabaseEnv.serviceKey);
    const { data: context, error: contextErr } = await billingClient.rpc("billing_checkout_context", {
      p_clinic_id: clinicId,
    });
    if (contextErr || !context) {
      console.error("[subscription/checkout] billing context failed", contextErr?.code, contextErr?.message);
      return fail(500, CHECKOUT_FAILED);
    }

    const billing = context as { recurring_enabled?: boolean; recurring_pilot?: boolean; live_subscription?: unknown };
    const keyMode = razorpay.keyId.startsWith("rzp_live_") ? "live" : "test";
    const recurringEnabled = Boolean(billing.recurring_enabled) || (Boolean(billing.recurring_pilot) && keyMode === "test");
    const billingMode = (plan as { billing_mode?: string }).billing_mode;

    if (billingMode === "recurring" && recurringEnabled) {
      return fail(409, "Monthly is billed as an automatic subscription.");
    }
    if (billing.live_subscription) {
      return fail(409, "Automatic renewal is on for this clinic. Please try again in a moment.");
    }

    // One-time Razorpay Order for the plan's full price (never a recurring subscription)
    const rzpRes = await fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: {
        Authorization: razorpay.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.base_price_paise,
        currency: plan.currency,
        receipt: `HLV-ORD-${Date.now().toString(36).toUpperCase()}`,
        notes: {
          clinic_id: clinicId,
          plan_code: plan.code,
          user_id: user.id,
        },
      }),
    });

    if (!rzpRes.ok) {
      console.error(
        "[subscription/checkout] Razorpay order creation failed",
        rzpRes.status,
        await rzpRes.text(),
      );
      return fail(502, CHECKOUT_FAILED);
    }

    const order = (await rzpRes.json()) as { id?: unknown; amount?: unknown };
    if (typeof order.id !== "string" || order.amount !== plan.base_price_paise) {
      console.error("[subscription/checkout] Unexpected Razorpay order response");
      return fail(502, CHECKOUT_FAILED);
    }

    // Server-side order record: payment confirmation is bound to this row
    const adminClient = createClient(supabaseEnv.url, supabaseEnv.serviceKey);
    const { error: insertErr } = await adminClient.from("subscription_payments").insert({
      clinic_id: clinicId,
      plan_id: plan.id,
      gateway: "razorpay",
      gateway_order_id: order.id,
      amount_paise: plan.base_price_paise,
      currency: plan.currency,
      status: "created",
      metadata: {
        user_id: user.id,
        user_email: user.email,
        plan_code: plan.code,
      },
    });

    if (insertErr) {
      console.error("[subscription/checkout] Failed to record order", insertErr.code, insertErr.message);
      return fail(500, CHECKOUT_FAILED);
    }

    return {
      status: 200,
      body: {
        orderId: order.id,
        amount: plan.base_price_paise,
        currency: plan.currency,
        keyId: razorpay.keyId,
        planName: plan.name,
        planCode: plan.code,
        interval: plan.interval,
        entitlementMonths: plan.entitlement_months,
      },
    };
  } catch (err) {
    console.error("[subscription/checkout] Unhandled error", err instanceof Error ? err.message : err);
    return fail(500, CHECKOUT_FAILED);
  }
}

export async function runVerifyPayment(
  env: Env,
  authHeader: string | undefined,
  body: VerifyPaymentRequest,
): Promise<HandlerResult> {
  try {
    if (!authHeader) {
      return fail(401, "Missing Authorization header");
    }

    const supabaseEnv = readSupabaseEnv(env);
    if (!supabaseEnv) {
      console.error("[subscription/verify] Supabase environment is incomplete");
      return fail(500, "Server configuration error");
    }

    // Fail closed: without the secret a signature cannot be verified, so no
    // payment may be confirmed.
    const razorpay = readRazorpayCredentials(env);
    if (!razorpay) {
      console.error("[subscription/verify] Razorpay credentials are missing or malformed");
      return fail(503, "Payment verification is temporarily unavailable.");
    }

    const { clinicId, planCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
    if (
      typeof clinicId !== "string" || !clinicId ||
      typeof planCode !== "string" || !planCode ||
      typeof razorpay_order_id !== "string" || !razorpay_order_id ||
      typeof razorpay_payment_id !== "string" || !razorpay_payment_id ||
      typeof razorpay_signature !== "string" || !razorpay_signature
    ) {
      return fail(400, "Missing required verification fields");
    }

    const auth = await authorizeMemberForPlan(supabaseEnv, authHeader, clinicId, planCode);
    if ("error" in auth) return auth.error;
    const { plan } = auth;

    // 1. Checkout signature: HMAC-SHA256(order_id|payment_id, key secret)
    const expectedSignature = hmacSha256Hex(razorpay.keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
      return fail(400, "Invalid payment signature verification");
    }

    // 2. Confirm with Razorpay that the payment is captured for this exact order and amount
    let payment = await fetchRazorpayPayment(razorpay_payment_id, razorpay.authorization);

    if (payment?.status === "authorized") {
      const captureRes = await fetch(
        `${RAZORPAY_API}/payments/${encodeURIComponent(razorpay_payment_id)}/capture`,
        {
          method: "POST",
          headers: { Authorization: razorpay.authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: plan.base_price_paise, currency: plan.currency }),
        },
      );
      if (!captureRes.ok) {
        // Usually a race with automatic capture; the re-fetch below decides.
        console.error("[subscription/verify] Capture attempt failed", captureRes.status, await captureRes.text());
      }
      payment = await fetchRazorpayPayment(razorpay_payment_id, razorpay.authorization);
    }

    if (!payment) {
      return fail(502, "Could not confirm the payment with the payment provider.");
    }

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== plan.base_price_paise ||
      String(payment.currency).toUpperCase() !== String(plan.currency).toUpperCase()
    ) {
      return fail(400, "Payment details do not match this order.");
    }

    if (payment.status !== "captured") {
      return fail(402, "Payment has not been completed yet.");
    }

    // 3. Atomic, idempotent confirmation bound to the server-created order
    const adminClient = createClient(supabaseEnv.url, supabaseEnv.serviceKey);
    const { data: confirmResult, error: confirmErr } = await adminClient.rpc(
      "confirm_subscription_payment",
      {
        p_clinic_id: clinicId,
        p_plan_code: planCode,
        p_gateway_order_id: razorpay_order_id,
        p_gateway_payment_id: razorpay_payment_id,
        p_gateway_signature: razorpay_signature,
        p_amount_paise: plan.base_price_paise,
        p_currency: plan.currency,
      },
    );

    if (confirmErr) {
      console.error("[subscription/verify] Confirmation failed", confirmErr.code, confirmErr.message);
      if (VALIDATION_ERROR_CODES.has(confirmErr.code ?? "")) {
        return fail(400, "Payment details do not match this order.");
      }
      return fail(500, CONFIRMATION_FAILED);
    }

    return { status: 200, body: confirmResult };
  } catch (err) {
    console.error("[subscription/verify] Unhandled error", err instanceof Error ? err.message : err);
    return fail(500, CONFIRMATION_FAILED);
  }
}

function embeddedPlanCode(row: { subscription_plans?: unknown } | null): string | undefined {
  const plan = row?.subscription_plans;
  const first = Array.isArray(plan) ? plan[0] : plan;
  return first && typeof first === "object" && "code" in first && typeof first.code === "string"
    ? first.code
    : undefined;
}

export async function runRazorpayWebhook(
  env: Env,
  rawBody: string,
  signature: string | null | undefined,
  eventIdHeader?: string | null,
): Promise<HandlerResult> {
  try {
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[subscription/webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
      return fail(500, "Webhook secret is not configured on server");
    }

    if (!signature) {
      return fail(401, "Missing x-razorpay-signature header");
    }

    // The signature covers the exact bytes Razorpay sent — verify before parsing.
    if (!timingSafeEqual(hmacSha256Hex(webhookSecret, rawBody), signature)) {
      return fail(401, "Invalid webhook signature");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return fail(400, "Malformed JSON payload");
    }

    const supabaseEnv = readSupabaseEnv(env);
    if (!supabaseEnv) {
      console.error("[subscription/webhook] Supabase environment is incomplete");
      return fail(500, "Server configuration error");
    }

    // Razorpay's x-razorpay-event-id is stable across redeliveries; the body
    // hash is a deterministic last resort so dedupe never uses a random id.
    const eventId =
      eventIdHeader ||
      payload.event_id ||
      payload.id ||
      `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
    const eventType = typeof payload.event === "string" ? payload.event : "unknown";

    const adminClient = createClient(supabaseEnv.url, supabaseEnv.serviceKey);

    // 1. Idempotency record
    let eventRowId: string;
    const { data: inserted, error: insertEventErr } = await adminClient
      .from("gateway_webhook_events")
      .insert({
        gateway: "razorpay",
        event_id: eventId,
        event_type: eventType,
        payload,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertEventErr) {
      if (insertEventErr.code !== "23505") {
        console.error("[subscription/webhook] Failed to log event", insertEventErr.code, insertEventErr.message);
        return fail(500, "Webhook logging failed");
      }

      const { data: existing, error: existingErr } = await adminClient
        .from("gateway_webhook_events")
        .select("id, status")
        .eq("gateway", "razorpay")
        .eq("event_id", eventId)
        .single();

      if (existingErr || !existing) {
        return fail(500, "Failed to load webhook event");
      }

      if (existing.status === "processed" || existing.status === "ignored") {
        return { status: 200, body: { received: true, duplicate: true } };
      }

      // An earlier delivery failed or never finished. Reprocessing is safe:
      // confirm_subscription_payment grants entitlement at most once per order.
      eventRowId = existing.id;
    } else {
      eventRowId = inserted.id;
    }

    // 2. Process supported events. Clinic and plan always come from the order
    // row Healvo created at checkout, never from client-supplied payment notes.
    let processStatus: "processed" | "ignored" | "failed" = "processed";
    let processError: string | null = null;
    let retryable = false;

    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const orderId: string | undefined = orderEntity?.id || paymentEntity?.order_id;

    const findHealvoOrder = async () => {
      if (!orderId) return null;
      const { data, error } = await adminClient
        .from("subscription_payments")
        .select("clinic_id, subscription_plans(code)")
        .eq("gateway_order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data as { clinic_id: string; subscription_plans?: unknown } | null;
    };

    if (eventType === "order.paid" || eventType === "payment.captured") {
      const paymentId = paymentEntity?.id;
      const amountPaise = paymentEntity?.amount;
      const currency = paymentEntity?.currency || orderEntity?.currency || "INR";
      const order = await findHealvoOrder();
      const planCode = embeddedPlanCode(order);

      if (!order || !planCode) {
        processStatus = "ignored";
        processError = "Order was not created by Healvo subscription checkout";
      } else if (!paymentId || !amountPaise) {
        processStatus = "ignored";
        processError = "Event has no payment reference";
      } else {
        const { error: confirmErr } = await adminClient.rpc("confirm_subscription_payment", {
          p_clinic_id: order.clinic_id,
          p_plan_code: planCode,
          p_gateway_order_id: orderId,
          p_gateway_payment_id: paymentId,
          p_gateway_signature: "webhook_verified",
          p_amount_paise: amountPaise,
          p_currency: currency,
        });

        if (confirmErr) {
          processStatus = "failed";
          processError = confirmErr.message;
          retryable = !PERMANENT_ERROR_CODES.has(confirmErr.code ?? "");
        }
      }
    } else if (eventType === "payment.failed") {
      const order = await findHealvoOrder();

      if (!order) {
        processStatus = "ignored";
        processError = "Order was not created by Healvo subscription checkout";
      } else {
        const { error: failureErr } = await adminClient.rpc("record_subscription_payment_failure", {
          p_clinic_id: order.clinic_id,
          p_gateway_order_id: orderId,
          p_gateway_payment_id: paymentEntity?.id ?? null,
          p_error_code: paymentEntity?.error_code ?? null,
          p_error_description: paymentEntity?.error_description ?? null,
        });

        if (failureErr) {
          processStatus = "failed";
          processError = failureErr.message;
          retryable = !PERMANENT_ERROR_CODES.has(failureErr.code ?? "");
        }
      }
    } else {
      processStatus = "ignored";
    }

    await adminClient
      .from("gateway_webhook_events")
      .update({
        status: processStatus,
        error_message: processError,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventRowId);

    if (processStatus === "failed") {
      console.error("[subscription/webhook] Event processing failed", eventType, processError);
    }

    return { status: retryable ? 500 : 200, body: { received: true, status: processStatus } };
  } catch (err) {
    console.error("[subscription/webhook] Unhandled error", err instanceof Error ? err.message : err);
    return fail(500, "Internal server error");
  }
}
