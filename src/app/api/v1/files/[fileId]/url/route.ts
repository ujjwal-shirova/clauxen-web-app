import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as filesService from "@/server/services/files.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ fileId: string }>(
  async ({ session, params, request }) => {
    const user = requireSession(session);
    const download = await filesService.getUserFileDownloadUrl(
      user.id,
      params.fileId,
    );
    const redirect =
      new URL(request.url).searchParams.get("redirect") === "1";
    if (redirect && download.url) {
      return Response.redirect(download.url, 302);
    }
    return jsonData(download);
  },
  { requireAuth: true },
);
