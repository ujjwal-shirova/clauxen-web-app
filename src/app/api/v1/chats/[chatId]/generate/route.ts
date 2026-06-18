import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import * as chatService from "@/backend/services/chat.service";
import {
  resolveThinkingType,
  sanitizeMessages,
} from "@/backend/inference/novita";
import { AppError } from "@/backend/db/errors";
import { resolveRequestCountryCode } from "@/lib/request-geo";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      messages?: unknown;
      thinkingEnabled?: boolean;
      thinkingType?: string;
      webSearchEnabled?: boolean;
      generateChatTitle?: boolean;
      chatModel?: string;
    };
    const messages = sanitizeMessages(body.messages);
    if (!messages.length) {
      throw new AppError("messages are required.", 400);
    }

    const { stream, onComplete } = await chatService.streamChatGeneration({
      chatId: params.chatId,
      userId: user.id,
      messages,
      signal: request.signal,
      thinkingType: resolveThinkingType(body),
      webSearchEnabled: body.webSearchEnabled === true,
      userCountryCode: resolveRequestCountryCode(request.headers),
      generateChatTitle: body.generateChatTitle,
      chatModel: body.chatModel,
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
        ...UI_MESSAGE_STREAM_HEADERS,
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  },
  { requireAuth: true, requireChatAuth: true },
);
