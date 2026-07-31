"use client";

import { CustomizePage } from "@/components/customize-page";
import { useChatStore } from "@/stores/chat-store";
import { APP_ROUTES } from "@/lib/app-routes";
import { useMemo } from "react";

export function CustomizeRouteContent({
  initialTab = null,
}: {
  initialTab?: "skills" | null;
}) {
  const closeHref = useMemo(() => {
    const state = useChatStore.getState();
    const chatId = state.activeChatId;
    const chat = state.recentChats?.find((c) => c.id === chatId);
    if (!chatId) return APP_ROUTES.newChat;
    return chat?.projectId
      ? APP_ROUTES.projectChat(chatId)
      : APP_ROUTES.chat(chatId);
  }, []);

  return <CustomizePage initialTab={initialTab} closeHref={closeHref} />;
}
