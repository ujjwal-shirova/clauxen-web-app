import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import { env } from "@/backend/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function pickComponent(
  components: AddressComponent[],
  type: string,
  useShort = false,
): string {
  const match = components.find((c) => c.types.includes(type));
  if (!match) return "";
  return useShort ? match.short_name : match.long_name;
}

/**
 * Resolves a Google place_id into structured Indian billing address fields.
 */
export const POST = withApiHandler(
  async ({ session, request }) => {
    requireSession(session);

    if (!env.googlePlacesApiKey) {
      throw new AppError(
        "Address suggestions are not configured.",
        503,
        "places_unavailable",
      );
    }

    const body = (await request.json()) as { placeId?: string };
    const placeId =
      typeof body.placeId === "string" ? body.placeId.trim() : "";
    if (!placeId || placeId.length > 256 || !/^[\w-]+$/.test(placeId)) {
      throw new AppError("Invalid place id.", 400, "bad_request");
    }

    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json",
    );
    url.searchParams.set("place_id", placeId);
    url.searchParams.set(
      "fields",
      "address_component,formatted_address,name",
    );
    url.searchParams.set("language", "en");
    url.searchParams.set("key", env.googlePlacesApiKey);

    const res = await fetch(url.toString(), { method: "GET" });
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      result?: {
        formatted_address?: string;
        name?: string;
        address_components?: AddressComponent[];
      };
    };

    if (data.status !== "OK" || !data.result?.address_components) {
      throw new AppError(
        data.error_message || "Could not resolve address.",
        502,
        "places_error",
      );
    }

    const components = data.result.address_components;
    const streetNumber = pickComponent(components, "street_number");
    const route = pickComponent(components, "route");
    const premise = pickComponent(components, "premise");
    const sublocality =
      pickComponent(components, "sublocality_level_1") ||
      pickComponent(components, "sublocality") ||
      pickComponent(components, "neighborhood");

    const line1Parts = [streetNumber, route || premise].filter(Boolean);
    const addressLine1 =
      line1Parts.join(" ").trim() ||
      data.result.name ||
      data.result.formatted_address?.split(",")[0]?.trim() ||
      "";

    const addressLine2 = sublocality;
    const city =
      pickComponent(components, "locality") ||
      pickComponent(components, "administrative_area_level_2") ||
      "";
    const state = pickComponent(components, "administrative_area_level_1");
    const pin = pickComponent(components, "postal_code");
    const countryCode =
      pickComponent(components, "country", true).toUpperCase() || "IN";

    return jsonData({
      address: {
        addressLine1,
        addressLine2,
        city,
        state,
        pin,
        countryCode: countryCode === "IN" ? "IN" : countryCode,
        formattedAddress: data.result.formatted_address ?? "",
      },
    });
  },
  { requireAuth: true },
);
