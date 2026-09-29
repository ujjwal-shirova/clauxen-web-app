/**
 * Durable background generations — time-sliced chat turns with no effective
 * duration cap.
 *
 * A turn runs as a JOB made of chained SLICES. Each slice executes inside one
 * Vercel invocation under a soft budget (~240s): the agent loop checkpoints
 * every completed tool round to Postgres, and when the budget ends the slice
 * yields, parks its checkpoint, and chains the next slice through the
 * internal /continue endpoint (fresh 300s budget). Slices chain until the
 * model finishes — a turn can run for minutes or hours without ever hitting
 * the serverless wall.
 *
 * Recovery layers (each one alone keeps turns alive):
 *   1. Chained continuation — the yielding slice triggers the next slice.
 *   2. Watchdog (Vercel Cron, every minute) — reclaims jobs whose heartbeat
 *      went stale (crashed isolate, killed invocation, lost trigger).
 *   3. Postgres checkpoints — every resume starts from the last completed
 *      tool round; interrupted model rounds re-run side-effect free.
 *
 * Browser state is irrelevant: the first (live) slice streams SSE while the
 * tab is open and keeps running headless after disconnect; later slices are
 * always headless. Completion writes the transcript to Postgres immediately,
 * so spinners and "still working" states clear the moment the turn ends.
 */

import { randomUUID } from "node:crypto";
import * as chatService from "@/server/services/chat.service";
import type { ChatSliceOutcome } from "@/server/services/chat.service";
import {
  attachTurnMessageIds,
  cancelActiveJobsForChat,
  claimGenerationJob,
  createGenerationJob,
  deleteTerminalJobsOlderThan,
  finishGenerationJob,
  getActiveGenerationJobForChat,
  getGenerationJob,
  getGenerationJobStatus,
  heartbeatGenerationJob,
  isChatJobActive,
  listStalledGenerationJobs,
  type GenerationCheckpoint,
  type GenerationJobInput,
  type GenerationJobRow,
} from "@/server/repositories/generation-jobs.repository";
import {
  acquireChatCoordLease,
  getChatCoordStatus,
  publishLiveTurn,
  releaseChatCoordLease,
  renewChatCoordLease,
} from "@/server/chat/chat-coord-client";
import * as chatsRepo from "@/server/repositories/chats.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";
import { buildAssistantTranscriptRecord } from "@/server/training/transcript-format";
import { generationsTriggerToken } from "@/server/http/internal-generations-auth";
import { CLAUXEN_STREAM_HEADERS } from "@/server/inference/clauxen-sse-stream";
import { toUserFacingChatError } from "@/lib/assistant-generation-error";
import {
  parseHomerReasoningEffort,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

/** Request a slice yield at the next round boundary after this long. */
export const SLICE_SOFT_MS = 240_000;
/** Abort the in-flight model stream after this long (Vercel cap is 300s). */
export const SLICE_HARD_MS = 270_000;
/** Safety cap on chained slices (~19h). Real turns never reach it. */
export const SLICE_MAX = 48;
/** Crash-retries of the same slice before the job is failed as poison. */
export const SLICE_MAX_ATTEMPTS = 5;
const SLICE_HEARTBEAT_MS = 15_000;
const SLICE_CANCEL_POLL_MS = 2_000;
const CONTINUATION_TIMEOUT_MS = 10_000;

function workerId(): string {
  const region = process.env.VERCEL_REGION ?? "local";
  return `slice-${region}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export type SliceRuntime = {
  jobId: string;
  shouldYield: () => boolean;
  yieldSignal: AbortSignal;
  /** Aborted on explicit user stop (job row or coordinator flag). */
  cancelSignal: AbortSignal;
  dispose: () => void;
};

/**
 * Starts slice timers: soft/hard yield deadlines, job + generating-flag
 * heartbeats, coordinator lease renewal, and user-stop polling.
 */
export function startSliceRuntime(input: {
  jobId: string;
  chatId: string;
  userId: string;
  /** Coordinator lease held by this slice (headless slices only). */
  leaseId?: string | null;
  softMs?: number;
  hardMs?: number;
}): SliceRuntime {
  const sliceStart = Date.now();
  const softMs = input.softMs ?? SLICE_SOFT_MS;
  const hardMs = input.hardMs ?? SLICE_HARD_MS;
  const yieldController = new AbortController();
  const cancelController = new AbortController();
  let disposed = false;

  const hardTimer = setTimeout(() => {
    if (!disposed) yieldController.abort();
  }, hardMs);
  hardTimer.unref?.();

  const heartbeat = setInterval(() => {
    if (disposed) return;
    void heartbeatGenerationJob(input.jobId).catch(() => undefined);
    void chatsRepo
      .setChatGenerating(input.chatId, input.userId, true)
      .catch(() => undefined);
    if (input.leaseId) {
      void renewChatCoordLease(input.chatId, input.leaseId).catch(
        () => undefined,
      );
    }
  }, SLICE_HEARTBEAT_MS);
  heartbeat.unref?.();

  // Explicit stops must land within seconds even on long headless slices.
  // The live slice also aborts in-process via the generation registry; this
  // watcher is the cross-isolate backstop both slice kinds share.
  let cancelCheckInFlight = false;
  const cancelWatcher = setInterval(() => {
    if (disposed || cancelCheckInFlight) return;
    cancelCheckInFlight = true;
    void (async () => {
      try {
        const [status, coord] = await Promise.all([
          getGenerationJobStatus(input.jobId).catch(
            () => null as string | null,
          ),
          getChatCoordStatus(input.chatId).catch(() => null),
        ]);
        if (status === "cancelled" || coord?.stopRequested) {
          cancelController.abort();
        }
      } finally {
        cancelCheckInFlight = false;
      }
    })();
  }, SLICE_CANCEL_POLL_MS);
  cancelWatcher.unref?.();

  return {
    jobId: input.jobId,
    shouldYield: () => Date.now() - sliceStart >= softMs,
    yieldSignal: yieldController.signal,
    cancelSignal: cancelController.signal,
    dispose: () => {
      disposed = true;
      clearTimeout(hardTimer);
      clearInterval(heartbeat);
      clearInterval(cancelWatcher);
    },
  };
}

/** Fire the next slice. The endpoint answers 202 immediately; never await it. */
export async function triggerContinuation(
  origin: string,
  jobId: string,
): Promise<boolean> {
  const token = generationsTriggerToken();
  if (!token) {
    console.warn("[durable-generation] no internal token; watchdog will pick up", jobId);
    return false;
  }
  try {
    const response = await fetch(
      `${origin.replace(/\/+$/, "")}/api/v1/internal/generations/continue`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clauxen-internal": token,
        },
        body: JSON.stringify({ jobId }),
        signal: AbortSignal.timeout(CONTINUATION_TIMEOUT_MS),
      },
    );
    // 202 claimed, 409 already handled elsewhere — both mean "not orphaned".
    return response.status === 202 || response.status === 409;
  } catch (error) {
    console.warn("[durable-generation] continuation trigger failed:", error);
    return false;
  }
}

export type LiveSliceInput = {
  job: GenerationJobRow;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  turn?: GenerationJobInput["turn"];
  vision?: GenerationJobInput["vision"];
  chatModel?: string;
  homerReasoningEffort?: string;
  extendedThinking?: boolean;
  clientTimezone?: string;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  requestId?: string;
  requestStartedAtMs?: number;
  origin: string;
  /** Registry-owned controller: explicit stops abort this in-process. */
  registrySignal: AbortSignal;
  /**
   * Coordinator lease gate (started in parallel with SSE). Awaited inside
   * resolveContext before turn insert / model for cross-isolate single-writer.
   */
  ensureLease?: () => Promise<"acquired" | "conflict" | "skipped">;
  onPauseForUser?: () => void | Promise<void>;
  onSettled?: (outcome: ChatSliceOutcome) => void;
};

/**
 * Runs the live (user-facing) slice and returns its SSE response. The stream
 * stays open while the tab reads; on disconnect the slice continues headless
 * until it completes or yields. On yield the client gets a single
 * `backgrounded` event (never `done`) and switches to live polling.
 */
export async function runLiveSlice(input: LiveSliceInput): Promise<{
  response: Response;
  userMessageId: string | null;
  assistantMessageId: string | null;
}> {
  const { job } = input;
  const runtime = startSliceRuntime({
    jobId: job.id,
    chatId: job.chat_id,
    userId: job.user_id,
  });
  const combinedSignal = combineSignals([
    input.registrySignal,
    runtime.cancelSignal,
  ]);

  const { stream, onComplete, userMessageId, assistantMessageId } =
    await chatService.streamChatGeneration({
      chatId: job.chat_id,
      userId: job.user_id,
      messages: input.messages,
      turn: input.turn
        ? {
            content: input.turn.content,
            modelContent: input.turn.modelContent,
            fileIds: input.turn.fileIds,
            images: (input.turn.images ?? []) as never,
            userClientId: input.turn.userClientId,
            assistantClientId: input.turn.assistantClientId,
          }
        : undefined,
      vision: input.vision
        ? {
            fileIds: input.vision.fileIds,
            images: (input.vision.images ?? []) as never,
          }
        : undefined,
      signal: combinedSignal,
      ensureLease: input.ensureLease,
      userCountryCode: input.userCountryCode,
      clientTimezone: input.clientTimezone,
      generateChatTitle: input.generateChatTitle,
      chatModel: input.chatModel,
      homerReasoningEffort: parseEffort(input.homerReasoningEffort),
      extendedThinking: input.extendedThinking,
      onPauseForUser: input.onPauseForUser,
      requestId: input.requestId,
      requestStartedAtMs: input.requestStartedAtMs,
      slice: {
        jobId: job.id,
        resume: job.checkpoint,
        shouldYield: runtime.shouldYield,
        yieldSignal: runtime.yieldSignal,
        onTurnInserted: (ids) => {
          void attachTurnMessageIds(job.id, ids).catch(() => undefined);
        },
      },
    });

  let finished = false;
  let closed = false;
  const encoder = new TextEncoder();
  let clientController: ReadableStreamDefaultController<Uint8Array> | null =
    null;
  let clientClosed = false;
  const pendingChunks: Uint8Array[] = [];
  let pendingBytes = 0;

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

  const pushToClient = (bytes: Uint8Array) => {
    if (clientClosed) return;
    if (!clientController) {
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

  const finishOnce = async (): Promise<ChatSliceOutcome> => {
    if (finished) return { status: "complete" };
    finished = true;
    closed = true;
    try {
      return await onComplete();
    } finally {
      runtime.dispose();
    }
  };

  const heartbeat = setInterval(() => {
    if (closed) return;
    pushToClient(encoder.encode(": keepalive\n\n"));
  }, 5_000);
  heartbeat.unref?.();

  void (async () => {
    const reader = stream.getReader();
    try {
      while (true) {
        if (combinedSignal.aborted) {
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
      let outcome: ChatSliceOutcome = { status: "complete" };
      try {
        outcome = await finishOnce();
      } catch {
        outcome = { status: "failed" };
      }
      if (outcome.status === "yielded") {
        // Hand the turn to the background: chain the next slice, tell the
        // tab to switch to polling, then close. No `done` — the turn is
        // still running and the UI must keep its generating state.
        void triggerContinuation(input.origin, job.id);
        pushToClient(
          encoder.encode(
            `data: ${JSON.stringify({ type: "backgrounded", jobId: job.id, chatId: job.chat_id })}\n\n`,
          ),
        );
      }
      closeClient();
      try {
        input.onSettled?.(outcome);
      } catch {
        // ignore
      }
    }
  })();

  const clientStream = new ReadableStream<Uint8Array>({
    start(controller) {
      clientController = controller;
      flushPending();
    },
    cancel() {
      // Tab close or navigation. The slice keeps running headless; only an
      // explicit stop aborts it.
      clientClosed = true;
      clientController = null;
      pendingChunks.length = 0;
    },
  });

  return {
    response: new Response(clientStream, {
      headers: {
        ...CLAUXEN_STREAM_HEADERS,
        ...(userMessageId ? { "X-User-Message-Id": userMessageId } : {}),
        ...(assistantMessageId
          ? { "X-Assistant-Message-Id": assistantMessageId }
          : {}),
      },
    }),
    userMessageId,
    assistantMessageId,
  };
}

export type HeadlessSliceResult =
  | { status: "complete" | "failed" | "cancelled" | "paused" }
  | { status: "yielded"; chained: boolean }
  | { status: "skipped"; reason: string };

/**
 * Runs one headless slice for an already-claimed job: drains the agent
 * stream without a client, then chains the next slice when it yields.
 */
export async function runHeadlessSlice(input: {
  job: GenerationJobRow;
  origin: string;
}): Promise<HeadlessSliceResult> {
  const { job, origin } = input;
  if (job.slice_index >= SLICE_MAX || job.attempt >= SLICE_MAX_ATTEMPTS) {
    const poisoned = job.attempt >= SLICE_MAX_ATTEMPTS;
    await finishGenerationJob({
      jobId: job.id,
      status: "failed",
      error: poisoned
        ? "This task kept failing to resume. Please try sending it again."
        : "This task ran longer than the background budget. Please break it into smaller steps.",
    }).catch(() => undefined);
    await finalizeMessageAs(job, "failed").catch(() => undefined);
    await chatsRepo
      .setChatGenerating(job.chat_id, job.user_id, false)
      .catch(() => undefined);
    return { status: "failed" };
  }

  // Each slice holds the coordinator lease only while it runs. The job row
  // is the durable truth across the seconds between slices.
  const leaseId = randomUUID();
  const lease = await acquireChatCoordLease(job.chat_id, leaseId);
  if (lease === "conflict") {
    // Another slice (or a racing live request) owns this chat right now.
    // Park the job; the watchdog re-triggers once the lease frees up.
    await heartbeatGenerationJob(job.id).catch(() => undefined);
    return { status: "skipped", reason: "lease_conflict" };
  }

  const runtime = startSliceRuntime({
    jobId: job.id,
    chatId: job.chat_id,
    userId: job.user_id,
    leaseId: lease === "acquired" ? leaseId : null,
  });

  try {
    const jobInput = job.input ?? {};
    const { stream, onComplete } = await chatService.streamChatGeneration({
      chatId: job.chat_id,
      userId: job.user_id,
      messages: (jobInput.messages ?? []).map((message) => ({
        role:
          message.role === "assistant" || message.role === "system"
            ? message.role
            : "user",
        content: message.content,
      })),
      // Resume slices reuse the turn rows the first slice inserted; the
      // stored turn payload is only needed when the first slice died before
      // inserting (crash between job create and turn insert).
      turn: job.assistant_message_id
        ? undefined
        : jobInput.turn
          ? {
              content: jobInput.turn.content,
              modelContent: jobInput.turn.modelContent,
              fileIds: jobInput.turn.fileIds,
              images: (jobInput.turn.images ?? []) as never,
              userClientId: jobInput.turn.userClientId,
              assistantClientId: jobInput.turn.assistantClientId,
            }
          : undefined,
      vision: jobInput.vision
        ? {
            fileIds: jobInput.vision.fileIds,
            images: (jobInput.vision.images ?? []) as never,
          }
        : undefined,
      signal: runtime.cancelSignal,
      userCountryCode: jobInput.userCountryCode,
      clientTimezone: jobInput.clientTimezone,
      generateChatTitle: jobInput.generateChatTitle,
      chatModel: jobInput.chatModel,
      homerReasoningEffort: parseEffort(jobInput.homerReasoningEffort),
      extendedThinking: jobInput.extendedThinking,
      requestId: jobInput.requestId,
      requestStartedAtMs: jobInput.turnStartedAtMs,
      slice: {
        jobId: job.id,
        resume: job.checkpoint,
        shouldYield: runtime.shouldYield,
        yieldSignal: runtime.yieldSignal,
        onTurnInserted: (ids) => {
          void attachTurnMessageIds(job.id, ids).catch(() => undefined);
        },
      },
    });

    // Drain the SSE: accumulation + checkpoints happen in the tap layer.
    const reader = stream.getReader();
    try {
      while (true) {
        if (runtime.cancelSignal.aborted) {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          break;
        }
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      // onComplete still persists whatever was accumulated.
    }

    const outcome = await onComplete();
    if (outcome.status === "yielded") {
      const chained = await triggerContinuation(origin, job.id);
      return { status: "yielded", chained };
    }
    return { status: outcome.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishGenerationJob({
      jobId: job.id,
      status: "failed",
      error: toUserFacingChatError(message),
    }).catch(() => undefined);
    await finalizeMessageAs(job, "failed", message).catch(() => undefined);
    await publishLiveTurn({
      chatId: job.chat_id,
      userId: job.user_id,
      assistantId: job.assistant_message_id ?? job.id,
      status: "failed",
      answer: toUserFacingChatError(message),
      contentJson: buildAssistantTranscriptRecord({
        answer: toUserFacingChatError(message),
      }),
    }).catch(() => false);
    return { status: "failed" };
  } finally {
    runtime.dispose();
    if (lease === "acquired") {
      await releaseChatCoordLease(job.chat_id, leaseId).catch(() => undefined);
    }
    // Terminal jobs clear the flag here; yielded jobs keep it until they end.
    const current = await getGenerationJob(job.id).catch(() => null);
    if (!current || current.status !== "continuing") {
      await chatsRepo
        .setChatGenerating(job.chat_id, job.user_id, false)
        .catch(() => undefined);
    }
  }
}

/** Watchdog pass: chain a replacement slice for every stalled job. */
export async function recoverStalledJobs(
  origin: string,
  limit = 10,
): Promise<{ stalled: number; triggered: number; cleaned: number }> {
  const stalled = await listStalledGenerationJobs(limit).catch(() => []);
  let triggered = 0;
  for (const job of stalled) {
    // Claiming happens inside /continue (single-winner); the watchdog only
    // knocks. A trigger that lands on an already-recovered job 409s safely.
    const ok = await triggerContinuation(origin, job.id);
    if (ok) triggered += 1;
  }
  // Retention: terminal job rows (with their checkpoints) older than 7 days.
  const cleaned = await deleteTerminalJobsOlderThan("7 days", 500).catch(
    () => 0,
  );
  return { stalled: stalled.length, triggered, cleaned };
}

/**
 * Explicit user stop: cancel the job (slices abort within seconds), flag the
 * coordinator, and settle the visible message + generating flag at once so
 * the UI never spins on a stopped turn.
 */
export async function stopChatJob(
  chatId: string,
  userId: string,
): Promise<{ cancelledJobs: number }> {
  const cancelledJobs = await cancelActiveJobsForChat(chatId, userId).catch(
    () => 0,
  );
  try {
    const recent = await messagesRepo.listRecentMessagesForChat(chatId, 8);
    for (const row of recent) {
      if (row.role === "assistant" && row.status === "streaming") {
        await messagesRepo
          .updateMessageContent(
            row.id,
            chatId,
            row.content ?? "",
            "cancelled",
            isRecord(row.content_json) ? row.content_json : {},
          )
          .catch(() => undefined);
      }
    }
  } catch {
    // ignore
  }
  await chatsRepo
    .setChatGenerating(chatId, userId, false)
    .catch(() => undefined);
  return { cancelledJobs };
}

async function finalizeMessageAs(
  job: GenerationJobRow,
  status: "failed" | "cancelled",
  message?: string,
): Promise<void> {
  if (!job.assistant_message_id) return;
  const content = status === "cancelled" ? "" : toUserFacingChatError(message ?? "");
  await messagesRepo
    .finalizeAssistantTurn({
      messageId: job.assistant_message_id,
      chatId: job.chat_id,
      userId: job.user_id,
      content,
      status,
      contentJson: buildAssistantTranscriptRecord({ answer: content }),
      tools: [],
      transcriptLines: [],
    })
    .catch(() => undefined);
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const active = signals.filter((signal) => !signal.aborted);
  if (active.length === 0) return AbortSignal.abort();
  if (active.length === 1) return active[0]!;
  const anySignal =
    typeof AbortSignal.any === "function"
      ? AbortSignal.any(active)
      : active[0]!;
  return anySignal;
}

function parseEffort(value: string | undefined): HomerReasoningEffort {
  return parseHomerReasoningEffort(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export {
  createGenerationJob,
  getActiveGenerationJobForChat,
  getGenerationJob,
  claimGenerationJob,
  isChatJobActive,
};
export type { GenerationCheckpoint, GenerationJobInput, GenerationJobRow };
