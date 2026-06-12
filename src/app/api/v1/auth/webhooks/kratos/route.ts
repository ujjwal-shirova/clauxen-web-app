import { NextResponse } from "next/server";
import { env } from "@/backend/config/env"; // production webhook secret guard
import {
  parseKratosWebhookPayload,
  verifyKratosWebhookSecret,
} from "@/backend/ory/kratos-client"; // webhook secret verify + identity payload parse
import { syncFromKratosIdentity } from "@/backend/services/identity.service"; // Kratos identity → local profiles upsert
import { jsonError } from "@/backend/http/api-response"; // standardized error JSON shape
import { AppError } from "@/backend/db/errors"; // typed HTTP errors with status codes

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!env.oryKratosWebhookSecret && isProductionRuntime()) {
      return jsonError(
        new AppError(
          "Webhook endpoint is not configured.",
          503,
          "misconfigured",
        ),
      );
    }

    const secretHeader =
      request.headers.get("x-ory-webhook-secret") ??
      request.headers.get("x-kratos-webhook-secret");

    if (!verifyKratosWebhookSecret(secretHeader)) {
      return jsonError(
        new AppError("Invalid webhook secret.", 401, "unauthorized"),
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(
        new AppError("Invalid JSON body.", 400, "invalid_webhook"),
      );
    }

    const identity = parseKratosWebhookPayload(body);
    const result = await syncFromKratosIdentity(identity);

    return NextResponse.json({ data: result });
  } catch (error) {
    return jsonError(
      error instanceof AppError
        ? error
        : new AppError("Webhook processing failed.", 500, "internal_error"),
    );
  }
}
