import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import * as chatService from "@/backend/services/chat.service";
import { sanitizeMessages } from "@/backend/inference/novita";
import { AppError } from "@/backend/db/errors";
import { resolveRequestCountryCode } from "@/lib/request-geo";
import { parseHomerReasoningEffort } from "@/lib/model-effort";
import { CLAUXEN_STREAM_HEADERS } from "@/backend/inference/clauxen-sse-stream";

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

    const { stream, onComplete, assistantMessageId } =
      await chatService.streamChatGeneration({
      chatId: params.chatId,
      userId: user.id,
      messages,
      signal: request.signal,
      userCountryCode: resolveRequestCountryCode(request.headers),
      generateChatTitle: body.generateChatTitle,
      chatModel: body.chatModel,
      homerReasoningEffort: parseHomerReasoningEffort(body.homerReasoningEffort),
    });

    const wrapped = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          await onComplete();
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(wrapped, {
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
