import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as giftService from "@/server/services/gift.service";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenFromRequest(request: Request): string {
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const token = parts[parts.length - 1] ?? "";
  return decodeURIComponent(token).trim();
}

export const GET = withApiHandler(
  async ({ request }) => {
    const token = tokenFromRequest(request);
    if (!token) throw new AppError("Gift token is required.", 400);
    const gift = await giftService.getClaimPreview(token);
    return jsonData({ gift });
  },
  { requireAuth: false },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const token = tokenFromRequest(request);
    if (!token) throw new AppError("Gift token is required.", 400);
    const redemption = await giftService.claimGiftByToken(user.id, token);
    return jsonData({ redemption });
  },
  { requireAuth: true },
);
