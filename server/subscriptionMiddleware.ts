import type { IncomingMessage } from "node:http";
import type { Connect, Plugin } from "vite";
import {
  runCreateCheckout,
  runVerifyPayment,
  runRazorpayWebhook,
} from "./subscriptionHandler.ts";

// Collected as bytes so a multi-byte character split across chunks can't alter
// the webhook body Razorpay signed.
async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function createSubscriptionMiddleware(
  env: Record<string, string | undefined>,
): Connect.NextHandleFunction {
  return async function subscriptionMiddleware(req, res, next) {
    const url = req.url?.split("?")[0];

    if (!url?.startsWith("/api/subscription/")) {
      next();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    let raw: string;
    try {
      raw = await readRequestBody(req);
    } catch {
      sendJson(res, 400, { error: "Failed to read request body" });
      return;
    }

    const authHeader = req.headers["authorization"] as string | undefined;

    if (url === "/api/subscription/checkout") {
      let body: any;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, { error: "Malformed JSON" });
        return;
      }
      const result = await runCreateCheckout(env, authHeader, body);
      sendJson(res, result.status, result.body);
      return;
    }

    if (url === "/api/subscription/verify") {
      let body: any;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, { error: "Malformed JSON" });
        return;
      }
      const result = await runVerifyPayment(env, authHeader, body);
      sendJson(res, result.status, result.body);
      return;
    }

    if (url === "/api/subscription/webhook") {
      const signature = req.headers["x-razorpay-signature"] as string | undefined;
      const eventId = req.headers["x-razorpay-event-id"] as string | undefined;
      const result = await runRazorpayWebhook(env, raw, signature, eventId);
      sendJson(res, result.status, result.body);
      return;
    }

    next();
  };
}

export function healvoSubscriptionPlugin(env: Record<string, string | undefined>): Plugin {
  const middleware = createSubscriptionMiddleware(env);
  return {
    name: "healvo-subscription",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
