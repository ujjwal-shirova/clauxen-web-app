import { CALLBACK_PATH, CLIENT_METADATA_PATH } from "@/server/plugins/plugin-connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/plugins/oauth-client
 *
 * OAuth Client ID Metadata Document. Authorization servers that support it
 * use this URL as Clauxen's client_id instead of dynamic registration.
 */
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      client_id: `${origin}${CLIENT_METADATA_PATH}`,
      client_name: "Clauxen",
      client_uri: origin,
      logo_uri: `${origin}/favicon.ico`,
      redirect_uris: [`${origin}${CALLBACK_PATH}`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
