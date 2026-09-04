import { withApiRouteParams } from "@/server/http/route-params";
import { notFound } from "@/server/db/errors";
import { isAvatarUserId } from "@/lib/avatar-url";
import * as avatarService from "@/server/services/avatar.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ userId: string }>(
  async ({ params, request }) => {
    if (!isAvatarUserId(params.userId)) {
      throw notFound("Avatar not found.");
    }

    const avatar = await avatarService.getAvatarBytes(params.userId);
    if (!avatar) throw notFound("Avatar not found.");

    const version = new URL(request.url).searchParams.get("v");
    const headers = new Headers({
      "content-type": avatar.contentType,
      "content-length": String(avatar.body.byteLength),
      "cache-control": version
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300, stale-while-revalidate=86400",
    });
    if (avatar.contentHash) {
      headers.set("etag", `"${avatar.contentHash}"`);
    }

    return new Response(Uint8Array.from(avatar.body), { headers });
  },
  { requireAuth: false },
);
