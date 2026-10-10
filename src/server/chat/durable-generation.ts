/**
 * Browser-independent chat jobs. Admission saves a queued job and its turn
 * before acknowledging the browser. Internal Vercel invocations execute
 * bounded slices; Cloudflare cron recovers missed dispatches and stale owners.
 * Postgres checkpoints preserve model history, tool plans and completed tool
 * results. Interrupted external actions with an unknown result stop safely.
 */

import { env } from "@/server/config/env";
import { queryOne } from "@/server/db/pool";
import { randomUUID } from "node:crypto";
import { logged } from "@/server/observability/log";
import * as chatService from "@/server/services/chat.service";
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
import { toUserFacingChatError } from "@/lib/assistant-generation-error";
import {
  parseHomerReasoningEffort,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

/** Request a slice yield at the next round boundary after this long. */
export const SLICE_SOFT_MS = 240_000;
/** Abort the in-flight model stream after this long (Vercel cap is 300s). */
export const SLICE_HARD_MS = 270_000;
/** Safety cap: 48 slices of up to 270s each (~3.6h). */
export const SLICE_MAX = 48;
/** Crash-retries of the same slice before the job is failed as poison. */
export const SLICE_MAX_ATTEMPTS = 5;
const SLICE_HEARTBEAT_MS = 15_000;
const SLICE_CANCEL_POLL_MS = 2_000;
const CONTINUATION_TIMEOUT_MS = 10_000;

/** Resolve an internal dispatch origin from platform config, never user JSON. */
export function generationExecutionOrigin(requestUrl: string): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`).origin;
  }
  const requested = new URL(requestUrl);
  if (["localhost", "127.0.0.1", "[::1]"].includes(requested.hostname))
    return requested.origin;
  return new URL(env.appUrl).origin;
}

export function workerId(): string {
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
  lockedBy: string;
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
    void heartbeatGenerationJob(input.jobId, input.lockedBy)
      .then((owned) => {
        if (!owned) cancelController.abort();
      })
      .catch(logged("generation.heartbeat", { jobId: input.jobId }));
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
    console.warn(
      "[durable-generation] no internal token; watchdog will pick up",
      jobId,
    );
    return false;
  }
  try {
    const target = new URL(origin);
    const useRelay =
      Boolean(env.generationsContinuationWorkerUrl) &&
      target.protocol === "https:" &&
      target.origin === new URL(env.appUrl).origin;
    const endpoint = useRelay
      ? `${env.generationsContinuationWorkerUrl.replace(/\/+$/, "")}/v1/continue`
      : `${origin.replace(/\/+$/, "")}/api/v1/internal/generations/continue`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-clauxen-internal": token,
        "user-agent": "clauxen-generations-continuation/1.0",
        ...(!useRelay &&
        target.hostname.endsWith(".vercel.app") &&
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? {
              "x-vercel-protection-bypass":
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            }
          : {}),
      },
      body: JSON.stringify({ jobId }),
      signal: AbortSignal.timeout(CONTINUATION_TIMEOUT_MS),
    });
    // 202 claimed, 409 already handled elsewhere — both mean "not orphaned".
    const accepted = response.status === 202 || response.status === 409;
    if (!accepted)
      console.warn("[durable-generation] continuation rejected", {
        jobId,
        status: response.status,
        origin,
      });
    await response.body?.cancel();
    return accepted;
  } catch (error) {
    console.warn("[durable-generation] continuation trigger failed:", error);
    return false;
  }
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
  if (job.assistant_message_id) {
    const saved = await queryOne<{ status: string }>(
      `select status from public.chat_messages where id = $1 and chat_id = $2`,
      [job.assistant_message_id, job.chat_id],
    );
    if (saved && ["complete", "failed", "cancelled"].includes(saved.status)) {
      const status = saved.status as "complete" | "failed" | "cancelled";
      await finishGenerationJob({
        jobId: job.id,
        lockedBy: job.locked_by!,
        status:
          job.checkpoint.terminalOutcome === "paused"
            ? "paused_for_user"
            : status,
      });
      if (!(await getActiveGenerationJobForChat(job.chat_id))) {
        await chatsRepo.setChatGenerating(job.chat_id, job.user_id, false);
      }
      return { status };
    }
  }
  if (job.slice_index >= SLICE_MAX || job.attempt >= SLICE_MAX_ATTEMPTS) {
    const poisoned = job.attempt >= SLICE_MAX_ATTEMPTS;
    await finalizeMessageAs(job, "failed").catch(
      logged("generation.finalize_failed", { jobId: job.id }),
    );
    await finishGenerationJob({
      jobId: job.id,
      lockedBy: job.locked_by!,
      status: "failed",
      error: poisoned
        ? "This task kept failing to resume. Please try sending it again."
        : "This task ran longer than the background budget. Please break it into smaller steps.",
    }).catch(() => false);
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
    await heartbeatGenerationJob(job.id, job.locked_by!).catch(() => undefined);
    return { status: "skipped", reason: "lease_conflict" };
  }

  const runtime = startSliceRuntime({
    jobId: job.id,
    chatId: job.chat_id,
    userId: job.user_id,
    lockedBy: job.locked_by!,
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
      fork: jobInput.fork ?? null,
      // Admission reserved turn rows; keep prompt/vision context on resumes.
      turn: jobInput.turn
        ? {
            content: jobInput.turn.content,
            modelContent: jobInput.turn.modelContent,
            fileIds: jobInput.turn.fileIds,
            images: (jobInput.turn.images ?? []) as never,
            userClientId: jobInput.turn.userClientId,
            assistantClientId: jobInput.turn.assistantClientId,
          }
        : undefined,
      vision: {
        fileIds: jobInput.vision?.fileIds ?? jobInput.turn?.fileIds,
        images: (jobInput.vision?.images ??
          jobInput.turn?.images ??
          []) as never,
      },
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
        lockedBy: job.locked_by!,
        coordLeaseId: lease === "acquired" ? leaseId : undefined,
        resume: job.checkpoint,
        shouldYield: runtime.shouldYield,
        yieldSignal: runtime.yieldSignal,
        onTurnInserted: (ids) => {
          return attachTurnMessageIds(job.id, ids, job.locked_by!);
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
      runtime.dispose();
      if (lease === "acquired")
        await releaseChatCoordLease(job.chat_id, leaseId);
      const chained = await triggerContinuation(origin, job.id);
      return { status: "yielded", chained };
    }
    return { status: outcome.status };
  } catch (error) {
    if (
      !(await heartbeatGenerationJob(job.id, job.locked_by!).catch(() => false))
    ) {
      return { status: "skipped", reason: "ownership_lost" };
    }
    const message = error instanceof Error ? error.message : String(error);
    await finalizeMessageAs(job, "failed", message).catch(
      logged("generation.finalize_failed", { jobId: job.id }),
    );
    await finishGenerationJob({
      jobId: job.id,
      lockedBy: job.locked_by!,
      status: "failed",
      error: toUserFacingChatError(message),
    }).catch(() => undefined);
    await publishLiveTurn({
      chatId: job.chat_id,
      userId: job.user_id,
      assistantId: job.assistant_message_id ?? job.id,
      status: "failed",
      leaseId,
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
    if (
      current &&
      !["queued", "running", "continuing"].includes(current.status)
    ) {
      const next = await getActiveGenerationJobForChat(job.chat_id);
      if (next?.status === "queued")
        await triggerContinuation(
          next.input.executionOrigin ?? origin,
          next.id,
        );
      else if (!next)
        await chatsRepo.setChatGenerating(job.chat_id, job.user_id, false);
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
  // Bound recovery wall time even when every internal request times out.
  for (let offset = 0; offset < stalled.length; offset += 5) {
    const results = await Promise.all(
      stalled
        .slice(offset, offset + 5)
        .map((job) =>
          triggerContinuation(job.input.executionOrigin ?? origin, job.id),
        ),
    );
    triggered += results.filter(Boolean).length;
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
  const cancelledJobs = await cancelActiveJobsForChat(chatId, userId);
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
  const content =
    status === "cancelled" ? "" : toUserFacingChatError(message ?? "");
  await messagesRepo.finalizeAssistantTurn({
    generationLease: { jobId: job.id, lockedBy: job.locked_by! },
    messageId: job.assistant_message_id,
    chatId: job.chat_id,
    userId: job.user_id,
    content,
    status,
    contentJson: buildAssistantTranscriptRecord({ answer: content }),
    tools: [],
    transcriptLines: [],
  });
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
