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
      folderId?: string | null;
      purpose?: "avatar" | "library" | "chat-attachment" | "project-source";
      chatId?: string | null;
      projectId?: string | null;
      sourceKind?: string | null;
    };

    const presign = await filesService.presignUserFileUpload(user.id, {
      originalName: body.originalName ?? "",
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      workspaceId: body.workspaceId,
      folderId: body.folderId,
      purpose: body.purpose,
      chatId: body.chatId,
      projectId: body.projectId,
      sourceKind: body.sourceKind,
    });

    return jsonData(presign, 201);
  },
  { requireAuth: true },
);
