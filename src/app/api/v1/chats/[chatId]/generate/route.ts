import { after } from "next/server";
import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import * as chatService from "@/server/services/chat.service";
import { sanitizeMessages } from "@/server/inference/novita";
import { AppError } from "@/server/db/errors";
import { resolveRequestCountryCode } from "@/lib/request-geo";
import { parseHomerReasoningEffort } from "@/lib/model-effort";
import { CLAUXEN_STREAM_HEADERS } from "@/server/inference/clauxen-sse-stream";
import {
  beginChatGeneration,
  endChatGeneration,
} from "@/server/chat/generation-registry";
import { readEdgeFlags } from "@/server/config/edge-flags";
import { assertDurableRateLimit } from "@/server/http/durable-rate-limit";
import { clientIp } from "@/server/http/request-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params, requestId }) => {
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
          fileIds: Array.isArray(rawTurn.fileIds)
            ? rawTurn.fileIds.filter(
                (fileId): fileId is string => typeof fileId === "string",
              )
            : undefined,
          images: (() => {
            if (!Array.isArray(rawTurn.images)) return undefined;
            const parsed: Array<{
              mimeType: string;
              data: string;
              name?: string;
            }> = [];
            for (const image of rawTurn.images) {
              if (!image || typeof image !== "object") continue;
              const record = image as Record<string, unknown>;
              const mimeType =
                typeof record.mimeType === "string"
                  ? record.mimeType.trim()
                  : "";
              const data =
                typeof record.data === "string" ? record.data.trim() : "";
              if (!mimeType || !data) continue;
              parsed.push({
                mimeType,
                data,
                ...(typeof record.name === "string"
                  ? { name: record.name.trim().slice(0, 240) }
                  : {}),
              });
              if (parsed.length >= 8) break;
            }
            return parsed.length ? parsed : undefined;
          })(),
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
    // Local map claim is instant; DO lease overlaps SSE start (awaited inside
    // resolveContext before turn insert / model). Cross-isolate truth = DO.
    const generation = beginChatGeneration(params.chatId);
    if (!generation) {
      // Persist the follow-up before asking the browser to wait. Previously the
      // lease check happened first, so the optimistic user bubble was never
      // committed and disappeared on reload after this 409.
      if (turn) {
        await chatService.reserveQueuedChatTurn({
          chatId: params.chatId,
          userId: user.id,
          turn,
        });
      }
      return Response.json(
        {
          error: {
            message:
              "The previous reply is still finishing. Your message is saved and queued.",
            code: "generation_in_progress",
          },
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "1",
          },
        },
      );
    }

    const generationController = generation.controller;
    let finishOnce: (() => Promise<void>) | null = null;

    try {
      const { stream, onComplete, userMessageId, assistantMessageId } =
        await chatService.streamChatGeneration({
          chatId: params.chatId,
          userId: user.id,
          messages,
          turn,
          signal: generationController.signal,
          ensureLease: () => generation.lease,
          userCountryCode: resolveRequestCountryCode(request.headers),
          generateChatTitle: body.generateChatTitle,
          chatModel: flags.modelOverride || body.chatModel,
          homerReasoningEffort: parseHomerReasoningEffort(
            body.homerReasoningEffort,
          ),
          extendedThinking: body.extendedThinking === true,
          clientTimezone:
            typeof body.clientTimezone === "string"
              ? body.clientTimezone.trim().slice(0, 64)
              : undefined,
          onPauseForUser: async () => {
            // Free the DO/local lease as soon as ask_user_input pauses so the
            // user's questionnaire answers can start a new turn without 409.
            await endChatGeneration(params.chatId, generationController);
          },
          requestId,
        });

      let finished = false;
      finishOnce = async () => {
        if (finished) return;
        finished = true;
        // Release the generation lock immediately so follow-up turns are never
        // blocked by background DB persistence.
        try {
          await endChatGeneration(params.chatId, generationController);
        } finally {
          await onComplete();
        }
      };

      // Keep the isolate alive until DB persist finishes (tab close safe).
      after(async () => {
        await finishOnce?.();
      });

      // Proxies (Cloudflare / load balancers) idle-cut SSE when no bytes flow
      // during long tool calls. Emit comment heartbeats so the pipe stays open.
      const HEARTBEAT_INTERVAL_MS = 5_000;
      const heartbeatEncoder = new TextEncoder();

      const wrapped = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = stream.getReader();
          let heartbeat: ReturnType<typeof setInterval> | null = setInterval(
            () => {
              try {
                controller.enqueue(heartbeatEncoder.encode(": keepalive\n\n"));
              } catch {
                if (heartbeat) {
                  clearInterval(heartbeat);
                  heartbeat = null;
                }
              }
            },
            HEARTBEAT_INTERVAL_MS,
          );
          try {
            while (true) {
              if (generationController.signal.aborted) {
                try {
                  await reader.cancel();
                } catch {
                  // ignore
                }
                break;
              }
              const { done, value } = await reader.read();
              if (done) break;
              try {
                controller.enqueue(value);
              } catch {
                // Client disconnected. Explicit stop already aborted the
                // generation controller — cancel upstream instead of draining
                // so the provider stops spending tokens. Tab close alone still
                // drains so onComplete can persist the partial reply.
                if (generationController.signal.aborted) {
                  try {
                    await reader.cancel();
                  } catch {
                    // ignore
                  }
                  break;
                }
                while (true) {
                  if (generationController.signal.aborted) {
                    try {
                      await reader.cancel();
                    } catch {
                      // ignore
                    }
                    break;
                  }
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
            if (heartbeat) {
              clearInterval(heartbeat);
              heartbeat = null;
            }
            await finishOnce?.();
          }
        },
      });

      return new Response(wrapped, {
        headers: {
          ...CLAUXEN_STREAM_HEADERS,
          ...(userMessageId ? { "X-User-Message-Id": userMessageId } : {}),
          ...(assistantMessageId
            ? { "X-Assistant-Message-Id": assistantMessageId }
            : {}),
        },
      });
    } catch (error) {
      await endChatGeneration(params.chatId, generationController);
      throw error;
    }
  },
  { requireAuth: true, requireChatAuth: true },
);
