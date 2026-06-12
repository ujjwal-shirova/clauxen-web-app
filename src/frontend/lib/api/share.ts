import { apiFetch } from "@/frontend/lib/api/client";

export type ChatShareState = {
  share: { id: string; visibility: string } | null;
  shareUrl: string | null;
  visibility: string;
};

export async function getChatShare(chatId: string) {
  return apiFetch<ChatShareState>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/share`,
  );
}

export async function createChatShare(
  chatId: string,
  input?: { visibility?: "link" | "workspace" | "public"; revoke?: boolean },
) {
  return apiFetch<ChatShareState>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/share`,
    {
      method: "POST",
      // JSON.stringify — request body serialize
      body: JSON.stringify(input ?? {}),
    },
  );
}
