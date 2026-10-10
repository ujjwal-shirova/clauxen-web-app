import { after } from "next/server";
import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import * as chatService from "@/server/services/chat.service";
import { sanitizeMessages } from "@/server/inference/novita";
import { AppError } from "@/server/db/errors";
import { resolveRequestCountryCode } from "@/lib/request-geo";
import {
  parseClientVisionImages,
  parseVisionFileIds,
} from "@/server/inference/vision-attachments";
import type { GenerationJobInput } from "@/server/repositories/generation-jobs.repository";
import {
  generationExecutionOrigin,
  triggerContinuation,
} from "@/server/chat/durable-generation";
import { CLAUXEN_STREAM_HEADERS } from "@/server/inference/clauxen-sse-stream";
import type { TurnFork } from "@/server/repositories/messages.repository";
import { readEdgeFlags } from "@/server/config/edge-flags";
import { assertDurableRateLimit } from "@/server/http/durable-rate-limit";
import { clientIp } from "@/server/http/request-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client-supplied fork intent, hardened to owned-message uuid references. */
function sanitizeFork(input: unknown): TurnFork | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as {
    kind?: unknown;
    userMessageId?: unknown;
    assistantMessageId?: unknown;
  };
  if (
    raw.kind === "edit" &&
    typeof raw.userMessageId === "string" &&
    UUID_RE.test(raw.userMessageId)
  ) {
    return { kind: "edit", userMessageId: raw.userMessageId };
  }
  if (
    raw.kind === "regenerate" &&
    typeof raw.assistantMessageId === "string" &&
    UUID_RE.test(raw.assistantMessageId)
  ) {
    return { kind: "regenerate", assistantMessageId: raw.assistantMessageId };
  }
  return null;
}

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params, requestId }) => {
    const requestStartedAtMs = Date.now();
    const user = requireSession(session);
    await Promise.all([
      assertDurableRateLimit({
        key: `generate:user:${user.id}`,
        limit: 45,
        windowMs: 60_000,
        message: "Too many generations. Please wait a moment and try again.",
      }),
      assertDurableRateLimit({
        key: `generate:ip:${clientIp(request) ?? "unknown"}`,
        limit: 90,
        windowMs: 60_000,
        message: "Too many generations from this network. Try again shortly.",
      }),
    ]);
    const body = (await request.json()) as {
      messages?: unknown;
      turn?: {
        content?: unknown;
        modelContent?: unknown;
        fileIds?: unknown;
        images?: unknown;
        userClientId?: unknown;
        assistantClientId?: unknown;
      };
      fork?: unknown;
      vision?: {
        fileIds?: unknown;
        images?: unknown;
      };
      generateChatTitle?: boolean;
      chatModel?: string;
      homerReasoningEffort?: string;
      extendedThinking?: boolean;
      clientTimezone?: string;
    };
    const messages = sanitizeMessages(body.messages);
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

    const rawTurn = body.turn;
    const turn = rawTurn
      ? {
          content:
            typeof rawTurn.content === "string" ? rawTurn.content.trim() : "",
          modelContent:
            typeof rawTurn.modelContent === "string"
              ? rawTurn.modelContent.trim()
              : undefined,
          fileIds: parseVisionFileIds(rawTurn.fileIds),
          images: parseClientVisionImages(rawTurn.images),
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
    const vision = body.vision
      ? {
          fileIds: parseVisionFileIds(body.vision.fileIds),
          images: parseClientVisionImages(body.vision.images),
        }
      : undefined;
    // Tree fork intent: edit & resend a prompt, or regenerate a reply.
    const fork = sanitizeFork(body.fork);
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

    const origin = generationExecutionOrigin(request.url);
    const jobInput: GenerationJobInput = {
      executionOrigin: origin,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      fork,
      turn: turn
        ? {
            content: turn.content,
            modelContent: turn.modelContent,
            fileIds: turn.fileIds,
            images: turn.images as unknown as Array<Record<string, unknown>>,
            userClientId: turn.userClientId,
            assistantClientId: turn.assistantClientId,
          }
        : null,
      vision: vision
        ? {
            fileIds: vision.fileIds,
            images: vision.images as unknown as Array<Record<string, unknown>>,
          }
        : null,
      chatModel: flags.modelOverride || body.chatModel,
      homerReasoningEffort: body.homerReasoningEffort,
      extendedThinking: body.extendedThinking === true,
      clientTimezone:
        typeof body.clientTimezone === "string"
          ? body.clientTimezone.trim().slice(0, 64)
          : undefined,
      userCountryCode: resolveRequestCountryCode(request.headers),
      generateChatTitle: body.generateChatTitle,
      requestId,
      turnStartedAtMs: requestStartedAtMs,
    };

    // Admission commits before acknowledgement. The browser only subscribes;
    // an internal server invocation owns every slice, including the first.
    const job = await chatService.acceptBackgroundChatTurn({
      chatId: params.chatId,
      userId: user.id,
      jobInput,
    });
    after(async () => {
      await triggerContinuation(origin, job.id);
    });
    const events = [
      {
        type: "turn_ready",
        userMessageId: job.user_message_id,
        assistantMessageId: job.assistant_message_id,
      },
      { type: "backgrounded", jobId: job.id, chatId: job.chat_id },
    ];
    return new Response(
      events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      {
        status: 202,
        headers: {
          ...CLAUXEN_STREAM_HEADERS,
          "X-Generation-Job-Id": job.id,
          ...(job.user_message_id
            ? { "X-User-Message-Id": job.user_message_id }
            : {}),
          ...(job.assistant_message_id
            ? { "X-Assistant-Message-Id": job.assistant_message_id }
            : {}),
        },
      },
    );
  },
  { requireAuth: true, requireChatAuth: true },
);
