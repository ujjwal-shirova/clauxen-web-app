import { after } from "next/server";
import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import * as chatService from "@/backend/services/chat.service";
import { sanitizeMessages } from "@/backend/inference/novita";
import { AppError } from "@/backend/db/errors";
import { resolveRequestCountryCode } from "@/lib/request-geo";
import { parseHomerReasoningEffort } from "@/lib/model-effort";
import { CLAUXEN_STREAM_HEADERS } from "@/backend/inference/clauxen-sse-stream";
import {
  beginChatGeneration,
  endChatGeneration,
} from "@/backend/chat/generation-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      messages?: unknown;
      turn?: {
        content?: unknown;
        modelContent?: unknown;
        fileIds?: unknown;
        userClientId?: unknown;
        assistantClientId?: unknown;
      };
      generateChatTitle?: boolean;
      chatModel?: string;
      homerReasoningEffort?: string;
    };
    const messages = sanitizeMessages(body.messages);
    if (!messages.length) {
      throw new AppError("messages are required.", 400);
    }

    const rawTurn = body.turn;
    const turn = rawTurn
      ? {
          content:
            typeof rawTurn.content === "string" ? rawTurn.content.trim() : "",
          modelContent:
            typeof rawTurn.modelContent === "string"
              ? rawTurn.modelContent.trim()
              : undefined,
          fileIds: Array.isArray(rawTurn.fileIds)
            ? rawTurn.fileIds.filter(
                (fileId): fileId is string => typeof fileId === "string",
              )
            : undefined,
          userClientId:
            typeof rawTurn.userClientId === "string"
              ? rawTurn.userClientId.trim()
              : "",
          assistantClientId:
            typeof rawTurn.assistantClientId === "string"
              ? rawTurn.assistantClientId.trim()
              : "",
        }
      : undefined;
    if (
      turn &&
      (!turn.content ||
        !turn.userClientId ||
        !turn.assistantClientId ||
        turn.userClientId.length > 160 ||
        turn.assistantClientId.length > 160)
    ) {
      throw new AppError("Invalid chat turn identifiers.", 400, "invalid_turn");
    }

    // Durable generations are only stopped explicitly. A duplicate request
    // must never abort an existing turn and create a second assistant row.
    const generationController = beginChatGeneration(params.chatId);
    if (!generationController) {
      throw new AppError(
        "This chat is already generating a response.",
        409,
        "generation_in_progress",
      );
    }

    let finishOnce: (() => Promise<void>) | null = null;

    try {
      const { stream, onComplete, userMessageId, assistantMessageId } =
        await chatService.streamChatGeneration({
          chatId: params.chatId,
          userId: user.id,
          messages,
          turn,
          signal: generationController.signal,
          userCountryCode: resolveRequestCountryCode(request.headers),
          generateChatTitle: body.generateChatTitle,
          chatModel: body.chatModel,
          homerReasoningEffort: parseHomerReasoningEffort(
            body.homerReasoningEffort,
          ),
        });

      let finished = false;
      finishOnce = async () => {
        if (finished) return;
        finished = true;
        try {
          await onComplete();
        } finally {
          endChatGeneration(params.chatId, generationController);
        }
      };

      // Keep the isolate alive until DB persist finishes (tab close safe).
      after(() => {
        void finishOnce?.();
      });

      const wrapped = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              try {
                controller.enqueue(value);
              } catch {
                // Client disconnected — drain the rest so onComplete can persist.
                while (true) {
                  const next = await reader.read();
                  if (next.done) break;
                }
                break;
              }
            }
            try {
              controller.close();
            } catch {
              // already closed
            }
          } catch (error) {
            try {
              controller.error(error);
            } catch {
              // already closed
            }
          } finally {
            await finishOnce?.();
          }
        },
      });

      return new Response(wrapped, {
        headers: {
          ...CLAUXEN_STREAM_HEADERS,
          ...(userMessageId
            ? { "X-User-Message-Id": userMessageId }
            : {}),
          ...(assistantMessageId
            ? { "X-Assistant-Message-Id": assistantMessageId }
            : {}),
        },
      });
    } catch (error) {
      endChatGeneration(params.chatId, generationController);
      throw error;
    }
  },
  { requireAuth: true, requireChatAuth: true },
);
