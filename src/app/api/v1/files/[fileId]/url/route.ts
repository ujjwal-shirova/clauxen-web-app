import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as filesService from "@/backend/services/files.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ fileId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const url = await filesService.getUserFileDownloadUrl(user.id, params.fileId);
    return jsonData({ url });
  },
  { requireAuth: true },
);
