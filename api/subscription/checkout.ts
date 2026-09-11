import type { IncomingMessage, ServerResponse } from "node:http";
import { runCreateCheckout } from "../../server/subscriptionHandler.js";

type IncomingMessageWithBody = IncomingMessage & { body?: unknown };

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessageWithBody, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: any = req.body;
  if (typeof body === "string") {
    try {
      body = body ? JSON.parse(body) : {};
    } catch {
      sendJson(res, 400, { error: "Malformed request" });
      return;
    }
  }

  const authHeader = req.headers["authorization"] as string | undefined;
  const result = await runCreateCheckout(process.env, authHeader, body);
  sendJson(res, result.status, result.body);
}
