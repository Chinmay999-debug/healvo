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

export function hmacSha256Hex(key: string, message: string): string {
  return crypto.createHmac("sha256", key).update(message).digest("hex");
}

export async function runCreateCheckout(
  env: Record<string, string | undefined>,
  authHeader: string | undefined,
  body: CheckoutRequest,
) {
  if (!authHeader) {
    return { status: 401, body: { error: "Missing Authorization header" } };
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || publishableKey;

  if (!supabaseUrl || !publishableKey) {
    return { status: 500, body: { error: "Server missing Supabase configuration" } };
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return { status: 401, body: { error: "Unauthorized session" } };
  }

  const { clinicId, planCode } = body;
  if (!clinicId || !planCode) {
    return { status: 400, body: { error: "clinicId and planCode are required" } };
  }

  const { data: isMember, error: memberErr } = await userClient.rpc("is_clinic_member", {
    target_clinic: clinicId,
  });

  if (memberErr || !isMember) {
    return { status: 403, body: { error: "Access denied: not a clinic member" } };
  }

  const { data: plan, error: planErr } = await userClient
    .from("subscription_plans")
    .select("*")
    .eq("code", planCode)
    .eq("is_active", true)
    .single();

  if (planErr || !plan) {
    return { status: 404, body: { error: "Subscription plan not found or inactive" } };
  }

  const rzpKeyId = env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || "rzp_test_healvo_demo";
  const rzpKeySecret = env.RAZORPAY_KEY_SECRET;

  let orderId = `order_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (rzpKeySecret && rzpKeyId.startsWith("rzp_test_") && !rzpKeyId.includes("demo")) {
    const receipt = `HLV-ORD-${Date.now().toString(36).toUpperCase()}`;
    const basicAuth = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString("base64");

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.base_price_paise,
        currency: plan.currency,
        receipt,
        notes: {
          clinic_id: clinicId,
          plan_code: planCode,
          user_id: user.id,
        },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      return { status: 502, body: { error: `Razorpay Order creation failed: ${errText}` } };
    }

    const rzpData = (await rzpRes.json()) as { id: string };
    orderId = rzpData.id;
  }

  const adminClient = createClient(supabaseUrl, serviceKey!);
  await adminClient.from("subscription_payments").insert({
    clinic_id: clinicId,
    plan_id: plan.id,
    gateway: "razorpay",
    gateway_order_id: orderId,
    amount_paise: plan.base_price_paise,
    currency: plan.currency,
    status: "created",
    metadata: {
      user_id: user.id,
      user_email: user.email,
      plan_code: plan.code,
    },
  });

  return {
    status: 200,
    body: {
      orderId,
      amount: plan.base_price_paise,
      currency: plan.currency,
      keyId: rzpKeyId,
      planName: plan.name,
      planCode: plan.code,
      interval: plan.interval,
      entitlementMonths: plan.entitlement_months,
    },
  };
}

export async function runVerifyPayment(
  env: Record<string, string | undefined>,
  authHeader: string | undefined,
  body: VerifyPaymentRequest,
) {
  if (!authHeader) {
    return { status: 401, body: { error: "Missing Authorization header" } };
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || publishableKey;

  if (!supabaseUrl || !publishableKey) {
    return { status: 500, body: { error: "Server missing Supabase configuration" } };
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return { status: 401, body: { error: "Unauthorized session" } };
  }

  const { clinicId, planCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!clinicId || !planCode || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return { status: 400, body: { error: "Missing required verification fields" } };
  }

  const { data: isMember, error: memberErr } = await userClient.rpc("is_clinic_member", {
    target_clinic: clinicId,
  });

  if (memberErr || !isMember) {
    return { status: 403, body: { error: "Access denied: not a clinic member" } };
  }

  const { data: plan, error: planErr } = await userClient
    .from("subscription_plans")
    .select("*")
    .eq("code", planCode)
    .eq("is_active", true)
    .single();

  if (planErr || !plan) {
    return { status: 404, body: { error: "Subscription plan not found or inactive" } };
  }

  const rzpKeySecret = env.RAZORPAY_KEY_SECRET;
  if (rzpKeySecret) {
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = hmacSha256Hex(rzpKeySecret, payload);
    if (expectedSignature !== razorpay_signature) {
      return { status: 400, body: { error: "Invalid payment signature verification" } };
    }
  }

  const adminClient = createClient(supabaseUrl, serviceKey!);
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
    }
  );

  if (confirmErr) {
    return { status: 500, body: { error: `Payment confirmation failed: ${confirmErr.message}` } };
  }

  return { status: 200, body: confirmResult };
}

export async function runRazorpayWebhook(
  env: Record<string, string | undefined>,
  rawBody: string,
  signature: string | null | undefined,
) {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { status: 500, body: { error: "Webhook secret is not configured on server" } };
  }

  if (!signature) {
    return { status: 401, body: { error: "Missing x-razorpay-signature header" } };
  }

  const expectedSignature = hmacSha256Hex(webhookSecret, rawBody);
  if (expectedSignature !== signature) {
    return { status: 401, body: { error: "Invalid webhook signature" } };
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "Malformed JSON payload" } };
  }

  const eventId = payload.event_id || payload.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const eventType = payload.event || "unknown";

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { status: 500, body: { error: "Server missing Supabase credentials" } };
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: eventRecord, error: insertEventErr } = await adminClient
    .from("gateway_webhook_events")
    .insert({
      gateway: "razorpay",
      event_id: eventId,
      event_type: eventType,
      payload,
      status: "pending",
    })
    .select()
    .single();

  if (insertEventErr) {
    if (insertEventErr.code === "23505") {
      return { status: 200, body: { received: true, duplicate: true } };
    }
    return { status: 500, body: { error: `Webhook logging failed: ${insertEventErr.message}` } };
  }

  let processStatus = "processed";
  let processError: string | null = null;

  if (eventType === "order.paid" || eventType === "payment.captured") {
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;

    const orderId = orderEntity?.id || paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    const notes = orderEntity?.notes || paymentEntity?.notes || {};
    const clinicId = notes.clinic_id;
    const planCode = notes.plan_code;
    const amountPaise = paymentEntity?.amount || orderEntity?.amount;
    const currency = paymentEntity?.currency || orderEntity?.currency || "INR";

    if (clinicId && planCode && orderId && paymentId && amountPaise) {
      const { error: confirmErr } = await adminClient.rpc("confirm_subscription_payment", {
        p_clinic_id: clinicId,
        p_plan_code: planCode,
        p_gateway_order_id: orderId,
        p_gateway_payment_id: paymentId,
        p_gateway_signature: signature || "webhook_verified",
        p_amount_paise: amountPaise,
        p_currency: currency,
      });

      if (confirmErr) {
        processStatus = "failed";
        processError = confirmErr.message;
      }
    } else {
      processStatus = "ignored";
      processError = "Missing subscription notes in webhook entity";
    }
  } else if (eventType === "payment.failed") {
    const paymentEntity = payload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    const notes = paymentEntity?.notes || {};
    const clinicId = notes.clinic_id;

    if (clinicId && orderId) {
      await adminClient.rpc("record_subscription_payment_failure", {
        p_clinic_id: clinicId,
        p_gateway_order_id: orderId,
        p_gateway_payment_id: paymentId,
        p_error_code: paymentEntity?.error_code,
        p_error_description: paymentEntity?.error_description,
      });
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
    .eq("id", eventRecord.id);

  return { status: 200, body: { received: true, status: processStatus } };
}
