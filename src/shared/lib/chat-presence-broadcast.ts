import { createClient } from "@/utils/supabase/client";

/**
 * Ephemeral Realtime Broadcast for typing / presence.
 * Does not touch Postgres WAL (unlike postgres_changes).
 */
export function chatPresenceChannel(chatId: string) {
  const supabase = createClient();
  return supabase.channel(`presence:${chatId}`, {
    config: { broadcast: { self: false } },
  });
}

export type PresenceBroadcastEvent = "typing" | "assistant_started";

export async function broadcastChatPresence(
  chatId: string,
  event: PresenceBroadcastEvent,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createClient();
  const channel = supabase.channel(`presence:${chatId}`, {
    config: { broadcast: { self: false } },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("subscribe timeout")), 2_000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(status));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event,
      payload: { ...payload, at: Date.now() },
    });
  } catch (error) {
    console.warn("[presence] broadcast failed", event, error);
  } finally {
    void supabase.removeChannel(channel);
  }
}

export function broadcastTyping(chatId: string, userId: string) {
  return broadcastChatPresence(chatId, "typing", { userId });
}

export function broadcastAssistantStarted(chatId: string) {
  return broadcastChatPresence(chatId, "assistant_started");
}
