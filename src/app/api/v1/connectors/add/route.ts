import { requireSession } from "@/server/auth/require-session";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import { isRestConnectorId } from "@/connectors/catalog/rest-directory";
import {
  connectorGatewayConfigured,
  installMcpPlugin,
  startConnectorOAuth,
} from "@/connectors/server/gateway";
import {
  installRestConnectorLocal,
  REST_ACCESS_TOKEN_HINT,
} from "@/connectors/server/rest-local";
import { installMcpPluginLocal } from "@/connectors/server/plugins/install-local";
import { getPluginById } from "@/connectors/server/plugins/catalog";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeReturnPath(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.startsWith("/")) return value;
  return fallback;
}

function canFallbackToLocalToken(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  return (
    error.status === 503 ||
    error.status === 502 ||
    [
      "connector_service_unavailable",
      "connector_gateway_required",
      "connector_not_configured",
      "connector_request_failed",
      "connector_gateway_invalid_response",
    ].includes(error.code)
  );
}

function restTokenRequired(connectorId: string): AppError {
  return new AppError(
    REST_ACCESS_TOKEN_HINT[connectorId] ||
      "This app needs an access token to connect.",
    409,
    "plugin_api_key_required",
  );
}

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AppError("JSON object required.", 400, "invalid_json");
    }

    const connectorId =
      typeof body.connectorId === "string"
        ? body.connectorId.trim()
        : typeof body.pluginId === "string"
          ? body.pluginId.trim()
          : "";
    if (!connectorId) {
      throw new AppError("connectorId is required.", 400, "invalid_body");
    }

    const returnPath = safeReturnPath(
      body.returnPath,
      `/connectors/${encodeURIComponent(connectorId)}`,
    );
    const returnUrl = new URL(returnPath, env.appUrl);
    const apiKey =
      typeof body.apiKey === "string" ? body.apiKey.trim().slice(0, 1000) : "";

    if (isRestConnectorId(connectorId)) {
      if (apiKey) {
        const local = await installRestConnectorLocal(
          user.id,
          connectorId,
          apiKey,
        );
        return jsonData({
          status: "connected" as const,
          connectorKey: local.connectorKey,
          installationId: local.installationId,
          authorizeUrl: null,
          toolCount: local.toolCount,
          accountLabel: local.accountLabel,
        });
      }

      if (connectorGatewayConfigured()) {
        try {
          returnUrl.searchParams.set("connector", connectorId);
          const result = await startConnectorOAuth(user.id, {
            connectorKey: connectorId,
            workspaceId:
              typeof body.workspaceId === "string" ? body.workspaceId : null,
            returnUrl: returnUrl.toString(),
          });
          return jsonData({
            status: "authorization_required" as const,
            connectorKey: connectorId,
            installationId: null,
            authorizeUrl: result.authorizeUrl,
            expiresIn: result.expiresIn,
          });
        } catch (error) {
          if (!canFallbackToLocalToken(error)) throw error;
        }
      }

      throw restTokenRequired(connectorId);
    }

    const plugin = await getPluginById(connectorId);
    if (!plugin?.mcpUrl) {
      throw new AppError(
        "This connector is not available to add.",
        404,
        "plugin_not_found",
      );
    }
    returnUrl.searchParams.set("plugin", plugin.id);

    if (connectorGatewayConfigured()) {
      try {
        const result = await installMcpPlugin(user.id, {
          pluginId: plugin.id,
          displayName: plugin.displayName || plugin.name,
          mcpUrl: plugin.mcpUrl,
          logoUrl: plugin.logoUrl || null,
          returnUrl: returnUrl.toString(),
          apiKey: apiKey || null,
        });
        return jsonData(result);
      } catch (error) {
        if (!canFallbackToLocalToken(error)) throw error;
      }
    }

    const local = await installMcpPluginLocal(user.id, {
      pluginId: plugin.id,
      displayName: plugin.displayName || plugin.name,
      mcpUrl: plugin.mcpUrl,
      logoUrl: plugin.logoUrl || null,
      apiKey: apiKey || null,
    });
    if (local.status === "connected") {
      return jsonData({
        status: "connected" as const,
        connectorKey: local.connectorKey,
        installationId: local.installationId,
        authorizeUrl: null,
        toolCount: local.toolCount,
        skillCount: local.skillCount,
      });
    }
    if (local.status === "authorization_required") {
      throw new AppError(
        "This connector needs an access token or API key to connect.",
        409,
        "plugin_api_key_required",
      );
    }
    throw new AppError(
      "This connector needs an API key to connect.",
      409,
      "plugin_api_key_required",
    );
  },
  { requireAuth: true },
);
