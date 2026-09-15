import type { IncomingMessage, ServerResponse } from "node:http";
import { runRazorpayWebhook } from "../../server/subscriptionHandler.js";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// Razorpay signs the exact request bytes, so the body is read straight from the
// stream as bytes. Never touch Vercel's parsed `req.body` helper here — reading
// it consumes the stream and re-serialized JSON would not match the signature.
async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const eventId = req.headers["x-razorpay-event-id"] as string | undefined;

  const result = await runRazorpayWebhook(process.env, rawBody, signature, eventId);
  sendJson(res, result.status, result.body);
}
