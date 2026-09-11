import type { ServerResponse } from "node:http";
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

/**
 * The actual Healvo AI behavior — request validation, prompt assembly, and
 * the Groq call — shared verbatim between the Vite dev/preview middleware
 * (server/aiChat.ts) and the Vercel serverless function (api/ai/chat.ts) so
 * the two environments can never drift apart in behavior.
 */
export async function runHealvoAiChat(
  apiKey: string | undefined,
  body: unknown,
): Promise<HealvoAiResult> {
  if (!apiKey) {
    console.error("[healvo-ai] GROQ_API_KEY is not set — Healvo AI is disabled.");
    return { status: 500, body: { error: "Healvo AI isn't configured on this server yet." } };
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
    const client = new Groq({ apiKey });
    const completion = await client.chat.completions.create({
      model: HEALVO_AI_MODEL,
      temperature: 0.4,
      max_tokens: 600,
      messages: [{ role: "system", content: systemContent }, ...messages],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return { status: 502, body: { error: SAFE_ERROR } };
    }

    return { status: 200, body: { reply } };
  } catch (error) {
    console.error("[healvo-ai] Groq request failed:", error instanceof Error ? error.message : error);
    return { status: 502, body: { error: SAFE_ERROR } };
  }
}
