import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingService from "@/server/services/billing.service";
import { retryQueuedGiftsForPurchaser } from "@/server/services/gift.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    await retryQueuedGiftsForPurchaser(user.id).catch((err) => {
      console.warn("[gift] queued retry skipped", err);
    });
    const overview = await billingService.getBillingOverview(user.id);
    return jsonData(overview);
  },
  { requireAuth: true },
);
