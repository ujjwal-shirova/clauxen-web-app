import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingProfile from "@/server/services/billing-profile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const paymentMethods = await billingProfile.listPaymentMethodsForUser(user.id);
    return jsonData({ paymentMethods });
  },
  { requireAuth: true },
);
