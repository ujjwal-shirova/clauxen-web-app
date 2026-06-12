import { NextResponse } from "next/server";
import { env } from "@/backend/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Apple Pay domain verification for Razorpay Standard Checkout.
 * @see https://razorpay.com/docs/payments/payment-methods/apple-pay/
 */
export async function GET() {
  const content = env.applePayDomainAssociation?.trim();
  if (!content) {
    return new NextResponse("Apple Pay domain association is not configured.", {
      status: 404,
    });
  }

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
