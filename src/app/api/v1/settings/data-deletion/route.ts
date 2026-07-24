import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as dataControlsService from "@/server/services/data-controls.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string | null;
      requestedScope?: string;
    };
    const result = await dataControlsService.requestDataDeletion(user.id, {
      workspaceId: body.workspaceId,
      requestedScope: body.requestedScope,
    });
    return jsonData(
      {
        request: result.request,
        verificationToken: result.verificationToken,
      },
      201,
    );
  },
  { requireAuth: true },
);
