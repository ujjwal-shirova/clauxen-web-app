import { withApiHandler } from "@/server/http/api-handler";
import { connectResultPage } from "@/server/plugins/connect-pages";
import { PluginOAuthError } from "@/server/plugins/oauth-discovery";
import { completePluginConnection } from "@/server/plugins/plugin-connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/plugins/callback
 *
 * Redirect target registered with every provider. Exchanges the code for
 * the provider's tokens and reports back to the Clauxen tab that opened it.
 */
export const GET = withApiHandler(
  async ({ request, session }) => {
    const appOrigin = new URL(request.url).origin;
    const params = request.nextUrl.searchParams;
    const state = params.get("state") ?? "";
    const code = params.get("code") ?? "";
    const providerError = params.get("error");

    if (providerError) {
      return connectResultPage({
        appOrigin,
        ok: false,
        title: providerError === "access_denied" ? "Connection cancelled" : "Connection failed",
        message:
          providerError === "access_denied"
            ? "No access was granted. You can try again any time."
            : (params.get("error_description") ?? "The provider could not complete the request."),
      });
    }
    if (!state || !code) {
      return connectResultPage({
        appOrigin,
        ok: false,
        title: "Connection failed",
        message: "The provider's response was incomplete. Start the connection again.",
      });
    }

    try {
      const result = await completePluginConnection({
        state,
        code,
        sessionUserId: session?.id ?? null,
      });
      return connectResultPage({
        appOrigin,
        ok: true,
        pluginId: result.pluginId,
        pluginName: result.pluginName,
        title: `${result.pluginName} connected`,
        message: "Clauxen can now use it in your chats. You can close this window.",
      });
    } catch (error) {
      return connectResultPage({
        appOrigin,
        ok: false,
        title: "Connection failed",
        message:
          error instanceof PluginOAuthError
            ? error.message
            : "The connection could not be completed. Try again.",
      });
    }
  },
  { requireAuth: false },
);
