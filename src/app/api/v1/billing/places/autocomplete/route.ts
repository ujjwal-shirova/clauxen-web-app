import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import { env } from "@/backend/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

/**
 * Proxies Google Places Autocomplete (India) so the Maps key stays server-side.
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

    const body = (await request.json()) as { input?: string };
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (input.length < 2 || input.length > 200) {
      return jsonData({ suggestions: [] as const });
    }

    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json",
    );
    url.searchParams.set("input", input);
    url.searchParams.set("components", "country:in");
    url.searchParams.set("language", "en");
    url.searchParams.set("key", env.googlePlacesApiKey);

    const res = await fetch(url.toString(), { method: "GET" });
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      predictions?: GoogleAutocompletePrediction[];
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new AppError(
        data.error_message || "Could not fetch address suggestions.",
        502,
        "places_error",
      );
    }

    const suggestions = (data.predictions ?? []).slice(0, 6).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text ?? p.description,
      secondaryText: p.structured_formatting?.secondary_text ?? "",
    }));

    return jsonData({ suggestions });
  },
  { requireAuth: true },
);
