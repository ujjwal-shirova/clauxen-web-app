// Flow: raw body → signature check → billingService.handleRazorpayWebhook → JSON response
// =============================================================================

import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/server/billing/razorpay";
import * as billingService from "@/server/services/billing.service";
import { jsonError } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Razorpay webhook payloads are small JSON envelopes — cap body size before HMAC + parse.
const MAX_BODY_BYTES = 256 * 1024;

function parseRazorpayWebhookPayload(
  rawBody: string,
): Parameters<typeof billingService.handleRazorpayWebhook>[0] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new AppError("Invalid webhook payload.", 400, "invalid_webhook");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { event?: unknown }).event !== "string"
  ) {
    throw new AppError("Invalid webhook payload.", 400, "invalid_webhook");
  }
  return parsed as Parameters<typeof billingService.handleRazorpayWebhook>[0];
}

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const bytes = Number.parseInt(contentLength, 10);
      if (Number.isFinite(bytes) && bytes > MAX_BODY_BYTES) {
        return jsonError(
          new AppError("Request body too large.", 413, "payload_too_large"),
        );
      }
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonError(
        new AppError("Request body too large.", 413, "payload_too_large"),
      );
    }

    const signature = request.headers.get("x-razorpay-signature");
    if (!verifyWebhookSignature(rawBody, signature)) {
      return jsonError(
        new AppError("Invalid webhook signature.", 401, "unauthorized"),
      ); // tampered/replay request — 401 Unauthorized
    }

    const payload = parseRazorpayWebhookPayload(rawBody); // event type + entity — malformed JSON rejected before service

    const result = await billingService.handleRazorpayWebhook(payload); // DB: orders, subscriptions, invoices sync
    return NextResponse.json({ data: result });
  } catch (error) {
    return jsonError(
      error instanceof AppError ? error : new AppError("Webhook failed.", 500),
    );
  }
}
