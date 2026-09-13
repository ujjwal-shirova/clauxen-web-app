import { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/config/env";

/**
 * OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document).
 *
 * Self-hosted alternative to Dynamic Client Registration: when an MCP
 * authorization server advertises `client_id_metadata_document_supported`,
 * the connector gateway uses this URL itself as `client_id` instead of
 * POSTing to a registration endpoint. The AS fetches this document to
 * validate `redirect_uris`.
 *
 * One document per connector so each install declares its exact gateway
 * callback URL — no wildcards, no shared secrets.
 */
export const dynamic = "force-dynamic";

function isConnectorKey(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,79}$/.test(value);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ connectorKey: string }> },
) {
  const { connectorKey } = await context.params;
  if (!isConnectorKey(connectorKey)) {
    return NextResponse.json(
      { error: "Invalid connector key." },
      { status: 400 },
    );
  }

  const gatewayBase = (env.connectorGatewayUrl || "").replace(/\/+$/, "");
  if (!gatewayBase.startsWith("https://")) {
    return NextResponse.json(
      { error: "Connector gateway is not configured." },
      { status: 503 },
    );
  }

  const redirectUri = `${gatewayBase}/v1/oauth/callback/${encodeURIComponent(connectorKey)}`;
  const appBase = (env.appUrl || "https://clauxen.com").replace(/\/+$/, "");
  const selfUrl = `${appBase.startsWith("http") ? appBase : `https://${appBase}`}/api/oauth/client-metadata/${encodeURIComponent(connectorKey)}`;

  return NextResponse.json(
    {
      client_id: selfUrl,
      client_name: "Clauxen",
      client_uri: appBase.startsWith("http") ? appBase : `https://${appBase}`,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Content-Type": "application/json",
      },
    },
  );
}
