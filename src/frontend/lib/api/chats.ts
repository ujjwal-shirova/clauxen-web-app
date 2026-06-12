import { apiFetch } from "@/frontend/lib/api/client";

export type ApiChat = {
  id: string;
  name: string;
  projectId: string | null;
  starred: boolean;
  updatedAt: string;
};

export type ApiMessage = {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listChats(projectId?: string) {
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

export async function getChat(chatId: string) {
  return apiFetch<{ chat: unknown; messages: ApiMessage[] }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}`,
  );
}

export async function appendMessage(chatId: string, content: string) {
  return apiFetch<{ message: ApiMessage }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/messages`,
    {
      method: "POST",
      // JSON.stringify — request body serialize
      body: JSON.stringify({ content }),
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
