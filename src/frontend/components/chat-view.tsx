"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChatArea } from "@/frontend/components/chat-area";
import { useOptionalChatSession } from "@/frontend/contexts/chat-session-context";
import { useChat } from "@/frontend/hooks/use-chat";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";
import { useAppLayout } from "@/frontend/components/app-layout-context";
import { APP_ROUTES, isNewChatPath } from "@/frontend/lib/app-routes";
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

type ChatController = ReturnType<typeof useChat> & {
  chatModel?: ChatModelId;
  setChatModel?: (model: ChatModelId) => void;
  homerReasoningEffort?: HomerReasoningEffort;
  setHomerReasoningEffort?: (effort: HomerReasoningEffort) => void;
};

function getRouteChatId(pathname: string): string | null {
  return (
    pathname.match(/\/conversations\/([^/]+)/)?.[1] ??
    pathname.match(/^\/c\/([^/]+)/)?.[1] ??
    null
  );
}

function ChatViewBody({
  chat,
  projectId = null,
  projectBreadcrumb,
}: {
  chat: ChatController;
  projectId?: string | null;
  projectBreadcrumb?: ChatViewProps["projectBreadcrumb"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const overlays = useAppOverlays();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();

  const [localEffort, setLocalEffort] = useState<HomerReasoningEffort>(
    DEFAULT_HOMER_REASONING_EFFORT,
  );
  const [localModel, setLocalModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const homerReasoningEffort =
    chat.homerReasoningEffort ?? localEffort;
  const setHomerReasoningEffort =
    chat.setHomerReasoningEffort ?? setLocalEffort;
  const chatModel = chat.chatModel ?? localModel;
  const setChatModel = chat.setChatModel ?? setLocalModel;

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
  const isNewChatHome = !projectId && isNewChatPath(pathname);

  useEffect(() => {
    if (routeChatId) {
      void handleSelectChat(routeChatId);
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
        router.replace(APP_ROUTES.projectConversation(projectId, chatId), {
          scroll: false,
        });
        return;
      }

      if (isNewChatHome) {
        router.replace(APP_ROUTES.chat(chatId), { scroll: false });
      }
    },
    [handleSendMessage, isNewChatHome, projectId, router],
  );

  // On home, always show a blank new-chat composer until the user sends.
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

/**
 * Project conversation routes may pass an explicit apiEnabled.
 * Home /c routes reuse the shell ChatSessionProvider (single hydration).
 */
export function ChatView({
  projectId = null,
  apiEnabled,
  projectBreadcrumb,
}: ChatViewProps) {
  const auth = useAuth();
  const session = useOptionalChatSession();

  // Wait for auth before creating a standalone (project) chat hook so
  // apiEnabled never flips from false → true inside one mount.
  if (projectId && auth.loading) {
    return null;
  }

  if (session && !projectId) {
    return (
      <ChatViewBody
        chat={session}
        projectId={projectId}
        projectBreadcrumb={projectBreadcrumb}
      />
    );
  }

  return (
    <ChatViewStandalone
      key={`${auth.user?.id ?? "anon"}:${projectId ?? "home"}`}
      projectId={projectId}
      apiEnabled={apiEnabled ?? Boolean(auth.user)}
      projectBreadcrumb={projectBreadcrumb}
    />
  );
}

function ChatViewStandalone({
  projectId,
  apiEnabled,
  projectBreadcrumb,
}: {
  projectId?: string | null;
  apiEnabled: boolean;
  projectBreadcrumb?: ChatViewProps["projectBreadcrumb"];
}) {
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);
  const [homerReasoningEffort, setHomerReasoningEffort] =
    useState<HomerReasoningEffort>(DEFAULT_HOMER_REASONING_EFFORT);

  const chat = useChat({
    apiEnabled,
    projectId,
    chatModel,
    homerReasoningEffort,
  });

  return (
    <ChatViewBody
      chat={{
        ...chat,
        chatModel,
        setChatModel,
        homerReasoningEffort,
        setHomerReasoningEffort,
      }}
      projectId={projectId}
      projectBreadcrumb={projectBreadcrumb}
    />
  );
}
