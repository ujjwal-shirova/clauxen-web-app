import { apiFetch } from "@/lib/api/client";
import { FULL_CHAT_HYDRATE_LIMIT } from "@/lib/chat-history-page-size";
import { getSupabaseAccessTokenSingleflight } from "@/lib/supabase-session-singleflight";

export type ApiChat = {
  id: string;
  name: string;
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
  /** Server message tree — branch fork point + variant position. */
  parent_message_id?: string | null;
  variant_index?: number;
  variant_count?: number;
};

function chatHistoryWorkerBase(): string {
  return (process.env.NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL ?? "").replace(
    /\/+$/,
    "",
  );
}

/** Prefer Cloudflare Worker (Hyperdrive + cache ladder) when configured. */
async function listChatsViaWorker(): Promise<{
  chats: ApiChat[];
} | null> {
  const base = chatHistoryWorkerBase();
  if (!base || typeof window === "undefined") return null;

  try {
    const accessToken = await getSupabaseAccessTokenSingleflight();
    if (!accessToken) return null;

    const params = new URLSearchParams({ limit: "50", fresh: "0" });
    const response = await fetch(`${base}/v1/chats?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      credentials: "omit",
      signal: AbortSignal.timeout(1_500),
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

export async function searchChatTitles(query: string, limit = 40) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (limit) params.set("limit", String(limit));
  const suffix = params.toString();
  return apiFetch<{ chats: ApiChat[] }>(
    suffix ? `/api/v1/chats?${suffix}` : "/api/v1/chats",
  );
}

export async function listGeneratingChatIds() {
  return apiFetch<{ ids: string[] }>("/api/v1/chats/generating");
}

export type LiveTurn = {
  chatId: string;
  userId: string;
  assistantId: string;
  status: "running" | "complete" | "failed" | "cancelled";
  answer: string;
  contentJson: unknown;
  updatedAt?: number;
  archiveAt?: number | null;
};

export async function getLiveTurn(chatId: string) {
  return apiFetch<{ turn: LiveTurn | null }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/live`,
  );
}

export async function listChats() {
  const nextPromise = apiFetch<{ chats: ApiChat[] }>("/api/v1/chats");
  const workerPromise = listChatsViaWorker();

  // Race Worker vs Next — first usable result wins.
  const first = await Promise.race([
    workerPromise
      .then((result) =>
        result ? { ok: true as const, result } : { ok: false as const },
      )
      .catch(() => ({ ok: false as const })),
    nextPromise
      .then((result) => ({ ok: true as const, result }))
      .catch(() => ({ ok: false as const })),
  ]);

  if (first.ok) return first.result;
  return nextPromise;
}

export async function createChat(input?: {
  id?: string;
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
  depth: number;
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
    cursorDepth?: number;
    limit?: number;
  },
): Promise<MessagesPage | null> {
  const base = chatHistoryWorkerBase();
  if (!base || typeof window === "undefined") return null;

  try {
    const accessToken = await getSupabaseAccessTokenSingleflight();
    if (!accessToken) return null;

    const params = new URLSearchParams();
    params.set("fresh", "0");
    if (input?.limit) params.set("limit", String(input.limit));
    if (typeof input?.cursorDepth === "number") {
      params.set("cursor_depth", String(input.cursorDepth));
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
        // Fail open to Next API fast if Worker hangs — avoids stuck shimmer.
        signal: AbortSignal.timeout(1_200),
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
    cursorDepth?: number;
    limit?: number;
  },
): Promise<MessagesPage> {
  const params = new URLSearchParams();
  if (input?.limit) params.set("limit", String(input.limit));
  if (typeof input?.cursorDepth === "number") {
    params.set("cursor_depth", String(input.cursorDepth));
  }
  const qs = params.toString();
  const nextPromise = apiFetch<MessagesPage>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/messages${qs ? `?${qs}` : ""}`,
  );
  const workerPromise = listMessagesPageViaWorker(chatId, input);

  // Race Worker vs Next — first usable result wins.
  const first = await Promise.race([
    workerPromise
      .then((result) =>
        result && Array.isArray(result.messages)
          ? { ok: true as const, result }
          : { ok: false as const },
      )
      .catch(() => ({ ok: false as const })),
    nextPromise
      .then((result) =>
        result && Array.isArray(result.messages)
          ? { ok: true as const, result }
          : { ok: false as const },
      )
      .catch(() => ({ ok: false as const })),
  ]);

  if (first.ok) return first.result;
  return nextPromise;
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

  // First page = newest batch; older keyset pages prepend chronologically.
  // Dedupe defensively so a cursor boundary can never double-paint a row.
  let messages = first.messages;
  const seen = new Set(messages.map((message) => message.id));
  let cursor = first.nextCursor;
  // Rare long threads — finish before paint so the UI never shows pagination.
  for (let i = 0; i < 20 && cursor; i += 1) {
    const page = await listMessagesPage(chatId, {
      limit,
      cursorDepth: cursor.depth,
    });
    const older = page.messages.filter((message) => !seen.has(message.id));
    for (const message of older) seen.add(message.id);
    messages = [...older, ...messages];
    if (!page.hasMore || !page.nextCursor) break;
    // Guard against a non-advancing cursor (would loop on the same batch).
    if (page.nextCursor.depth === cursor.depth) break;
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
  patch: { title?: string; starred?: boolean },
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

/**
 * Switch the visible branch at a fork point (branch arrows).
 * Server-authoritative: repoints the chat's active leaf and returns the
 * refreshed active-path page for the client to render.
 */
export async function switchThreadBranch(chatId: string, messageId: string) {
  return apiFetch<{
    leafId: string;
    messages: ApiMessage[];
    nextCursor: MessagePageCursor | null;
    hasMore: boolean;
  }>(`/api/v1/chats/${encodeURIComponent(chatId)}/branches`, {
    method: "POST",
    // JSON.stringify — request body serialize
    body: JSON.stringify({ messageId }),
  });
}

/** Download JSONL transcript for a chat (training export). */
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
    messages: unknown[];
    trainingMessages: Array<{ role: string; content: unknown[] }>;
    events: unknown[];
    jsonl: string;
  }>(`/api/v1/chats/${encodeURIComponent(chatId)}/transcript?format=json`);
}
