import { after } from "next/server";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as profileRepo from "@/server/repositories/profile.repository";
import * as filesService from "@/server/services/files.service";
import * as userFilesRepo from "@/server/repositories/user-files.repository";

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
      const download = await filesService.getUserFileDownloadUrl(
        user.id,
        file.id,
      );
      await profileRepo.updateProfile(user.id, { avatarUrl: download.url });
    }

    if (file.project_id) {
      file =
        (await userFilesRepo.updateUserFile(file.id, user.id, {
          status: "processing",
        })) ?? file;
      const { enqueueFileIngestion } =
        await import("@/server/services/project-ingestion.service");
      after(() => {
        return enqueueFileIngestion(file.id).catch((error) => {
          console.error("[project-ingestion] enqueue failed", error);
        });
      });
    }

    return jsonData({ file });
  },
  { requireAuth: true },
);
