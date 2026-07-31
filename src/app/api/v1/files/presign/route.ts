import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as filesService from "@/server/services/files.service";

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
      folderId?: string | null;
      purpose?: "avatar" | "library";
    };

    const presign = await filesService.presignUserFileUpload(user.id, {
      originalName: body.originalName ?? "",
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      workspaceId: body.workspaceId,
      projectId: body.projectId,
      folderId: body.folderId,
      purpose: body.purpose,
    });

    return jsonData(presign, 201);
  },
  { requireAuth: true },
);
