import type { Message } from "@/frontend/lib/types";

/** Stable React/stream key — prefers `clientId`, falls back to `id`. */
export function messageUiKey(message: Pick<Message, "id" | "clientId">): string {
  return message.clientId || message.id;
}
