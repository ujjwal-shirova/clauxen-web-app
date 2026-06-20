"use client";

import { useRouter } from "next/navigation";
import { CustomizePage } from "@/frontend/components/customize-page";
import { useChatStore } from "@/frontend/stores/chat-store";

export function CustomizeRouteContent({
  initialTab = null,
}: {
  initialTab?: "skills" | "connectors" | null;
}) {
  const router = useRouter();

  return (
    <CustomizePage
      initialTab={initialTab}
      onClose={() => {
        const state = useChatStore.getState();
        const chatId = state.activeChatId;
        const chat = state.recentChats?.find((c) => c.id === chatId);
        const target = chatId
          ? chat?.projectId
            ? `/projects/${chat.projectId}/conversations/${chatId}`
            : `/c/${chatId}`
          : "/";

        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(target);
        }
      }}
    />
  );
}
