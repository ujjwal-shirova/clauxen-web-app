import { withApiHandler } from "@/backend/http/api-handler"; // session + error wrapper
import { jsonData } from "@/backend/http/api-response"; // { data } success JSON — checkout payload
import { requireSession } from "@/backend/auth/require-session"; // null session → 401
import * as giftService from "@/backend/services/gift.service"; // billing + gift code generation orchestration
import { AppError } from "@/backend/db/errors"; // validation errors — 400 with message
import { isCheckoutCurrency } from "@/lib/checkout-currency";

const MAX_PLAN_ID_LENGTH = 64;
const MAX_GIFT_TEXT_LENGTH = 500;
const MAX_GIFT_NAME_LENGTH = 200;
const GIFT_THEME_COLORS = new Set([
  "#DD8164",
  "#77A3CF",
  "#839569",
  "#C8728F",
  "#EFD9D9",
  "#CBDCD5",
  "#D7D6E1",
]);

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function trimOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session); // purchaser user id — gift record owner
    const body = (await request.json()) as {
      planId?: string;
      months?: number;
      recipientEmail?: string;
      recipientName?: string;
      senderName?: string;
      senderEmail?: string;
      deliveryMethod?: "email" | "link";
      message?: string;
      themeColor?: string;
      currency?: string;
    };

    if (typeof body.planId !== "string" || !body.planId.trim()) {
      throw new AppError("planId is required.", 400);
    }
    if (body.planId.length > MAX_PLAN_ID_LENGTH) {
      throw new AppError("Invalid planId.", 400);
    }

    const months = body.months;
    if (typeof months !== "number" || !Number.isInteger(months)) {
      throw new AppError("months must be an integer.", 400);
    }

    const deliveryMethod = body.deliveryMethod ?? "email";
    if (deliveryMethod !== "email" && deliveryMethod !== "link") {
      throw new AppError('deliveryMethod must be "email" or "link".', 400);
    }

    const recipientEmail = trimOptionalText(body.recipientEmail, 254);
    if (deliveryMethod === "email") {
      if (!recipientEmail || !isValidEmail(recipientEmail)) {
        throw new AppError(
          "A valid recipient email is required for email delivery.",
          400,
        );
      }
    } else if (recipientEmail && !isValidEmail(recipientEmail)) {
      throw new AppError("Invalid recipient email.", 400);
    }

    const themeColorRaw =
      typeof body.themeColor === "string" ? body.themeColor.trim() : null;
    const themeColor =
      themeColorRaw && GIFT_THEME_COLORS.has(themeColorRaw)
        ? themeColorRaw
        : null;

    const sessionEmail = user.email?.trim() ?? "";
    const currency =
      body.currency && isCheckoutCurrency(body.currency) ? body.currency : "INR";

    const checkout = await giftService.purchaseGift({
      userId: user.id,
      userEmail: sessionEmail, // Razorpay/billing — session email only (no client override)
      planId: body.planId.trim(),
      months,
      recipientEmail,
      recipientName: trimOptionalText(body.recipientName, MAX_GIFT_NAME_LENGTH),
      senderName:
        trimOptionalText(body.senderName, MAX_GIFT_NAME_LENGTH) ??
        user.displayName?.trim().slice(0, MAX_GIFT_NAME_LENGTH) ??
        "Clauxen user", // sender display — profile name fallback
      senderEmail: sessionEmail, // gift metadata — session email only
      deliveryMethod,
      message: trimOptionalText(body.message, MAX_GIFT_TEXT_LENGTH), // optional personal message on gift
      themeColor, // allowlisted palette only — arbitrary CSS values reject
      currency,
    }); // service: Razorpay order create + pending gift row insert

    return jsonData(checkout, 201);
  },
  { requireAuth: true },
);
