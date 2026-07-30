import { apiFetch } from "@/lib/api/client";
import { FULL_CHAT_HYDRATE_LIMIT } from "@/lib/chat-history-page-size";
import { getSupabaseAccessTokenSingleflight } from "@/lib/supabase-session-singleflight";

export type ApiChat = {
  id: string;
  name: string;
  projectId: string | null;
  starred: boolean;
  pinned?: boolean;
  updatedAt: string;
};

export type ApiMessage = {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  status: string;
  metadata: Record<string, unknown>;
  content_json?: Record<string, unknown>;
  created_at: string;
  client_id?: string | null;
};

function chatHistoryWorkerBase(): string {
  return (process.env.NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL ?? "").replace(
    /\/+$/,
    "",
  );
}

/** Prefer Cloudflare Worker (Hyperdrive + cache ladder) when configured. */
async function listChatsViaWorker(projectId?: string): Promise<{
  chats: ApiChat[];
} | null> {
  const base = chatHistoryWorkerBase();
  if (!base || typeof window === "undefined") return null;

  try {
    const accessToken = await getSupabaseAccessTokenSingleflight();
    if (!accessToken) return null;

    const params = new URLSearchParams({ limit: "50" });
    if (projectId) params.set("projectId", projectId);
    const response = await fetch(`${base}/v1/chats?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      credentials: "omit",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: { chats?: ApiChat[] };
      chats?: ApiChat[];
    };
    const chats = payload.data?.chats ?? payload.chats;
    if (!Array.isArray(chats)) return null;
    return { chats };
  } catch {
    return null;
  }
}

export async function listChats(projectId?: string) {
  const fromWorker = await listChatsViaWorker(projectId);
  if (fromWorker) return fromWorker;

  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiFetch<{ chats: ApiChat[] }>(`/api/v1/chats${qs}`);
}

export async function createChat(input?: {
  title?: string;
  projectId?: string;
}) {
  return apiFetch<{ chat: { id: string; title: string } }>("/api/v1/chats", {
    method: "POST",
    // JSON.stringify — request body serialize
    body: JSON.stringify(input ?? {}),
  });
}

export type MessagePageCursor = {
  id: string;
  createdAt: string;
};

export type MessagesPage = {
  messages: ApiMessage[];
  nextCursor: MessagePageCursor | null;
  hasMore: boolean;
};

/** Prefer Cloudflare Worker (Hyperdrive) when configured; fall back to Next API. */
async function listMessagesPageViaWorker(
  chatId: string,
  input?: {
    cursorId?: string;
    cursorCreatedAt?: string;
    limit?: number;
  },
): Promise<MessagesPage | null> {
  const base = chatHistoryWorkerBase();
  if (!base || typeof window === "undefined") return null;

  try {
    const accessToken = await getSupabaseAccessTokenSingleflight();
    if (!accessToken) return null;

    const params = new URLSearchParams();
    if (input?.limit) params.set("limit", String(input.limit));
    if (input?.cursorId) params.set("cursor_id", input.cursorId);
    if (input?.cursorCreatedAt) {
      params.set("cursor_created_at", input.cursorCreatedAt);
    }
    const qs = params.toString();
    const response = await fetch(
      `${base}/v1/chats/${encodeURIComponent(chatId)}/messages${qs ? `?${qs}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        credentials: "omit",
        // Fail open to Next API if Worker hangs — avoids stuck message shimmer.
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: MessagesPage };
    return payload.data ?? null;
  } catch {
    return null;
  }
}

export async function getChat(chatId: string) {
  return apiFetch<{
    chat: unknown;
    messages: ApiMessage[];
    nextCursor?: MessagePageCursor | null;
    hasMore?: boolean;
  }>(`/api/v1/chats/${encodeURIComponent(chatId)}`);
}

/** Keyset page — latest when cursor omitted; older when cursor provided. */
export async function listMessagesPage(
  chatId: string,
  input?: {
    cursorId?: string;
    cursorCreatedAt?: string;
    limit?: number;
  },
) {
  const fromWorker = await listMessagesPageViaWorker(chatId, input);
  if (fromWorker) return fromWorker;

  const params = new URLSearchParams();
  if (input?.limit) params.set("limit", String(input.limit));
  if (input?.cursorId) params.set("cursor_id", input.cursorId);
  if (input?.cursorCreatedAt) {
    params.set("cursor_created_at", input.cursorCreatedAt);
  }
  const qs = params.toString();
  return apiFetch<MessagesPage>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/messages${qs ? `?${qs}` : ""}`,
  );
}

/**
 * Load the full conversation in one shot (Worker-first).
 * Silently continues keyset pages only when a thread exceeds the hydrate window.
 */
export async function listAllChatMessages(chatId: string): Promise<{
  messages: ApiMessage[];
}> {
  const limit = FULL_CHAT_HYDRATE_LIMIT;
  const first = await listMessagesPage(chatId, { limit });
  if (!first.hasMore || !first.nextCursor) {
    return { messages: first.messages };
  }

  let messages = first.messages;
  let cursor = first.nextCursor;
  // Rare long threads — finish before paint so the UI never shows pagination.
  for (let i = 0; i < 20 && cursor; i += 1) {
    const page = await listMessagesPage(chatId, {
      limit,
      cursorId: cursor.id,
      cursorCreatedAt: cursor.createdAt,
    });
    messages = [...page.messages, ...messages];
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return { messages };
}

export async function appendMessage(
  chatId: string,
  content: string,
  options?: { fileIds?: string[] },
) {
  return apiFetch<{ message: ApiMessage }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/messages`,
    {
      method: "POST",
      // JSON.stringify — request body serialize
      body: JSON.stringify({
        content,
        fileIds: options?.fileIds,
      }),
    },
  );
}

export async function updateChat(
  chatId: string,
  patch: { title?: string; starred?: boolean; projectId?: string | null },
) {
  return apiFetch<{ chat: unknown }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}`,
    {
      method: "PATCH",
      // JSON.stringify — request body serialize
      body: JSON.stringify(patch),
    },
  );
}

export async function deleteChat(chatId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}`,
    { method: "DELETE" },
  );
}

/** Soft-archive: snapshot to R2 then mark archived. */
export async function archiveChat(chatId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/archive`,
    { method: "POST" },
  );
}

/** Unarchive: restore from the R2 archive bucket back into Supabase. */
export async function unarchiveChat(chatId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/unarchive`,
    { method: "POST" },
  );
}

export async function pinChat(chatId: string) {
  return apiFetch<{ pinned: unknown }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/pin`,
    { method: "POST" },
  );
}

export async function unpinChat(chatId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/pin`,
    { method: "DELETE" },
  );
}

export async function searchChats(query: string) {
  return apiFetch<{ results: Array<{ chatId: string; snippet: string }> }>(
    `/api/v1/chats/search?q=${encodeURIComponent(query)}`,
  );
}

export async function generateChatTitle(
  chatId: string,
  messages: Array<{ role: string; content: string }>,
) {
  return apiFetch<{ title: string }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/title`,
    {
      method: "POST",
      // JSON.stringify — request body serialize
      body: JSON.stringify({ messages }),
    },
  );
}

export async function getBranchState(chatId: string) {
  return apiFetch<{
    state: { messages?: unknown; active_path?: unknown } | null;
  }>(`/api/v1/chats/${encodeURIComponent(chatId)}/branches`);
}

export async function saveBranchState(
  chatId: string,
  activePath: unknown,
  messages: unknown,
) {
  return apiFetch<{ state: unknown }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/branches`,
    {
      method: "PUT",
      // JSON.stringify — request body serialize
      body: JSON.stringify({ activePath, messages }),
    },
  );
}

/** Download Cursor-style JSONL transcript for a chat (training export). */
export async function getChatTranscript(
  chatId: string,
  format: "jsonl" | "json" = "json",
) {
  if (format === "jsonl") {
    const response = await fetch(
      `/api/v1/chats/${encodeURIComponent(chatId)}/transcript?format=jsonl`,
      { credentials: "include" },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript (${response.status})`);
    }
    return response.text();
  }
  return apiFetch<{
    chatId: string;
    title: string;
    lineCount: number;
    trainingEligible: boolean;
    schemaVersion: string;
    jsonl: string;
  }>(`/api/v1/chats/${encodeURIComponent(chatId)}/transcript?format=json`);
}
