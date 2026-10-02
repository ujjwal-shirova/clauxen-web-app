import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import { env } from "@/server/config/env";
import { resolvePluginMcpTarget } from "@/shared/lib/mcp-plugin-dataset";
import { startPluginAuthorizationFlow } from "@/server/plugins/oauth-service";
import * as repo from "@/server/repositories/plugin-connections.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/v1/plugins/connections — the user's connected plugins.
 * POST /api/v1/plugins/connections — start an MCP OAuth authorization.
 */

export const GET = withApiHandler(
  async ({ session }) => {
    const userId = session?.id || (env.authDevBypass ? "dev-user-id" : null);
    if (!userId) {
      return jsonData({ connections: [] });
    }

    const rows = await repo.listConnectionsForUser(userId);

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
  { requireAuth: false },
);

export const POST = withApiHandler(
  async ({ request, session }) => {
    const userId = session?.id || (env.authDevBypass ? "dev-user-id" : "guest-user");

    const body = (await request.json().catch(() => ({}))) as {
      pluginId?: unknown;
      returnUrl?: unknown;
    };

    const pluginId =
      typeof body.pluginId === "string" ? body.pluginId.trim() : "";
    if (!pluginId) {
      throw new AppError("pluginId is required.", 400, "invalid_request");
    }

    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "localhost:9002";
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const appOrigin = `${proto}://${host}`;

    const returnUrl =
      typeof body.returnUrl === "string" && body.returnUrl.trim()
        ? body.returnUrl.trim()
        : `${appOrigin}/plugins`;

    // 1. If an external worker is configured and responding, try it first
    if (env.pluginOAuthWorkerUrl && env.pluginOAuthInternalToken) {
      try {
        const target = await resolvePluginMcpTarget(pluginId);
        if (target) {
          const res = await fetch(`${env.pluginOAuthWorkerUrl}/v0/oauth/start`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-clauxen-internal-token": env.pluginOAuthInternalToken,
            },
            body: JSON.stringify({
              userId,
              pluginId: target.pluginId,
              pluginName: target.name,
              pluginIconUrl: target.iconUrl,
              mcpUrl: target.mcpUrl,
              returnUrl,
            }),
            signal: AbortSignal.timeout(4_000),
          });
          const payload = (await res.json().catch(() => null)) as {
            data?: { authorizeUrl?: string };
          } | null;
          if (res.ok && payload?.data?.authorizeUrl) {
            return jsonData({
              authorizeUrl: payload.data.authorizeUrl,
              plugin: {
                pluginId: target.pluginId,
                name: target.name,
                iconUrl: target.iconUrl,
                mcpUrl: target.mcpUrl,
              },
            });
          }
        }
      } catch (err) {
        console.warn("External oauth worker unavailable, using native flow:", err);
      }
    }

    // 2. Native OAuth 2.1 & Platform authorization flow
    const result = await startPluginAuthorizationFlow({
      userId,
      pluginId,
      returnUrl,
      appOrigin,
    });

    return jsonData(result);
  },
  { requireAuth: false },
);
