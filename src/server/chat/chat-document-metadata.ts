import type { Metadata } from "next";
import { formatChatTabTitle } from "@/lib/document-title";
import { createClient } from "@/utils/supabase/server";
import * as chatsRepo from "@/server/repositories/chats.repository";

/** Tab title for `/c/:id` and project chats. One title lookup, not the thread. */
export async function chatDocumentMetadata(chatId: string): Promise<Metadata> {
  const fallback = { title: formatChatTabTitle(null) };
  if (!chatId || chatId.length > 200) return fallback;

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return fallback;
    const chat = await chatsRepo.getChatForUser(chatId, userId);
    return { title: formatChatTabTitle(chat?.title) };
  } catch {
    return fallback;
  }
}
