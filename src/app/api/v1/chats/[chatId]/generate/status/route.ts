import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import { getChatCoordStatus } from "@/server/chat/chat-coord-client";
import { getActiveGenerationJobForChat } from "@/server/repositories/generation-jobs.repository";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only generation status used to wait a durable queued turn. */
export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");

    const [status, markedIds, job] = await Promise.all([
      getChatCoordStatus(params.chatId),
      chatsRepo.listGeneratingChatIds(user.id),
      getActiveGenerationJobForChat(params.chatId),
    ]);
    const marked = markedIds.includes(params.chatId);
    // The coordinator lease is per-slice; the job row is the durable truth
    // across chained background slices. Either one means "still working".
    const jobActive = Boolean(job && job.user_id === user.id);
    // A stale metadata flag is cleared when neither the lease nor a job is
    // live, so a finished turn does not keep spinning.
    if (!jobActive && status && !status.active && marked) {
      await chatsRepo.setChatGenerating(params.chatId, user.id, false);
    }
    const active = jobActive || (status ? status.active && marked : marked);
    return Response.json(
      {
        data: {
          active,
          stopRequested: status?.stopRequested ?? false,
          // Lets the client tell "live stream" from "background chain".
          backgrounded: jobActive,
          jobId: job?.id ?? null,
          assistantMessageId: job?.assistant_message_id ?? null,
          jobStatus: job?.status ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requireAuth: true, requireChatAuth: true },
);
