import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingProfile from "@/server/services/billing-profile.service";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const address = await billingProfile.getBillingAddressForUser(user.id);
    return jsonData({ address });
  },
  { requireAuth: true },
);

export const PUT = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      fullName?: string;
      countryCode?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      phone?: string | null;
      notify?: boolean;
    };

    if (
      !body.fullName ||
      !body.addressLine1 ||
      !body.city ||
      !body.state ||
      !body.postalCode
    ) {
      throw new AppError(
        "fullName, addressLine1, city, state, and postalCode are required.",
        400,
        "bad_request",
      );
    }

    const address = await billingProfile.upsertBillingAddressForUser(user.id, {
      fullName: body.fullName,
      countryCode: body.countryCode || "IN",
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      phone: body.phone,
      notify: body.notify !== false,
    });

    return jsonData({ address });
  },
  { requireAuth: true },
);
