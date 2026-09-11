import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
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

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTEXT_LENGTH = 8000;
const MAX_BODY_BYTES = 200_000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sanitizeMessages(input: unknown): ChatMessage[] | null {
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
function sanitizeContext(input: unknown): string | null {
  if (input === undefined || input === null || typeof input !== "object") return null;
  try {
    const json = JSON.stringify(input);
    return json.length > MAX_CONTEXT_LENGTH ? json.slice(0, MAX_CONTEXT_LENGTH) : json;
  } catch {
    return null;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(payload);
}

const SAFE_ERROR = "Sorry, I couldn't reach Healvo AI right now. Please try again.";

export function createHealvoAiMiddleware(
  env: Record<string, string | undefined>,
): Connect.NextHandleFunction {
  const apiKey = env.GROQ_API_KEY;
  const client = apiKey ? new Groq({ apiKey }) : null;

  return async function healvoAiMiddleware(req, res, next) {
    const url = req.url?.split("?")[0];
    if (url !== "/api/ai/chat" || req.method !== "POST") {
      next();
      return;
    }

    if (!client) {
      console.error("[healvo-ai] GROQ_API_KEY is not set — Healvo AI is disabled.");
      sendJson(res, 500, { error: "Healvo AI isn't configured on this server yet." });
      return;
    }

    let raw: string;
    try {
      raw = await readRequestBody(req);
    } catch {
      sendJson(res, 413, { error: "Request too large." });
      return;
    }

    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: "Malformed request." });
      return;
    }

    const messages = sanitizeMessages((body as Record<string, unknown> | null)?.messages);
    if (!messages) {
      sendJson(res, 400, { error: "A message is required." });
      return;
    }

    const contextJson = sanitizeContext((body as Record<string, unknown> | null)?.context);
    const systemContent = contextJson
      ? `${SYSTEM_PROMPT}\n\nCurrent Healvo clinic context (JSON, may be partial or incomplete):\n${contextJson}`
      : SYSTEM_PROMPT;

    try {
      const completion = await client.chat.completions.create({
        model: HEALVO_AI_MODEL,
        temperature: 0.4,
        max_tokens: 600,
        messages: [{ role: "system", content: systemContent }, ...messages],
      });

      const reply = completion.choices[0]?.message?.content?.trim();
      if (!reply) {
        sendJson(res, 502, { error: SAFE_ERROR });
        return;
      }

      sendJson(res, 200, { reply });
    } catch (error) {
      console.error("[healvo-ai] Groq request failed:", error instanceof Error ? error.message : error);
      sendJson(res, 502, { error: SAFE_ERROR });
    }
  };
}

/**
 * Wires POST /api/ai/chat into both the Vite dev server and `vite preview`,
 * since this project has no standalone backend process. GROQ_API_KEY never
 * reaches client code — it's read here, in a Node-only plugin file, and
 * used only inside this request handler.
 */
export function healvoAiPlugin(env: Record<string, string | undefined>): Plugin {
  const middleware = createHealvoAiMiddleware(env);
  return {
    name: "healvo-ai-chat",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
