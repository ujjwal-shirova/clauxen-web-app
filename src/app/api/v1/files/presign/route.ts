import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as filesService from "@/backend/services/files.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      originalName?: string;
      mimeType?: string | null;
      sizeBytes?: number;
      workspaceId?: string | null;
      projectId?: string | null;
      purpose?: "avatar" | "library";
    };

    const presign = await filesService.presignUserFileUpload(user.id, {
      originalName: body.originalName ?? "",
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      workspaceId: body.workspaceId,
      projectId: body.projectId,
      purpose: body.purpose,
    });

    return jsonData(presign, 201);
  },
  { requireAuth: true },
);
