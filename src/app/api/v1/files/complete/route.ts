import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as filesService from "@/server/services/files.service";
import * as avatarService from "@/server/services/avatar.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      fileId?: string;
      contentHash?: string | null;
      sizeBytes?: number;
    };

    let file = await filesService.completeUserFileUpload(user.id, {
      fileId: body.fileId ?? "",
      contentHash: body.contentHash,
      sizeBytes: body.sizeBytes,
    });

    const purpose =
      file.metadata &&
      typeof file.metadata === "object" &&
      (file.metadata as Record<string, unknown>).purpose === "avatar"
        ? "avatar"
        : null;

    if (purpose === "avatar") {
      await avatarService.attachUploadedAvatar(user.id, file.id);
    }

    return jsonData({ file });
  },
  { requireAuth: true },
);
