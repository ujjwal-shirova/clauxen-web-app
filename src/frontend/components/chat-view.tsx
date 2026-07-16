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
import { useDocumentTitle } from "@/frontend/hooks/use-document-title";
import { useInstantNavigate } from "@/frontend/hooks/use-instant-navigate";
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
  const instantNavigate = useInstantNavigate();
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
    queuedMessages,
    editQueuedMessage,
    removeQueuedMessage,
    sendQueuedMessageNow,
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

  const creatingChatPending = Boolean(
    (chat as { creatingChatPending?: boolean }).creatingChatPending,
  );
  const messagesLoading = Boolean(
    (chat as { messagesLoading?: boolean }).messagesLoading,
  );

  const routeChatId = getRouteChatId(pathname);
  // Keep showing the live conversation as soon as a chat id / messages exist,
  // even before Next finishes soft-navigating off /new.
  const blankNewChatComposer =
    !projectId &&
    isNewChatPath(pathname) &&
    !activeChatId &&
    messages.length === 0 &&
    !creatingChatPending;

  useEffect(() => {
    if (routeChatId) {
      void handleSelectChat(routeChatId);
      return;
    }
    if (blankNewChatComposer) {
      startNewChat();
    }
  }, [routeChatId, blankNewChatComposer, handleSelectChat, startNewChat]);

  const openChatRoute = useCallback(
    (chatId: string) => {
      if (projectId) {
        instantNavigate(APP_ROUTES.projectConversation(projectId, chatId), {
          replace: true,
        });
        return;
      }
      instantNavigate(APP_ROUTES.chat(chatId), { replace: true });
    },
    [instantNavigate, projectId],
  );

  const handleSendMessageAndRoute = useCallback(
    async (
      prompt: string,
      options?: import("@/frontend/lib/composer-attachments").SendMessageOptions,
    ) => {
      const forceNew =
        !activeChatId && (blankNewChatComposer || isNewChatPath(pathname));
      const shouldOpenRoute =
        forceNew || isNewChatPath(pathname) || Boolean(projectId);

      const chatId = await handleSendMessage(prompt, {
        forceNewChat: forceNew,
        attachments: options?.attachments,
        // ChatGPT/Claude: swap URL the instant the durable chat id exists.
        ...(shouldOpenRoute ? { onChatCreated: openChatRoute } : {}),
      });
      if (!chatId) return;

      // Fallback navigate if onChatCreated did not run (e.g. existing chat on /new).
      const pathNow =
        typeof window !== "undefined" ? window.location.pathname : pathname;
      const targetPath = projectId
        ? APP_ROUTES.projectConversation(projectId, chatId)
        : APP_ROUTES.chat(chatId);
      if (shouldOpenRoute && pathNow !== targetPath) {
        openChatRoute(chatId);
      }
    },
    [
      handleSendMessage,
      blankNewChatComposer,
      activeChatId,
      projectId,
      pathname,
      openChatRoute,
    ],
  );

  const handleDeleteChatAndLeave = useCallback(
    async (chatId: string) => {
      const wasActive = activeChatId === chatId;
      await handleDeleteChat(chatId);
      if (!wasActive) return;
      const target = projectId
        ? APP_ROUTES.project(projectId)
        : APP_ROUTES.newChat;
      instantNavigate(target, { replace: true });
    },
    [activeChatId, handleDeleteChat, projectId, instantNavigate],
  );

  const displayMessages = blankNewChatComposer ? [] : messages;
  const displayActiveChatId = blankNewChatComposer ? null : activeChatId;
  const displayActiveChat = blankNewChatComposer ? null : activeChat;
  const displayMessagesLoading =
    !blankNewChatComposer && Boolean(messagesLoading);

  const brandOnlyTab =
    !blankNewChatComposer &&
    isGenerating &&
    (!displayActiveChat?.name ||
      /^new chat$/i.test(displayActiveChat.name.trim()));

  useDocumentTitle(displayActiveChat?.name ?? null, {
    brandOnly: brandOnlyTab,
  });

  return (
    <ChatArea
      messages={displayMessages}
      onSendMessage={handleSendMessageAndRoute}
      onStopGeneration={stopGeneration}
      isGenerating={isGenerating}
      queuedMessages={queuedMessages ?? []}
      onEditQueuedMessage={editQueuedMessage}
      onSendQueuedMessageNow={sendQueuedMessageNow}
      onRemoveQueuedMessage={removeQueuedMessage}
      onUpgradeClick={() => overlays.openPricing()}
      editMessageWithBranch={editMessageWithBranch}
      redoUserMessageWithBranch={redoUserMessageWithBranch}
      retryAssistantWithBranch={retryAssistantWithBranch}
      switchMessageBranch={switchMessageBranch}
      activeChatId={displayActiveChatId}
      messagesLoading={displayMessagesLoading}
      creatingChatPending={creatingChatPending && !blankNewChatComposer}
      activeChatTitle={displayActiveChat?.name ?? "New Chat"}
      isActiveChatTitleStreaming={!!displayActiveChat?.isTitleStreaming}
      isActiveChatPinned={!!displayActiveChat?.pinned}
      onRenameChat={handleRenameChat}
      onPinChat={handlePinChat}
      onDeleteChat={handleDeleteChatAndLeave}
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
