"use client";

import type { Message } from "@/frontend/lib/types";
import { useChatStore } from "@/frontend/stores/chat-store";

export type AllChats = Record<string, Message[]>;

/** Drop-in replacement for useState setAllChats — writes to normalized Zustand store. */
export function setAllChatsNormalized(
  updater: AllChats | ((prev: AllChats) => AllChats),
): void {
  const store = useChatStore.getState();
  const prev = store.exportLegacyAllChats();
  const next = typeof updater === "function" ? updater(prev) : updater;

  for (const chatId of Object.keys(prev)) {
    if (!next[chatId]) store.removeChat(chatId);
  }
  for (const [chatId, messages] of Object.entries(next)) {
    store.setChatMessages(chatId, messages);
  }
}

export function getAllChatsNormalized(): AllChats {
  return useChatStore.getState().exportLegacyAllChats();
}

export function patchAssistantMessage(
  chatId: string,
  assistantMessageId: string,
  updater: (message: Message) => Message,
): void {
  useChatStore.getState().patchMessage(chatId, assistantMessageId, updater);
}
