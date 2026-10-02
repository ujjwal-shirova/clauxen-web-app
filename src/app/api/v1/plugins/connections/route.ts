import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError, notFound } from "@/server/db/errors";
import { env } from "@/server/config/env";
import { resolvePluginMcpTarget } from "@/lib/mcp-plugin-dataset";
import * as repo from "@/server/repositories/plugin-connections.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/v1/plugins/connections — the user's connected plugins.
 * POST /api/v1/plugins/connections — start an MCP OAuth authorization.
 *
 * POST resolves the plugin's remote MCP endpoint, then asks the plugin-oauth
 * Cloudflare worker to begin the OAuth 2.1 dance and returns the provider
 * authorization URL for the client to open in a new tab.
 */

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const rows = await repo.listConnectionsForUser(user.id);

    return jsonData({
      connections: rows.map((row) => ({
        id: row.id,
        pluginId: row.plugin_id,
        pluginName: row.plugin_name,
        pluginIconUrl: row.plugin_icon_url,
        mcpUrl: row.mcp_url,
        status: row.status,
        grantedScopes: row.granted_scopes,
        connectedAt: row.connected_at,
        lastUsedAt: row.last_used_at,
      })),
    });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ request, session }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      pluginId?: unknown;
      returnUrl?: unknown;
    };

    const pluginId =
      typeof body.pluginId === "string" ? body.pluginId.trim() : "";
    if (!pluginId) {
      throw new AppError("pluginId is required.", 400, "invalid_request");
    }

    if (!env.pluginOAuthWorkerUrl || !env.pluginOAuthInternalToken) {
      throw new AppError(
        "Plugin authorization is not configured on this deployment.",
        503,
        "plugin_oauth_unavailable",
      );
    }

    const target = await resolvePluginMcpTarget(pluginId);
    if (!target) {
      throw notFound("This plugin does not expose a connectable MCP server.");
    }

    const returnUrl =
      typeof body.returnUrl === "string" && body.returnUrl.trim()
        ? body.returnUrl.trim()
        : `${env.appUrl}/plugins`;

    const response = await fetch(`${env.pluginOAuthWorkerUrl}/v0/oauth/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-clauxen-internal-token": env.pluginOAuthInternalToken,
      },
      body: JSON.stringify({
        userId: user.id,
        pluginId: target.pluginId,
        pluginName: target.name,
        pluginIconUrl: target.iconUrl,
        mcpUrl: target.mcpUrl,
        returnUrl,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const payload = (await response.json().catch(() => null)) as {
      data?: { authorizeUrl?: string };
      error?: { message?: string };
    } | null;

    if (!response.ok || !payload?.data?.authorizeUrl) {
      throw new AppError(
        payload?.error?.message ?? "Could not start plugin authorization.",
        502,
        "plugin_oauth_start_failed",
      );
    }

    return jsonData({
      authorizeUrl: payload.data.authorizeUrl,
      plugin: {
        pluginId: target.pluginId,
        name: target.name,
        iconUrl: target.iconUrl,
        mcpUrl: target.mcpUrl,
      },
    });
  },
  { requireAuth: true },
);
