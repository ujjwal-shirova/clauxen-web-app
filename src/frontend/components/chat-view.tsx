"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChatArea } from "@/frontend/components/chat-area";
import { useChat } from "@/frontend/hooks/use-chat";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";
import { useAppLayout } from "@/frontend/components/app-layout-context";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
} from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

interface ChatViewProps {
  projectId?: string | null;
  apiEnabled?: boolean;
  projectBreadcrumb?: {
    label: string;
    onClick: () => void;
  };
}

function getRouteChatId(pathname: string): string | null {
  return (
    pathname.match(/\/conversations\/([^/]+)/)?.[1] ??
    pathname.match(/^\/c\/([^/]+)/)?.[1] ??
    null
  );
}

export function ChatView({ projectId = null, apiEnabled = false, projectBreadcrumb }: ChatViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const overlays = useAppOverlays();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();

  const [homerReasoningEffort, setHomerReasoningEffort] =
    useState<HomerReasoningEffort>(DEFAULT_HOMER_REASONING_EFFORT);
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const chat = useChat({
    apiEnabled,
    projectId,
    homerReasoningEffort,
    chatModel,
  });

  const {
    messages,
    activeChat,
    activeChatId,
    isGenerating,
    handleSendMessage,
    stopGeneration,
    editMessageWithBranch,
    redoUserMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
    handleRenameChat,
    handlePinChat,
    handleDeleteChat,
    startNewChat,
    handleSelectChat,
  } = chat;

  const routeChatId = getRouteChatId(pathname);
  const isNewChatHome = !projectId && pathname === "/";

  useEffect(() => {
    if (routeChatId) {
      handleSelectChat(routeChatId);
      return;
    }
    if (isNewChatHome) {
      startNewChat();
    }
  }, [routeChatId, isNewChatHome, handleSelectChat, startNewChat]);

  const handleSendMessageAndRoute = useCallback(
    async (prompt: string) => {
      const chatId = await handleSendMessage(prompt, {
        forceNewChat: isNewChatHome,
      });
      if (!chatId) return;

      if (projectId) {
        router.replace(`/projects/${projectId}/conversations/${chatId}`, {
          scroll: false,
        });
        return;
      }

      if (isNewChatHome) {
        router.replace(`/c/${chatId}`, { scroll: false });
      }
    },
    [handleSendMessage, isNewChatHome, projectId, router],
  );

  // On home, show messages once a chat has actually been created (avoids empty
  // flash between send and route change). Once the URL switches to /c/{id},
  // isNewChatHome is false and this falls through to the normal messages.
  const hasStartedChat = isNewChatHome && messages.length > 0;
  const displayMessages = isNewChatHome && !hasStartedChat ? [] : messages;
  const displayActiveChatId = isNewChatHome && !hasStartedChat ? null : activeChatId;
  const displayActiveChat = isNewChatHome && !hasStartedChat ? null : activeChat;

  return (
    <ChatArea
      messages={displayMessages}
      onSendMessage={handleSendMessageAndRoute}
      onStopGeneration={stopGeneration}
      isGenerating={isGenerating}
      onUpgradeClick={() => overlays.openPricing()}
      editMessageWithBranch={editMessageWithBranch}
      redoUserMessageWithBranch={redoUserMessageWithBranch}
      retryAssistantWithBranch={retryAssistantWithBranch}
      switchMessageBranch={switchMessageBranch}
      activeChatId={displayActiveChatId}
      activeChatTitle={displayActiveChat?.name ?? "New Chat"}
      isActiveChatTitleStreaming={!!displayActiveChat?.isTitleStreaming}
      isActiveChatPinned={!!displayActiveChat?.pinned}
      onRenameChat={handleRenameChat}
      onPinChat={handlePinChat}
      onDeleteChat={handleDeleteChat}
      onOpenSettings={() => overlays.openSettings("General")}
      onMoveToProject={() => router.push("/projects")}
      homerReasoningEffort={homerReasoningEffort}
      onHomerReasoningEffortChange={setHomerReasoningEffort}
      chatModel={chatModel}
      onChatModelChange={setChatModel}
      onOpenMobileNav={openMobileNav}
      showMobileMenu={isMobile && isSidebarCollapsed}
      projectBreadcrumb={projectBreadcrumb}
    />
  );
}
