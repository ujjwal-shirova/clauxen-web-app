import { withApiHandler } from "@/server/http/api-handler"; // session + centralized error handling
import { jsonData } from "@/server/http/api-response"; // { data: { redemption } } success envelope
import { requireSession } from "@/server/auth/require-session"; // null session → 401
import * as giftService from "@/server/services/gift.service"; // code validate, mark redeemed, billing apply
import { AppError } from "@/server/db/errors";

// CX-XXXXX-XXXXX-XXXX (19) + paste margin — rejects oversized bodies before hash lookup
const MAX_GIFT_CODE_LENGTH = 64;

export const runtime = "nodejs"; // Node.js runtime — DB + billing side effects
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as { code?: unknown }; // malformed JSON → empty — generic 400
    if (body.code !== undefined && typeof body.code !== "string") {
      throw new AppError("code must be a string.", 400);
    }
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) throw new AppError("code is required.", 400); // empty/whitespace code invalid
    if (code.length > MAX_GIFT_CODE_LENGTH) {
      throw new AppError("Gift code is too long.", 400);
    }
    const result = await giftService.redeemGift(user.id, code); // service: lookup code, expiry check, atomic redeem
    return jsonData({ redemption: result }); // frontend success state — plan months, expiry, etc.
  },
  { requireAuth: true }, // anonymous redeem attempt → 401
);
