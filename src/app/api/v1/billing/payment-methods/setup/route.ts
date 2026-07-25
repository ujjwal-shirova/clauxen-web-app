import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingProfile from "@/server/services/billing-profile.service";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as { method?: string };
    const method = body.method === "upi" ? "upi" : body.method === "card" ? "card" : null;
    if (!method) {
      throw new AppError('method must be "card" or "upi".', 400, "bad_request");
    }
    if (!user.email) {
      throw new AppError("Account email is required.", 400, "bad_request");
    }

    const setup = await billingProfile.startPaymentMethodSetup({
      userId: user.id,
      email: user.email,
      name: user.displayName ?? user.preferredName ?? null,
      method,
    });

    return jsonData({ setup });
  },
  { requireAuth: true },
);
