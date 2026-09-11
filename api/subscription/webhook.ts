import type { IncomingMessage, ServerResponse } from "node:http";
import { runRazorpayWebhook } from "../../server/subscriptionHandler.js";

type IncomingMessageWithBody = IncomingMessage & { body?: unknown };

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(data);
    });
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessageWithBody, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = typeof req.body === "string" ? req.body : await readRawBody(req);
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  const result = await runRazorpayWebhook(process.env, rawBody, signature);
  sendJson(res, result.status, result.body);
}
