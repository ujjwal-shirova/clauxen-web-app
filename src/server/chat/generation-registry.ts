/**
 * In-process AbortController registry + optional Cloudflare Durable Object lease.
 * The DO is the cross-isolate source of truth for "already generating".
 * The local map still aborts the SSE pump on this isolate when stop is called here.
 *
 * TTFT: claim the local map immediately and return the AbortController without
 * awaiting the DO round-trip. Callers start SSE, then `await session.lease`
 * inside resolveContext before the model / durable turn insert.
 */
import { randomUUID } from "node:crypto";
import {
  acquireChatCoordLease,
  releaseChatCoordLease,
  requestChatCoordStop,
  getChatCoordStatus,
  renewChatCoordLease,
} from "@/server/chat/chat-coord-client";

export type ChatCoordLeaseResult = "acquired" | "conflict" | "skipped";

export type ChatGenerationSession = {
  controller: AbortController;
  /** Settles when the Durable Object lease is decided (or skipped). */
  lease: Promise<ChatCoordLeaseResult>;
};

type GenerationEntry = {
  controller: AbortController;
  startedAt: number;
  leaseId: string;
  poll: ReturnType<typeof setInterval> | null;
  heartbeat: ReturnType<typeof setInterval> | null;
  leaseResult: ChatCoordLeaseResult | null;
};

const generations = new Map<string, GenerationEntry>();

function startLeaseWatchdogs(chatId: string, entry: GenerationEntry) {
  const { leaseId, controller } = entry;
  if (entry.poll || entry.heartbeat) return;

  const poll = setInterval(() => {
    void getChatCoordStatus(chatId)
      .then((status) => {
        if (!status?.stopRequested) return;
        const current = generations.get(chatId);
        if (!current || current.leaseId !== leaseId) return;
        current.controller.abort();
      })
      .catch(() => undefined);
  }, 400);

  const heartbeat = setInterval(() => {
    void renewChatCoordLease(chatId, leaseId)
      .then((result) => {
        if (result !== "lost") return;
        const current = generations.get(chatId);
        if (!current || current.leaseId !== leaseId) return;
        // Another holder reclaimed this lease; stop this isolate to preserve
        // the single-writer invariant for the assistant turn.
        current.controller.abort();
      })
      .catch(() => undefined);
  }, 20_000);

  entry.poll = poll;
  entry.heartbeat = heartbeat;
  controller.signal.addEventListener(
    "abort",
    () => {
      clearInterval(poll);
      clearInterval(heartbeat);
      entry.poll = null;
      entry.heartbeat = null;
    },
    { once: true },
  );
}

/**
 * Begin a generation. Returns null when this isolate already has an active turn.
 * Does not await the Cloudflare DO lease — await `session.lease` before mutating
 * durable state or calling the model.
 */
export function beginChatGeneration(
  chatId: string,
): ChatGenerationSession | null {
  if (generations.has(chatId)) {
    return null;
  }

  const leaseId = randomUUID();
  const controller = new AbortController();
  const entry: GenerationEntry = {
    controller,
    startedAt: Date.now(),
    leaseId,
    poll: null,
    heartbeat: null,
    leaseResult: null,
  };
  generations.set(chatId, entry);

  const lease = acquireChatCoordLease(chatId, leaseId).then((result) => {
    const current = generations.get(chatId);
    if (!current || current.leaseId !== leaseId) {
      // Local generation already ended; drop a late-acquired DO lease.
      if (result === "acquired") {
        void releaseChatCoordLease(chatId, leaseId);
      }
      return result === "conflict" ? "conflict" : "skipped";
    }

    if (result === "conflict") {
      current.leaseResult = "conflict";
      generations.delete(chatId);
      if (current.poll) clearInterval(current.poll);
      if (current.heartbeat) clearInterval(current.heartbeat);
      current.controller.abort();
      return "conflict";
    }

    current.leaseResult = result;
    if (result === "acquired") {
      startLeaseWatchdogs(chatId, current);
    }
    return result;
  });

  return { controller, lease };
}

export async function abortChatGeneration(chatId: string): Promise<boolean> {
  await requestChatCoordStop(chatId);
  const entry = generations.get(chatId);
  if (!entry) {
    // Another isolate may hold the stream; DO stop flag is enough for that pump.
    return true;
  }
  entry.controller.abort();
  generations.delete(chatId);
  // Await release so the next send cannot race a still-held DO lease.
  await releaseChatCoordLease(chatId, entry.leaseId);
  return true;
}

export async function endChatGeneration(
  chatId: string,
  controller: AbortController,
) {
  const entry = generations.get(chatId);
  if (entry?.controller === controller) {
    generations.delete(chatId);
    if (entry.poll) clearInterval(entry.poll);
    if (entry.heartbeat) clearInterval(entry.heartbeat);
    // Must await: fire-and-forget left the DO lease active and the next
    // generate (immediate follow-up / ask-user answer) hit 409.
    await releaseChatCoordLease(chatId, entry.leaseId);
  }
}

export function isChatGenerationActive(chatId: string): boolean {
  return generations.has(chatId);
}
