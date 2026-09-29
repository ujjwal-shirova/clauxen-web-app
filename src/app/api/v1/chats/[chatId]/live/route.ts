import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { readLiveTurn } from "@/server/chat/chat-coord-client";
import { getActiveGenerationJobForChat } from "@/server/repositories/generation-jobs.repository";
import { buildAssistantTranscriptRecord } from "@/server/training/transcript-format";
import { notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live agent trace while a turn runs. Served from the Cloudflare Durable
 * Object when fresh, with the durable Postgres job checkpoint as fallback —
 * background slices keep both warm, so polling works from any device.
 */
export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");
    const turn = await readLiveTurn(params.chatId);
    if (turn) {
      if (turn.userId !== user.id) {
        return jsonData({ turn: null });
      }
      return jsonData({ turn });
    }

    // Coordinator unreachable or trace expired: rebuild the live view from
    // the durable job checkpoint (round-boundary state, at most one round
    // behind the model).
    const job = await getActiveGenerationJobForChat(params.chatId).catch(
      () => null,
    );
    if (!job || job.user_id !== user.id) {
      return jsonData({ turn: null });
    }
    const checkpoint = job.checkpoint ?? {};
    const assistantId =
      job.assistant_message_id ?? checkpoint.assistantMessageId ?? null;
    if (!assistantId) {
      return jsonData({ turn: null });
    }
    const answer =
      typeof checkpoint.answer === "string" ? checkpoint.answer : "";
    return jsonData({
      turn: {
        chatId: params.chatId,
        userId: user.id,
        assistantId,
        status: "running",
        answer,
        contentJson: buildAssistantTranscriptRecord({
          answer,
          thinking:
            typeof checkpoint.thinking === "string" ? checkpoint.thinking : "",
          tools: Array.isArray(checkpoint.tools) ? checkpoint.tools : [],
          agentUi: {
            status: "streaming",
            startedAtMs: checkpoint.turnStartedAtMs,
            modelTurns: Array.isArray(checkpoint.modelTurns)
              ? checkpoint.modelTurns
              : [],
            segments: Array.isArray(checkpoint.segments)
              ? checkpoint.segments
              : [],
          },
        }),
        updatedAt: Date.now(),
      },
    });
  },
  { requireAuth: true, requireChatAuth: true },
);
