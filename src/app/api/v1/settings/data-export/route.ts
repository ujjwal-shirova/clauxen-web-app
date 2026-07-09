import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as dataControlsService from "@/backend/services/data-controls.service";

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
