import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { formatChatTabTitle } from "@/lib/document-title";
import { getClaimsFromCookies } from "@/server/auth/jwt";
import * as chatsRepo from "@/server/repositories/chats.repository";

/** Tab title for `/c/:id` and project chats. One title lookup, not the thread. */
export async function chatDocumentMetadata(chatId: string): Promise<Metadata> {
  const fallback = { title: formatChatTabTitle(null) };
  if (!chatId || chatId.length > 200) return fallback;

  try {
    const requestHeaders = await headers();
    // Client navigations are handled on the client by useDocumentTitle; skip redundant server DB queries.
    if (requestHeaders.get("rsc") === "1") return fallback;

    const claims = await getClaimsFromCookies(await cookies());
    if (!claims) return fallback;
    const chat = await Promise.race([
      chatsRepo.getChatForUser(chatId, claims.sub),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
    ]);
    return { title: formatChatTabTitle(chat?.title) };
  } catch {
    return fallback;
  }
}
