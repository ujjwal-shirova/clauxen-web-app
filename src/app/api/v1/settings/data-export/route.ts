import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as dataControlsService from "@/server/services/data-controls.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const jobs = await dataControlsService.listDataExports(user.id);
    return jsonData({ jobs });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string | null;
      exportType?: string;
    };
    const job = await dataControlsService.requestDataExport(user.id, {
      workspaceId: body.workspaceId,
      exportType: body.exportType,
    });
    return jsonData({ job }, 201);
  },
  { requireAuth: true },
);
