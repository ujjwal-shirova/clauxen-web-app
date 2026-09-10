import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { defaultCurrencyForCountry } from "@/lib/checkout-currency";
import { resolveIpCountry } from "@/server/billing/checkout-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ request }) => {
  const countryCode = resolveIpCountry(request.headers);
  const currency = defaultCurrencyForCountry(countryCode);

  return jsonData({
    countryCode,
    currency,
  });
});
