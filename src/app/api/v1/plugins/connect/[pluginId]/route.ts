import { withApiRouteParams } from "@/server/http/route-params";
import { connectResultPage } from "@/server/plugins/connect-pages";
import { PluginOAuthError } from "@/server/plugins/oauth-discovery";
import { startPluginConnection } from "@/server/plugins/plugin-connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/plugins/connect/:pluginId
 *
 * Opened directly in the connect popup. Redirects to the provider's own
 * consent screen, or connects immediately when no authorization is needed.
 */
export const GET = withApiRouteParams<{ pluginId: string }>(
  async ({ request, session, params }) => {
    const appOrigin = new URL(request.url).origin;
    const pluginId = params.pluginId;

    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return connectResultPage({
        appOrigin,
        ok: false,
        pluginId,
        title: "Start from Clauxen",
        message: "Open the plugin in Clauxen and choose Connect to continue.",
      });
    }
    if (!session) {
      return connectResultPage({
        appOrigin,
        ok: false,
        pluginId,
        title: "Sign in required",
        message: "Sign in to Clauxen, then connect the plugin again.",
      });
    }

    try {
      const result = await startPluginConnection({
        userId: session.id,
        pluginId,
        appOrigin,
      });
      if (result.type === "redirect") {
        return new Response(null, {
          status: 302,
          headers: {
            location: result.url,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          },
        });
      }
      return connectResultPage({
        appOrigin,
        ok: true,
        pluginId: result.pluginId,
        pluginName: result.pluginName,
        title: `${result.pluginName} connected`,
        message: "You can close this window and return to Clauxen.",
      });
    } catch (error) {
      return connectResultPage({
        appOrigin,
        ok: false,
        pluginId,
        title: "Couldn't start the connection",
        message:
          error instanceof PluginOAuthError
            ? error.message
            : "Something went wrong while contacting the provider. Try again.",
      });
    }
  },
  { requireAuth: false },
);
