import { env } from "@/server/config/env";

type CoordResponse = {
  ok?: boolean;
  error?: string;
  leaseId?: string;
  released?: boolean;
  stopRequested?: boolean;
  hadLease?: boolean;
  active?: boolean;
  renewed?: boolean;
  startedAt?: number | null;
};

function coordBase(): string {
  return (env.chatCoordWorkerUrl || "").replace(/\/+$/, "");
}

function coordToken(): string {
  return env.chatCoordInternalToken || "";
}

export function isChatCoordConfigured(): boolean {
  return Boolean(coordBase() && coordToken());
}

async function coordFetch(
  path: string,
  body: Record<string, string>,
): Promise<{ status: number; data: CoordResponse }> {
  const base = coordBase();
  const token = coordToken();
  if (!base || !token) {
    return { status: 503, data: { error: "chat_coord_unconfigured" } };
  }
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-clauxen-internal": token,
        // Some zone rules challenge bare scripted clients (CF 1010); keep a
        // stable product UA so Vercel→Worker lease calls are not blocked.
        "user-agent": "ClauxenChatCoord/1.0 (+https://clauxen.com)",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    const data = (await response.json().catch(() => ({}))) as CoordResponse;
    return { status: response.status, data };
  } catch {
    return { status: 503, data: { error: "chat_coord_unreachable" } };
  }
}

/** Acquire a global generation lease for this chat. Fail-open if Worker unset. */
export async function acquireChatCoordLease(
  chatId: string,
  leaseId: string,
): Promise<"acquired" | "conflict" | "skipped"> {
  if (!isChatCoordConfigured()) return "skipped";
  const { status, data } = await coordFetch("/lease", { chatId, leaseId });
  if (status === 409 || data.error === "generation_in_progress") {
    return "conflict";
  }
  if (status >= 200 && status < 300 && data.ok) return "acquired";
  // Fail open so a coord outage does not block chat entirely.
  console.warn("[chat-coord] lease failed open:", status, data.error);
  return "skipped";
}

export async function releaseChatCoordLease(
  chatId: string,
  leaseId: string,
): Promise<void> {
  if (!isChatCoordConfigured()) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { status } = await coordFetch("/release", { chatId, leaseId });
    if (status >= 200 && status < 300) return;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  console.warn("[chat-coord] lease release deferred to TTL:", chatId);
}

/** Keep a live lease renewable while allowing crashed holders to expire fast. */
export async function renewChatCoordLease(
  chatId: string,
  leaseId: string,
): Promise<"renewed" | "lost" | "skipped"> {
  if (!isChatCoordConfigured()) return "skipped";
  const { status, data } = await coordFetch("/heartbeat", { chatId, leaseId });
  if (status >= 200 && status < 300 && data.renewed) return "renewed";
  if (status === 409) return "lost";
  // A temporary Worker/network outage must not terminate healthy inference.
  console.warn("[chat-coord] heartbeat failed open:", status, data.error);
  return "skipped";
}

export async function requestChatCoordStop(chatId: string): Promise<boolean> {
  if (!isChatCoordConfigured()) return false;
  const { data } = await coordFetch("/stop", { chatId });
  return Boolean(data.stopRequested);
}

export async function getChatCoordStatus(chatId: string): Promise<{
  active: boolean;
  stopRequested: boolean;
} | null> {
  if (!isChatCoordConfigured()) return null;
  const { status, data } = await coordFetch("/status", { chatId });
  if (status < 200 || status >= 300) return null;
  return {
    active: Boolean(data.active),
    stopRequested: Boolean(data.stopRequested),
  };
}
