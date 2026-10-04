import { after } from "next/server";
import { waitUntil } from "@vercel/functions";
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
import {
  beginChatGeneration,
  endChatGeneration,
} from "@/server/chat/generation-registry";
import {
  createGenerationJob,
  type GenerationJobInput,
} from "@/server/repositories/generation-jobs.repository";
import {
  runLiveSlice,
  workerId,
  type LiveSliceInput,
} from "@/server/chat/durable-generation";
import * as chatsRepo from "@/server/repositories/chats.repository";
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
  const raw = input as { kind?: unknown; userMessageId?: unknown; assistantMessageId?: unknown };
  if (raw.kind === "edit" && typeof raw.userMessageId === "string" && UUID_RE.test(raw.userMessageId)) {
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

    // Durable generations are only stopped explicitly. A duplicate request
    // must never abort an existing turn and create a second assistant row.
    // Local map claim is instant; the job row is the cross-isolate truth
    // (one active job per chat); the DO lease overlaps SSE start inside
    // resolveContext before turn insert / model.
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
          fork,
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

    // The background job owns this turn from here on. Cross-isolate
    // duplicates 409 here (unique active job per chat) instead of racing
    // the coordinator lease.
    const jobInput: GenerationJobInput = {
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

    let job;
    try {
      job = await createGenerationJob({
        chatId: params.chatId,
        userId: user.id,
        jobInput,
        lockedBy: workerId(),
      });
    } catch (error) {
      await endChatGeneration(params.chatId, generation.controller);
      if (
        error instanceof AppError &&
        error.code === "generation_in_progress"
      ) {
        if (turn) {
          await chatService.reserveQueuedChatTurn({
            chatId: params.chatId,
            userId: user.id,
            turn,
            fork,
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
      throw error;
    }

    const generationController = generation.controller;
    let resolveSettled: () => void = () => {};
    const generationSettled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    // The live slice keeps running after the browser disconnects. after() and
    // waitUntil() both extend the invocation until the slice completes or
    // yields to the background chain.
    after(() => generationSettled);
    waitUntil(generationSettled);

    await chatsRepo.setChatGenerating(params.chatId, user.id, true);

    try {
      const liveInput: LiveSliceInput = {
        job,
        messages,
        fork: jobInput.fork ?? null,
        turn: jobInput.turn ?? undefined,
        vision: jobInput.vision ?? undefined,
        chatModel: jobInput.chatModel,
        homerReasoningEffort: jobInput.homerReasoningEffort,
        extendedThinking: jobInput.extendedThinking,
        clientTimezone: jobInput.clientTimezone,
        userCountryCode: jobInput.userCountryCode,
        generateChatTitle: jobInput.generateChatTitle,
        requestId,
        requestStartedAtMs,
        origin: new URL(request.url).origin,
        registrySignal: generationController.signal,
        onPauseForUser: async () => {
          // Free the DO/local lease as soon as ask_user_input pauses so the
          // user's questionnaire answers can start a new turn without 409.
          // (The job row closes as paused_for_user in persistOnDone.)
          await chatsRepo.setChatGenerating(params.chatId, user.id, false);
          await endChatGeneration(params.chatId, generationController);
        },
        onSettled: (outcome) => {
          // Runs when the live slice ends, while the invocation is alive.
          void (async () => {
            try {
              // The DO lease always releases here: terminal turns are done,
              // and yielded turns re-acquire it in the chained slice. The
              // generating flag clears only on terminal outcomes — a yielded
              // turn is still running in the background.
              await endChatGeneration(params.chatId, generationController);
              if (outcome.status !== "yielded") {
                await chatsRepo.setChatGenerating(params.chatId, user.id, false);
              }
            } finally {
              resolveSettled();
            }
          })();
        },
      };

      // The DO lease gate still runs inside resolveContext (before turn
      // insert / model) so a racing continuation slice wins cleanly: the
      // loser 409s and its job row is failed without a trace.
      liveInput.ensureLease = () => generation.lease;

      const { response } = await runLiveSlice(liveInput);
      return response;
    } catch (error) {
      // The live slice never started streaming: fail the job so the chat is
      // not parked behind a queued row the watchdog would otherwise revive.
      const { finishGenerationJob } = await import(
        "@/server/repositories/generation-jobs.repository"
      );
      await finishGenerationJob({
        jobId: job.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }).catch(() => undefined);
      await chatsRepo.setChatGenerating(params.chatId, user.id, false);
      await endChatGeneration(params.chatId, generationController);
      resolveSettled();
      throw error;
    }
  },
  { requireAuth: true, requireChatAuth: true },
);
