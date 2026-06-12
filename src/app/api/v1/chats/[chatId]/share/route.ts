import { withApiRouteParams } from "@/backend/http/route-params"; // chatId URL param inject
import { jsonData } from "@/backend/http/api-response"; // { data } JSON response
import { requireSession } from "@/backend/auth/require-session"; // session → user id
import { env } from "@/backend/config/env"; // trusted app base URL — Host header spoofing avoid
import * as chatsRepo from "@/backend/repositories/chats.repository"; // chat ownership verify
import * as sharesRepo from "@/backend/repositories/shares.repository"; // share rows create/revoke/read
import { AppError, notFound } from "@/backend/db/errors"; // validation + chat/share missing → 400/404

const SHARE_VISIBILITIES = ["link", "workspace", "public"] as const;
type ShareVisibility = (typeof SHARE_VISIBILITIES)[number];

function shareBaseUrl() {
  return env.appUrl.replace(/\/$/, "");
}

function resolveShareVisibility(
  visibility: string | undefined,
): ShareVisibility {
  if (visibility == null) return "link";
  if ((SHARE_VISIBILITIES as readonly string[]).includes(visibility)) {
    return visibility as ShareVisibility;
  }
  throw new AppError("Invalid share visibility.", 400);
}

export const runtime = "nodejs"; // Node.js runtime
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const chat = await chatsRepo.getChatForUser(params.chatId, user.id); // owner check — scoped SELECT
    if (!chat) throw notFound("Chat not found.");

    const share = await sharesRepo.getActiveShareForChat(
      params.chatId,
      user.id,
    ); // revoked shares ignore
    if (!share) {
      return jsonData({ share: null, shareUrl: null, visibility: "private" });
    }

    const origin = shareBaseUrl();
    const token = share.metadata?.token as string | undefined; // opaque link token
    return jsonData({
      share,
      shareUrl: token ? `${origin}/share/${token}` : null, // token missing → URL null
      visibility: share.visibility,
    });
  },
  { requireAuth: true },
);

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");

    const body = (await request.json().catch(() => ({}))) as {
      visibility?: "link" | "workspace" | "public";
      revoke?: boolean;
    }; // invalid JSON → empty object — revoke-only calls safe

    if (body.revoke) {
      const existing = await sharesRepo.getActiveShareForChat(
        params.chatId,
        user.id,
      );
      if (existing) {
        await sharesRepo.revokeConversationShare(existing.id, user.id); // share row inactive
      }
      return jsonData({ share: null, shareUrl: null, visibility: "private" }); // private state restore
    }

    const origin = shareBaseUrl();
    const existing = await sharesRepo.getActiveShareForChat(
      params.chatId,
      user.id,
    );
    if (existing) {
      const token = existing.metadata?.token as string | undefined;
      return jsonData({
        share: existing,
        shareUrl: token ? `${origin}/share/${token}` : null,
        visibility: existing.visibility,
      });
    }

    const created = await sharesRepo.createConversationShare({
      userId: user.id,
      chatId: params.chatId,
      visibility: resolveShareVisibility(body.visibility),
      baseUrl: origin,
    }); // DB insert + token generate

    if (!created.share) {
      throw notFound("Unable to create share link.");
    }

    return jsonData(
      {
        share: created.share,
        shareUrl: created.shareUrl,
        visibility: created.share.visibility,
      },
      201,
    );
  },
  { requireAuth: true },
);
