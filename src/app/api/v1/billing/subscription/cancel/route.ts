import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingService from "@/server/services/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const result = await billingService.cancelSubscription(user.id);
    return jsonData(result);
  },
  { requireAuth: true },
);
