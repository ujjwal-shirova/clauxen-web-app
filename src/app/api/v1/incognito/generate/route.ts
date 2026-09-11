import { withApiRoute } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import { sanitizeMessages } from "@/server/inference/novita";
import { AppError } from "@/server/db/errors";
import { resolveRequestCountryCode } from "@/lib/request-geo";
import { parseHomerReasoningEffort } from "@/lib/model-effort";
import { CLAUXEN_STREAM_HEADERS } from "@/server/inference/clauxen-sse-stream";
import { createChatStream } from "@/app/api/chat/stream";
import { readEdgeFlags } from "@/server/config/edge-flags";
import { assertDurableRateLimit } from "@/server/http/durable-rate-limit";
import { clientIp } from "@/server/http/request-meta";
import {
  applyVisionToLastUserMessage,
  parseClientVisionImages,
  parseVisionFileIds,
  resolveVisionImageBlocks,
} from "@/server/inference/vision-attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Ephemeral generate — same agent tools/skills as durable chat, but no chat
 * row, message rows, file attachments, or history cache writes.
 */
export const POST = withApiRoute(async ({ session, request }) => {
  const user = requireSession(session);
  await Promise.all([
    assertDurableRateLimit({
      key: `incognito-generate:user:${user.id}`,
      limit: 45,
      windowMs: 60_000,
      message: "Too many generations. Please wait a moment and try again.",
    }),
    assertDurableRateLimit({
      key: `incognito-generate:ip:${clientIp(request) ?? "unknown"}`,
      limit: 90,
      windowMs: 60_000,
      message: "Too many generations from this network. Try again shortly.",
    }),
  ]);

  const body = (await request.json()) as {
    messages?: unknown;
    chatModel?: string;
    homerReasoningEffort?: string;
    extendedThinking?: boolean;
    clientTimezone?: string;
    vision?: {
      fileIds?: unknown;
      images?: unknown;
    };
  };

  const messages = sanitizeMessages(body.messages).filter(
    (message) => message.content.trim().length > 0,
  );
  if (!messages.length) {
    throw new AppError("messages are required.", 400);
  }

  const flags = await readEdgeFlags();
  if (flags.maintenanceMode) {
    throw new AppError(
      "Clauxen is temporarily under maintenance. Try again shortly.",
      503,
      "maintenance_mode",
    );
  }

  const visionImages = parseClientVisionImages(body.vision?.images);
  const visionFileIds = parseVisionFileIds(body.vision?.fileIds);
  const visionBlocks =
    visionImages?.length || visionFileIds?.length
      ? await resolveVisionImageBlocks({
          userId: user.id,
          fileIds: visionFileIds,
          clientImages: visionImages,
        })
      : [];
  const modelMessages = applyVisionToLastUserMessage(
    messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    visionBlocks,
  );

  const stream = await createChatStream(messages, {
    chatModel: body.chatModel,
    userId: user.id,
    modelMessages,
    // No conversationId — tools that key off durable chat history stay scoped
    // to this request only.
    userCountryCode: resolveRequestCountryCode(request.headers),
    clientTimezone:
      typeof body.clientTimezone === "string"
        ? body.clientTimezone.trim().slice(0, 64)
        : undefined,
    generateChatTitle: false,
    homerReasoningEffort: parseHomerReasoningEffort(body.homerReasoningEffort),
    extendedThinking: body.extendedThinking === true,
    incognito: true,
    signal: request.signal,
  });

  return new Response(stream, {
    headers: {
      ...CLAUXEN_STREAM_HEADERS,
      "Cache-Control": "no-cache, no-transform",
    },
  });
});
