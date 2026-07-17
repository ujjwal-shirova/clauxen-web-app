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
} from "@/backend/chat/chat-coord-client";

type GenerationEntry = {
  controller: AbortController;
  startedAt: number;
  leaseId: string;
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
  generations.set(chatId, { controller, startedAt: Date.now(), leaseId });

  // Poll Durable Object stop flag so a stop hit on another isolate still cancels.
  const poll = setInterval(() => {
    void getChatCoordStatus(chatId).then((status) => {
      if (!status?.stopRequested) return;
      const entry = generations.get(chatId);
      if (!entry || entry.leaseId !== leaseId) return;
      entry.controller.abort();
    });
  }, 750);
  controller.signal.addEventListener(
    "abort",
    () => {
      clearInterval(poll);
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
  void releaseChatCoordLease(chatId, entry.leaseId);
  return true;
}

export async function endChatGeneration(
  chatId: string,
  controller: AbortController,
) {
  const entry = generations.get(chatId);
  if (entry?.controller === controller) {
    generations.delete(chatId);
    void releaseChatCoordLease(chatId, entry.leaseId);
  }
}

export function isChatGenerationActive(chatId: string): boolean {
  return generations.has(chatId);
}
