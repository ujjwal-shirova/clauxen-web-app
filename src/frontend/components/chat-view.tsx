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

interface ChatViewProps {
  projectId?: string | null;
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

export function ChatView({ projectId = null, projectBreadcrumb }: ChatViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const overlays = useAppOverlays();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();

  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const chat = useChat({
    apiEnabled: false,
    projectId,
    thinkingEnabled,
    webSearchEnabled,
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
      const chatId = await handleSendMessage(prompt);
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

  const displayMessages = isNewChatHome ? [] : messages;
  const displayActiveChatId = isNewChatHome ? null : activeChatId;
  const displayActiveChat = isNewChatHome ? null : activeChat;

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
      thinkingEnabled={thinkingEnabled}
      onThinkingEnabledChange={setThinkingEnabled}
      webSearchEnabled={webSearchEnabled}
      onWebSearchEnabledChange={setWebSearchEnabled}
      chatModel={chatModel}
      onChatModelChange={setChatModel}
      onOpenMobileNav={openMobileNav}
      showMobileMenu={isMobile && isSidebarCollapsed}
      projectBreadcrumb={projectBreadcrumb}
    />
  );
}
