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
      generateChatTitle?: boolean;
      chatModel?: string;
      homerReasoningEffort?: string;
    };
    const messages = sanitizeMessages(body.messages);
    if (!messages.length) {
      throw new AppError("messages are required.", 400);
    }

    // Durable generation: abort only via explicit stop, not client disconnect.
    const generationController = beginChatGeneration(params.chatId);

    const { stream, onComplete, assistantMessageId } =
      await chatService.streamChatGeneration({
        chatId: params.chatId,
        userId: user.id,
        messages,
        signal: generationController.signal,
        userCountryCode: resolveRequestCountryCode(request.headers),
        generateChatTitle: body.generateChatTitle,
        chatModel: body.chatModel,
        homerReasoningEffort: parseHomerReasoningEffort(
          body.homerReasoningEffort,
        ),
      });

    const [clientStream, persistStream] = stream.tee();

    const persistPromise = (async () => {
      const reader = persistStream.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        await onComplete();
      } catch {
        // aborted / cancelled — still try to finalize row state via onComplete
        try {
          await onComplete();
        } catch {
          // ignore
        }
      } finally {
        endChatGeneration(params.chatId, generationController);
      }
    })();

    // Ensure Vercel keeps the isolate alive until DB persist finishes,
    // even if the browser tab closed mid-stream.
    after(() => persistPromise);

    return new Response(clientStream, {
      headers: {
        ...CLAUXEN_STREAM_HEADERS,
        ...(assistantMessageId
          ? { "X-Assistant-Message-Id": assistantMessageId }
          : {}),
      },
    });
  },
  { requireAuth: true, requireChatAuth: true },
);
