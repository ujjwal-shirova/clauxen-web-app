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
      fileId?: string;
      contentHash?: string | null;
      sizeBytes?: number;
    };

    const file = await filesService.completeUserFileUpload(user.id, {
      fileId: body.fileId ?? "",
      contentHash: body.contentHash,
      sizeBytes: body.sizeBytes,
    });

    return jsonData({ file });
  },
  { requireAuth: true },
);
