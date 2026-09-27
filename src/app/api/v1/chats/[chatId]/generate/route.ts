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
  parseClientVisionImages,
  parseVisionFileIds,
} from "@/server/inference/vision-attachments";
import {
  beginChatGeneration,
  endChatGeneration,
} from "@/server/chat/generation-registry";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { readEdgeFlags } from "@/server/config/edge-flags";
import { assertDurableRateLimit } from "@/server/http/durable-rate-limit";
import { clientIp } from "@/server/http/request-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    let resolveSettled: () => void = () => {};
    const generationSettled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    // The HTTP response can end when the browser closes. This keeps the
    // Vercel isolate alive until the model stream is consumed and the
    // assistant row is saved in Supabase.
    after(() => generationSettled);

    await chatsRepo.setChatGenerating(params.chatId, user.id, true);
    let holdGenerating = true;

    try {
      const { stream, onComplete, userMessageId, assistantMessageId } =
        await chatService.streamChatGeneration({
          chatId: params.chatId,
          userId: user.id,
          messages,
          turn,
          vision,
          signal: generationController.signal,
          requestStartedAtMs,
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
            holdGenerating = false;
            await chatsRepo.setChatGenerating(params.chatId, user.id, false);
            await endChatGeneration(params.chatId, generationController);
          },
          requestId,
        });

      let finished = false;
      let closed = false;
      const finishOnce = async () => {
        if (finished) return;
        finished = true;
        // Stop heartbeats before the save so they cannot turn the flag back on
        // after the completed answer is written.
        closed = true;
        try {
          await onComplete();
        } finally {
          try {
            await chatsRepo.setChatGenerating(params.chatId, user.id, false);
            await endChatGeneration(params.chatId, generationController);
          } finally {
            resolveSettled();
          }
        }
      };

      let clientController: ReadableStreamDefaultController<Uint8Array> | null =
        null;
      let clientClosed = false;
      const pendingChunks: Uint8Array[] = [];
      let pendingBytes = 0;
      const encoder = new TextEncoder();

      const flushPending = () => {
        if (!clientController || clientClosed) return;
        while (pendingChunks.length > 0) {
          const chunk = pendingChunks.shift();
          if (!chunk) break;
          try {
            clientController.enqueue(chunk);
          } catch {
            clientClosed = true;
            clientController = null;
            pendingChunks.length = 0;
            return;
          }
        }
        pendingBytes = 0;
      };

      const clientStream = new ReadableStream<Uint8Array>({
        start(controller) {
          clientController = controller;
          flushPending();
        },
        cancel() {
          // Tab close or navigation. Keep reading the model stream in the
          // background; only an explicit stop aborts generationController.
          clientClosed = true;
          clientController = null;
          pendingChunks.length = 0;
        },
      });

      const pushToClient = (bytes: Uint8Array) => {
        if (clientClosed) return;
        if (!clientController) {
          // The browser may not be reading yet. Keep a short buffer so the
          // first tokens are not dropped, then rely on the saved transcript.
          if (pendingBytes > 1_000_000) return;
          pendingChunks.push(bytes);
          pendingBytes += bytes.byteLength;
          return;
        }
        flushPending();
        try {
          clientController.enqueue(bytes);
        } catch {
          clientClosed = true;
          clientController = null;
        }
      };

      const closeClient = () => {
        if (clientClosed || !clientController) return;
        clientClosed = true;
        try {
          clientController.close();
        } catch {
          // already closed
        }
        clientController = null;
      };

      let lastGeneratingTouchAt = Date.now();
      const heartbeat = setInterval(() => {
        if (closed) return;
        if (
          holdGenerating &&
          Date.now() - lastGeneratingTouchAt > 15_000
        ) {
          lastGeneratingTouchAt = Date.now();
          void chatsRepo
            .setChatGenerating(params.chatId, user.id, true)
            .catch(() => {});
        }
        pushToClient(encoder.encode(": keepalive\n\n"));
      }, 5_000);

      void (async () => {
        const reader = stream.getReader();
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
            if (value) pushToClient(value);
          }
        } catch {
          // Model stream failed. finishOnce still persists whatever was saved.
        } finally {
          clearInterval(heartbeat);
          closeClient();
          await finishOnce();
        }
      })();

      return new Response(clientStream, {
        headers: {
          ...CLAUXEN_STREAM_HEADERS,
          ...(userMessageId ? { "X-User-Message-Id": userMessageId } : {}),
          ...(assistantMessageId
            ? { "X-Assistant-Message-Id": assistantMessageId }
            : {}),
        },
      });
    } catch (error) {
      await chatsRepo.setChatGenerating(params.chatId, user.id, false);
      await endChatGeneration(params.chatId, generationController);
      resolveSettled();
      throw error;
    }
  },
  { requireAuth: true, requireChatAuth: true },
);
