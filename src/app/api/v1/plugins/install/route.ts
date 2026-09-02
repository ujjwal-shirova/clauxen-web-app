import { requireSession } from "@/server/auth/require-session";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import { installMcpPlugin } from "@/server/connectors/gateway";
import { getPluginById } from "@/server/plugins/catalog";
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
      typeof body.returnPath === "string" &&
      body.returnPath.startsWith("/plugins")
        ? body.returnPath
        : "/plugins";
    const returnUrl = new URL(returnPath, env.appUrl);
    returnUrl.searchParams.set("plugin", plugin.id);

    const result = await installMcpPlugin(user.id, {
      pluginId: plugin.id,
      displayName: plugin.displayName || plugin.name,
      mcpUrl: plugin.mcpUrl,
      logoUrl: plugin.logoUrl || null,
      returnUrl: returnUrl.toString(),
    });
    return jsonData(result);
  },
  { requireAuth: true },
);
