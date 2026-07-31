/**
 * In-process AbortController registry + optional Cloudflare Durable Object lease.
 * The DO is the cross-isolate source of truth for "already generating".
 * The local map still aborts the SSE pump on this isolate when stop is called here.
 */
import { randomUUID } from "node:crypto";
import {
  acquireChatCoordLease,
  releaseChatCoordLease,
  requestChatCoordStop,
  getChatCoordStatus,
  renewChatCoordLease,
} from "@/server/chat/chat-coord-client";

type GenerationEntry = {
  controller: AbortController;
  startedAt: number;
  leaseId: string;
  poll: ReturnType<typeof setInterval> | null;
  heartbeat: ReturnType<typeof setInterval> | null;
};

const generations = new Map<string, GenerationEntry>();

export async function beginChatGeneration(
  chatId: string,
): Promise<AbortController | null> {
  if (generations.has(chatId)) {
    return null;
  }

  const leaseId = randomUUID();
  const lease = await acquireChatCoordLease(chatId, leaseId);
  if (lease === "conflict") {
    return null;
  }

  const controller = new AbortController();
  const generationEntry: GenerationEntry = {
    controller,
    startedAt: Date.now(),
    leaseId,
    poll: null,
    heartbeat: null,
  };
  generations.set(chatId, generationEntry);

  // Poll Durable Object stop flag so a stop hit on another isolate still cancels.
  const poll = setInterval(() => {
    void getChatCoordStatus(chatId)
      .then((status) => {
        if (!status?.stopRequested) return;
        const entry = generations.get(chatId);
        if (!entry || entry.leaseId !== leaseId) return;
        entry.controller.abort();
      })
      .catch(() => undefined);
  }, 2_000);
  const heartbeat = setInterval(() => {
    void renewChatCoordLease(chatId, leaseId)
      .then((result) => {
        if (result !== "lost") return;
        const entry = generations.get(chatId);
        if (!entry || entry.leaseId !== leaseId) return;
        // Another holder reclaimed this lease; stop this isolate to preserve
        // the single-writer invariant for the assistant turn.
        entry.controller.abort();
      })
      .catch(() => undefined);
  }, 20_000);
  generationEntry.poll = poll;
  generationEntry.heartbeat = heartbeat;
  controller.signal.addEventListener(
    "abort",
    () => {
      clearInterval(poll);
      clearInterval(heartbeat);
      generationEntry.poll = null;
      generationEntry.heartbeat = null;
    },
    { once: true },
  );

  return controller;
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
