import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { defaultCurrencyForCountry } from "@/lib/checkout-currency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ request }) => {
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code") ??
    "IN";

  const currency = defaultCurrencyForCountry(country);

  return jsonData({
    countryCode: country.trim().toUpperCase().slice(0, 2),
    currency,
  });
});
