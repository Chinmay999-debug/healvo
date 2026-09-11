import type { IncomingMessage, ServerResponse } from "node:http";
import { MAX_BODY_BYTES, runHealvoAiChat, sendJson } from "../../server/aiChatHandler.js";

/**
 * Vercel Serverless Function for POST /api/ai/chat — the production
 * counterpart to the Vite dev/preview middleware in server/aiChat.ts. Both
 * share the same runHealvoAiChat() logic from server/aiChatHandler.ts so
 * the AI behavior itself never diverges between environments.
 *
 * Vercel's Node.js runtime parses the JSON request body for us (into
 * req.body) based on the Content-Type header the frontend already sends,
 * so there's no raw-stream reading here like the dev middleware needs.
 */
type IncomingMessageWithBody = IncomingMessage & { body?: unknown };

export default async function handler(req: IncomingMessageWithBody, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    sendJson(res, 413, { error: "Request too large." });
    return;
  }

  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = body ? JSON.parse(body) : {};
    } catch {
      sendJson(res, 400, { error: "Malformed request." });
      return;
    }
  }

  const result = await runHealvoAiChat(process.env.GROQ_API_KEY, body);
  sendJson(res, result.status, result.body);
}
