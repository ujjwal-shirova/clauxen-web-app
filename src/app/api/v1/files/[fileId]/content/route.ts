import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import { getObject } from "@/server/storage/object-store";
import { notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ fileId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const file = await userFilesRepo.getUserFile(params.fileId, user.id);
    if (!file) throw notFound("File not found.");
    const purpose = file.mime_type?.startsWith("image/") ? "images" : "documents";
    const bytes = await getObject(purpose, file.storage_path, file.storage_bucket);
    const name = file.original_name.replace(/["\r\n]/g, "_");
    return new Response(Uint8Array.from(bytes), {
      headers: {
        "content-type": file.mime_type || "application/octet-stream",
        "content-length": String(bytes.byteLength),
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "private, no-store",
      },
    });
  },
  { requireAuth: true },
);
