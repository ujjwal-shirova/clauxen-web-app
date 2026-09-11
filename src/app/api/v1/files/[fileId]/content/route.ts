import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import * as filesService from "@/server/services/files.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ fileId: string }>(
  async ({ session, params, request }) => {
    const user = requireSession(session);
    const { file, bytes } = await filesService.readUserFileBytes(
      user.id,
      params.fileId,
    );
    const name = file.original_name.replace(/["\r\n]/g, "_");
    const mime = file.mime_type || "application/octet-stream";
    const forceDownload =
      new URL(request.url).searchParams.get("download") === "1";
    const inline =
      !forceDownload &&
      (mime.startsWith("image/") || mime.startsWith("video/"));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": mime,
        "content-length": String(bytes.byteLength),
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
        "cache-control": "private, max-age=3600",
      },
    });
  },
  { requireAuth: true },
);
