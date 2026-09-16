import { requireSession } from "@/server/auth/require-session";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import {
  connectorGatewayConfigured,
  installMcpPlugin,
} from "@/connectors/server/gateway";
import { installMcpPluginLocal } from "@/connectors/server/plugins/install-local";
import { getPluginById } from "@/connectors/server/plugins/catalog";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AppError("JSON object required.", 400, "invalid_json");
    }
    const pluginId =
      typeof body.pluginId === "string" ? body.pluginId.trim() : "";
    if (!pluginId) {
      throw new AppError("pluginId is required.", 400, "invalid_body");
    }
    const plugin = await getPluginById(pluginId);
    if (!plugin?.mcpUrl) {
      throw new AppError(
        "This plugin is not available for MCP install.",
        404,
        "plugin_not_found",
      );
    }
    const returnPath =
      typeof body.returnPath === "string" && body.returnPath.startsWith("/")
        ? body.returnPath
        : "/new";
    const returnUrl = new URL(returnPath, env.appUrl);
    returnUrl.searchParams.set("plugin", plugin.id);
    const apiKey =
      typeof body.apiKey === "string" ? body.apiKey.trim().slice(0, 1000) : "";

    if (connectorGatewayConfigured()) {
      const result = await installMcpPlugin(user.id, {
        pluginId: plugin.id,
        displayName: plugin.displayName || plugin.name,
        mcpUrl: plugin.mcpUrl,
        logoUrl: plugin.logoUrl || null,
        returnUrl: returnUrl.toString(),
        apiKey: apiKey || null,
      });
      return jsonData(result);
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
        "This plugin needs sign-in through the connector gateway, which isn't configured on this deployment.",
        503,
        "connector_gateway_required",
      );
    }
    throw new AppError(
      "This plugin needs an API key to connect.",
      409,
      "plugin_api_key_required",
    );
  },
  { requireAuth: true },
);
