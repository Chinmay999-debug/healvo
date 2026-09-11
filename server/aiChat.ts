import type { IncomingMessage } from "node:http";
import type { Connect, Plugin } from "vite";
import { MAX_BODY_BYTES, runHealvoAiChat, sendJson } from "./aiChatHandler.ts";

export { HEALVO_AI_MODEL } from "./aiChatHandler.ts";

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

export function createHealvoAiMiddleware(
  env: Record<string, string | undefined>,
): Connect.NextHandleFunction {
  const apiKey = env.GROQ_API_KEY;

  return async function healvoAiMiddleware(req, res, next) {
    const url = req.url?.split("?")[0];
    if (url !== "/api/ai/chat") {
      next();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
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

    const result = await runHealvoAiChat(apiKey, body);
    sendJson(res, result.status, result.body);
  };
}

/**
 * Wires POST /api/ai/chat into both the Vite dev server and `vite preview`.
 * In production on Vercel, the same request path is served instead by the
 * serverless function at api/ai/chat.ts, which calls the same
 * runHealvoAiChat() logic from ./aiChatHandler.ts — this plugin only
 * matters for local development.
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
