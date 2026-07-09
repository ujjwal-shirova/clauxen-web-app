import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { notFound } from "@/backend/db/errors";
import * as sharesRepo from "@/backend/repositories/shares.repository";
import * as messagesRepo from "@/backend/repositories/messages.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MAX_AGE = 300;

export const GET = withApiRouteParams<{ token: string }>(
  async ({ params }) => {
    const share = await sharesRepo.getShareByToken(params.token);
    if (!share) throw notFound("Share link not found or revoked.");

    const messages = await messagesRepo.listMessagesForChat(share.chat_id);

    const response = jsonData({
      share: {
        id: share.id,
        chatId: share.chat_id,
        title: share.chat_title,
        visibility: share.visibility,
        createdAt: share.created_at,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    });

    response.headers.set(
      "Cache-Control",
      `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=60`,
    );
    return response;
  },
  { requireAuth: false },
);
