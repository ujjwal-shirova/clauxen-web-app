import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { readLiveTurn } from "@/server/chat/chat-coord-client";
import { getActiveGenerationJobForChat } from "@/server/repositories/generation-jobs.repository";
import { buildAssistantTranscriptRecord } from "@/server/training/transcript-format";
import { queryOne } from "@/server/db/pool";
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
    const [turn, job] = await Promise.all([
      readLiveTurn(params.chatId),
      getActiveGenerationJobForChat(params.chatId),
    ]);
    if (!job) {
      if (turn?.userId !== user.id) return jsonData({ turn: null });
      const saved = await queryOne<{
        content: string;
        content_json: unknown;
        status: string;
        updated_at: string;
      }>(
        `select content, content_json, status, updated_at from public.chat_messages
         where id = $1 and chat_id = $2 and user_id = $3 and role = 'assistant'`,
        [turn.assistantId, params.chatId, user.id],
      );
      // Terminal Postgres state always wins over a stale live mirror.
      if (saved && ["complete", "failed", "cancelled"].includes(saved.status)) {
        return jsonData({
          turn: {
            ...turn,
            answer: saved.content ?? "",
            contentJson: saved.content_json,
            status: saved.status,
            updatedAt: new Date(saved.updated_at).getTime(),
          },
        });
      }
      return jsonData({ turn: null });
    }
    const identity = {
      assistantClientId: job.input.turn?.assistantClientId,
      userMessageId: job.user_message_id,
      userClientId: job.input.turn?.userClientId,
    };
    if (
      turn?.userId === user.id &&
      turn.assistantId === job.assistant_message_id &&
      turn.status === "running"
    ) {
      return jsonData({ turn: { ...turn, ...identity } });
    }
    const checkpoint = job.checkpoint ?? {};
    const assistantId =
      job.assistant_message_id ?? checkpoint.assistantMessageId ?? null;
    if (!assistantId) {
      return jsonData({ turn: null });
    }
    const partial = await queryOne<{
      content: string;
      content_json: unknown;
      updated_at: string;
    }>(
      `select content, content_json, updated_at from public.chat_messages
       where id = $1 and chat_id = $2 and user_id = $3 and status = 'streaming'`,
      [assistantId, params.chatId, user.id],
    );
    if (partial)
      return jsonData({
        turn: {
          ...identity,
          chatId: params.chatId,
          userId: user.id,
          assistantId,
          status: "running",
          answer: partial.content ?? "",
          contentJson: partial.content_json,
          updatedAt: new Date(partial.updated_at).getTime(),
        },
      });
    const answer =
      typeof checkpoint.answer === "string" ? checkpoint.answer : "";
    return jsonData({
      turn: {
        ...identity,
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
        updatedAt: new Date(job.updated_at).getTime(),
      },
    });
  },
  { requireAuth: true, requireChatAuth: true },
);
