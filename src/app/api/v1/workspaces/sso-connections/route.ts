// Response: { workspace, connections } — SAML/OIDC provider metadata (secrets masked)
// =============================================================================

import { withApiHandler } from "@/server/http/api-handler"; // session inject + centralized error mapping
import { jsonData } from "@/server/http/api-response"; // { data: ... } success JSON envelope
import type { SsoConnectionRow } from "@/server/repositories/workspaces.repository"; // SSO row shape — settings redaction typing
import * as workspaceService from "@/server/services/workspace.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENSITIVE_SETTING_KEY =
  /secret|password|token|private|credential|certificate|signing|key/i;

function redactSsoSettings(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (SENSITIVE_SETTING_KEY.test(key)) {
      redacted[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactSsoSettings(value as Record<string, unknown>);
      continue;
    }
    redacted[key] = value;
  }
  return redacted;
}

function toPublicSsoConnection(connection: SsoConnectionRow) {
  return {
    id: connection.id,
    workspace_id: connection.workspace_id,
    provider: connection.provider,
    issuer_url: connection.issuer_url,
    metadata_url: connection.metadata_url,
    entity_id: connection.entity_id,
    status: connection.status,
    settings: redactSsoSettings(connection.settings ?? {}),
    created_at: connection.created_at,
    updated_at: connection.updated_at,
  };
}

export const GET = withApiHandler(
  async ({ session }) => {
    const result = await workspaceService.listCurrentSsoConnections(session);
    const response = jsonData({
      workspace: result.workspace,
      connections: result.connections.map(toPublicSsoConnection),
    });
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("Pragma", "no-cache");
    return response;
  },
  { requireAuth: true }, // anonymous caller → 401 unauthorized
);
