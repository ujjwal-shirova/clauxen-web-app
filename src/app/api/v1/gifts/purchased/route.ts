import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as giftService from "@/server/services/gift.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const gifts = await giftService.listPurchasedGifts(user.id);
    return jsonData({ gifts });
  },
  { requireAuth: true },
);
