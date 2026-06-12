import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as billingService from "@/backend/services/billing.service";

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
