import type { Metadata } from "next";
import { cookies } from "next/headers";
import { formatChatTabTitle } from "@/lib/document-title";
import { getClaimsFromCookies } from "@/server/auth/jwt";
import * as chatsRepo from "@/server/repositories/chats.repository";

/** Tab title for `/c/:id` and project chats. One title lookup, not the thread. */
export async function chatDocumentMetadata(chatId: string): Promise<Metadata> {
  const fallback = { title: formatChatTabTitle(null) };
  if (!chatId || chatId.length > 200) return fallback;

  try {
    const claims = await getClaimsFromCookies(await cookies());
    if (!claims) return fallback;
    const chat = await chatsRepo.getChatForUser(chatId, claims.sub);
    return { title: formatChatTabTitle(chat?.title) };
  } catch {
    return fallback;
  }
}
