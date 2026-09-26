import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as filesService from "@/server/services/files.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApiRouteParams<{ fileId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const result = await filesService.deleteUploadedUserFile(user.id, params.fileId);
    return jsonData(result);
  },
  { requireAuth: true },
);
