import type { ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

/**
 * Single place to change the Groq chat model without touching the UI or
 * the request-handling logic below.
 */
export const HEALVO_AI_MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `You are Healvo AI, the built-in clinic assistant for Healvo dental clinic management software.

Your role is to help clinic staff understand and navigate their clinic operations.

Be concise, practical, calm, and useful.

You can help explain information available in the current Healvo application context, such as today's schedule, patients, billing, collections, waiting visits, and clinic workflows.

Never claim to have performed an action unless the application actually performed that action.

Never invent patient information, financial figures, appointments, clinical records, or clinic data.

If information is not available in the context provided to you, say so clearly.

You are an administrative software assistant, not a substitute for a dentist or other qualified healthcare professional.

When discussing clinical information, avoid presenting yourself as the treating clinician.

Respond in plain conversational text only — no markdown formatting (no asterisks, headers, or bullet lists).

All monetary figures in the provided clinic context are in Indian Rupees. Always use the ₹ symbol when quoting amounts, never $.`;

export const MAX_MESSAGES = 30;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_CONTEXT_LENGTH = 8000;
export const MAX_BODY_BYTES = 200_000;

export const SAFE_ERROR = "Sorry, I couldn't reach Healvo AI right now. Please try again.";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const messages: ChatMessage[] = [];
  for (const item of input.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) continue;
    messages.push({ role, content: trimmed });
  }
  return messages.length > 0 ? messages : null;
}

/** The clinic-context snapshot is arbitrary (but small) JSON assembled by
 * the frontend — see src/lib/aiContext.ts. We only cap its size here; the
 * frontend is responsible for keeping it to non-sensitive, operational
 * fields. */
export function sanitizeContext(input: unknown): string | null {
  if (input === undefined || input === null || typeof input !== "object") return null;
  try {
    const json = JSON.stringify(input);
    return json.length > MAX_CONTEXT_LENGTH ? json.slice(0, MAX_CONTEXT_LENGTH) : json;
  } catch {
    return null;
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(payload);
}

export interface HealvoAiResult {
  status: number;
  body: { reply: string } | { error: string };
}

type Env = Record<string, string | undefined>;

/**
 * Everything the handler needs from the outside world. Production wiring is
 * createHealvoAiDeps(); tests substitute their own.
 */
export interface HealvoAiDeps {
  /** Validates the bearer token with Supabase Auth; the user's id, or null. */
  verifyUser(token: string): Promise<string | null>;
  /** The user's active clinic memberships, oldest first (the app's active clinic is the first). */
  activeClinicIds(userId: string): Promise<string[]>;
  /** Server-side entitlement: public.has_entitlement(clinic, 'ai_assistant'), run as the user. */
  hasAiEntitlement(clinicId: string): Promise<boolean>;
  /** The model call. Null when the model returned nothing usable. */
  complete(system: string, messages: ChatMessage[]): Promise<string | null>;
  now(): number;
}

export const RATE_LIMIT_MAX_REQUESTS = 20;
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Per-user sliding-window limit. In memory, so it is per server instance
 * (each Vercel function instance keeps its own window): a basic brake on
 * runaway use, not a global quota.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(max = RATE_LIMIT_MAX_REQUESTS, windowMs = RATE_LIMIT_WINDOW_MS) {
    this.max = max;
    this.windowMs = windowMs;
  }

  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }
}

const sharedLimiter = new RateLimiter();

function bearerToken(authHeader: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader ?? "");
  return match ? match[1] : null;
}

function readSupabaseEnv(env: Env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

/**
 * Production wiring. Every Supabase call is made as the signed-in user
 * (their JWT on a publishable-key client), so RLS and has_entitlement()'s own
 * membership check apply; no service-role key is involved.
 */
export function createHealvoAiDeps(env: Env, token: string, fetchImpl?: typeof fetch): HealvoAiDeps | null {
  const supabaseEnv = readSupabaseEnv(env);
  if (!supabaseEnv) return null;
  const userClient = createClient(supabaseEnv.url, supabaseEnv.publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` }, ...(fetchImpl ? { fetch: fetchImpl } : {}) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const apiKey = env.GROQ_API_KEY;

  return {
    async verifyUser(accessToken) {
      const { data, error } = await userClient.auth.getUser(accessToken);
      return error || !data.user ? null : data.user.id;
    },
    async activeClinicIds(userId) {
      const { data, error } = await userClient
        .from("clinic_memberships")
        .select("clinic_id, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      return data.map((row) => row.clinic_id as string);
    },
    async hasAiEntitlement(clinicId) {
      const { data, error } = await userClient.rpc("has_entitlement", {
        p_clinic_id: clinicId,
        p_feature: "ai_assistant",
      });
      return !error && data === true;
    },
    async complete(system, messages) {
      if (!apiKey) throw new Error("GROQ_API_KEY is not set");
      const client = new Groq({ apiKey });
      const completion = await client.chat.completions.create({
        model: HEALVO_AI_MODEL,
        temperature: 0.4,
        max_tokens: 600,
        messages: [{ role: "system", content: system }, ...messages],
      });
      return completion.choices[0]?.message?.content?.trim() || null;
    },
    now: () => Date.now(),
  };
}

const UNAUTHORIZED: HealvoAiResult = { status: 401, body: { error: "Please sign in again to use Healvo AI." } };
const NOT_ENTITLED: HealvoAiResult = {
  status: 403,
  body: { error: "Healvo AI is included with Premium. Upgrade your plan to use it." },
};

/**
 * The actual Healvo AI behavior, shared verbatim between the Vite dev/preview
 * middleware (server/aiChat.ts) and the Vercel serverless function
 * (api/ai/chat.ts) so the two environments can never drift apart.
 *
 * Access is decided here, server-side, never by the client:
 *  1. a valid Supabase session (bearer JWT verified with Supabase Auth) - else 401
 *  2. the clinic is one the user actively belongs to; a client-sent clinic_id
 *     is only honoured if it is one of those memberships - else 403
 *  3. has_entitlement(clinic, 'ai_assistant') is true (plan + valid dates) - else 403
 *  4. per-user rate limit - else 429
 */
export async function runHealvoAiChat(
  env: Env,
  body: unknown,
  authHeader: string | undefined,
  options: { deps?: HealvoAiDeps; limiter?: RateLimiter } = {},
): Promise<HealvoAiResult> {
  const token = bearerToken(authHeader);
  if (!token) return UNAUTHORIZED;

  const deps = options.deps ?? createHealvoAiDeps(env, token);
  if (!deps) {
    console.error("[healvo-ai] Supabase URL / publishable key are not set.");
    return { status: 500, body: { error: "Healvo AI isn't configured on this server yet." } };
  }

  let userId: string | null;
  try {
    userId = await deps.verifyUser(token);
  } catch {
    userId = null;
  }
  if (!userId) return UNAUTHORIZED;

  const memberships = await deps.activeClinicIds(userId).catch(() => [] as string[]);
  const requested = (body as Record<string, unknown> | null)?.clinic_id;
  const clinicId = typeof requested === "string" && requested ? requested : memberships[0];
  if (!clinicId || !memberships.includes(clinicId)) {
    return { status: 403, body: { error: "You don't have access to this clinic." } };
  }

  const entitled = await deps.hasAiEntitlement(clinicId).catch(() => false);
  if (!entitled) return NOT_ENTITLED;

  if (!(options.limiter ?? sharedLimiter).allow(userId, deps.now())) {
    return { status: 429, body: { error: "You're sending messages too quickly. Please wait a minute and try again." } };
  }

  const messages = sanitizeMessages((body as Record<string, unknown> | null)?.messages);
  if (!messages) {
    return { status: 400, body: { error: "A message is required." } };
  }

  const contextJson = sanitizeContext((body as Record<string, unknown> | null)?.context);
  const systemContent = contextJson
    ? `${SYSTEM_PROMPT}\n\nCurrent Healvo clinic context (JSON, may be partial or incomplete):\n${contextJson}`
    : SYSTEM_PROMPT;

  try {
    const reply = await deps.complete(systemContent, messages);
    if (!reply) return { status: 502, body: { error: SAFE_ERROR } };
    return { status: 200, body: { reply } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[healvo-ai] model request failed:", message);
    if (message.includes("GROQ_API_KEY")) {
      return { status: 500, body: { error: "Healvo AI isn't configured on this server yet." } };
    }
    return { status: 502, body: { error: SAFE_ERROR } };
  }
}
