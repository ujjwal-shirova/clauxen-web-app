"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatArea } from "@/components/chat-area";
import { PaymentSuccessDialog } from "@/components/payment-success-dialog";
import { useOptionalChatSession } from "@/contexts/chat-session-context";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { useAppOverlays } from "@/hooks/use-app-overlays";
import { useAppLayout } from "@/components/app-layout-context";
import {
  APP_ROUTES,
  CHAT_ENTER_METHOD_PROJECT,
  isNewChatPath,
  isProjectHomePath,
} from "@/lib/app-routes";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { useProjects } from "@/hooks/use-projects";
import * as projectsApi from "@/lib/api/projects";
import { getBillingSubscription } from "@/lib/api/billing";
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
    href?: string;
    onClick?: () => void;
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

function readChatEnterMethod(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("chat_enter_method");
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
  const pathname = usePathname();
  const instantNavigate = useInstantNavigate();
  const overlays = useAppOverlays();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();
  const auth = useAuth();
  const projects = useProjects(Boolean(auth.user?.id));

  const [localEffort, setLocalEffort] = useState<HomerReasoningEffort>(
    DEFAULT_HOMER_REASONING_EFFORT,
  );
  const [localModel, setLocalModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);
  const [resolvedProjectName, setResolvedProjectName] = useState<string | null>(
    projectBreadcrumb?.label ?? null,
  );
  const [enterMethod, setEnterMethod] = useState<string | null>(null);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [successPlanName, setSuccessPlanName] = useState<string | null>(null);

  useEffect(() => {
    setEnterMethod(readChatEnterMethod());
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    let fromUrl = params.get("checkout") === "success";
    let fromStorage = false;
    try {
      fromStorage =
        window.sessionStorage.getItem("clauxen:checkout-success") === "1";
      if (fromStorage) {
        window.sessionStorage.removeItem("clauxen:checkout-success");
      }
    } catch {
      fromStorage = false;
    }

    if (!fromUrl && !fromStorage) return;

    setShowPaymentSuccess(true);
    void getBillingSubscription()
      .then((overview) => {
        const planId = overview.subscription?.plan_id;
        const match = overview.plans?.find((p) => p.id === planId);
        setSuccessPlanName(match?.display_name || planId || null);
        window.dispatchEvent(new CustomEvent("clauxen:billing-updated"));
      })
      .catch(() => undefined);

    if (fromUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [pathname]);

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
  const messagesLoadError =
    (chat as { messagesLoadError?: string | null }).messagesLoadError ?? null;
  const retryLoadMessages =
    (chat as { retryLoadMessages?: () => Promise<void> }).retryLoadMessages;

  const routeChatId = getRouteChatId(pathname);
  const isProjectHome = isProjectHomePath(pathname);

  // Bind new chats from the project dashboard without filtering the sidebar list.
  const bindProjectId =
    projectId ??
    activeChat?.projectId ??
    null;

  // Keep showing the live conversation as soon as a chat id / messages exist,
  // even before Next finishes soft-navigating off /new or /project/:id.
  const blankNewChatComposer = isProjectHome
    ? !routeChatId && !creatingChatPending && messages.length === 0
    : isNewChatPath(pathname) &&
      !activeChatId &&
      messages.length === 0 &&
      !creatingChatPending;

  const handleSelectChatRef = useRef(handleSelectChat);
  handleSelectChatRef.current = handleSelectChat;
  const startNewChatRef = useRef(startNewChat);
  startNewChatRef.current = startNewChat;

  useEffect(() => {
    if (routeChatId) {
      void handleSelectChatRef.current(routeChatId);
      return;
    }
    if (isProjectHome || blankNewChatComposer) {
      startNewChatRef.current();
    }
  }, [routeChatId, isProjectHome, blankNewChatComposer]);

  // Resolve project name for breadcrumb when opened via /c?chat_enter_method=project.
  useEffect(() => {
    if (projectBreadcrumb?.label) {
      setResolvedProjectName(projectBreadcrumb.label);
      return;
    }
    const id = bindProjectId;
    if (!id) {
      setResolvedProjectName(null);
      return;
    }
    const cached = projects.projects.find((p) => p.id === id);
    if (cached) {
      setResolvedProjectName(cached.name);
      return;
    }
    if (id.startsWith("local-")) return;
    let cancelled = false;
    void projectsApi.getProject(id).then(
      ({ project }) => {
        if (!cancelled) setResolvedProjectName(project.name);
      },
      () => {
        if (!cancelled) setResolvedProjectName(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [bindProjectId, projectBreadcrumb?.label, projects.projects]);

  const effectiveBreadcrumb = useMemo(() => {
    if (projectBreadcrumb) return projectBreadcrumb;
    if (!bindProjectId || !resolvedProjectName) return undefined;
    const showChrome =
      Boolean(projectId) ||
      enterMethod === CHAT_ENTER_METHOD_PROJECT ||
      Boolean(activeChat?.projectId);
    if (!showChrome) return undefined;
    return {
      label: resolvedProjectName,
      href: APP_ROUTES.project(bindProjectId),
    };
  }, [
    projectBreadcrumb,
    bindProjectId,
    resolvedProjectName,
    enterMethod,
    activeChat?.projectId,
    projectId,
  ]);

  const openChatRoute = useCallback(
    (chatId: string) => {
      if (projectId || bindProjectId) {
        instantNavigate(APP_ROUTES.projectChat(chatId), { replace: true });
        return;
      }
      instantNavigate(APP_ROUTES.chat(chatId), { replace: true });
    },
    [instantNavigate, projectId, bindProjectId],
  );

  const handleSendMessageAndRoute = useCallback(
    async (
      prompt: string,
      options?: import("@/lib/composer-attachments").SendMessageOptions,
    ) => {
      const forceNew =
        isProjectHome ||
        (!activeChatId && (blankNewChatComposer || isNewChatPath(pathname)));
      const shouldOpenRoute =
        forceNew ||
        isNewChatPath(pathname) ||
        isProjectHome ||
        Boolean(projectId);

      const chatId = await handleSendMessage(prompt, {
        forceNewChat: forceNew,
        attachments: options?.attachments,
        bypassQueue: options?.bypassQueue,
        projectId: projectId ?? undefined,
        // Swap URL the instant the durable chat id exists.
        ...(shouldOpenRoute ? { onChatCreated: openChatRoute } : {}),
      });
      if (!chatId) return;

      const pathNow =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
      const targetPath =
        projectId || bindProjectId
          ? APP_ROUTES.projectChat(chatId)
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
      bindProjectId,
      pathname,
      isProjectHome,
      openChatRoute,
    ],
  );

  const handleDeleteChatAndLeave = useCallback(
    async (chatId: string) => {
      const wasActive = activeChatId === chatId;
      await handleDeleteChat(chatId);
      if (!wasActive) return;
      const target = projectId || bindProjectId
        ? APP_ROUTES.project(projectId || bindProjectId!)
        : APP_ROUTES.newChat;
      instantNavigate(target, { replace: true });
    },
    [activeChatId, handleDeleteChat, projectId, bindProjectId, instantNavigate],
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

  useDocumentTitle(
    blankNewChatComposer
      ? resolvedProjectName ?? "Project"
      : displayActiveChat?.name ?? null,
    {
      brandOnly: brandOnlyTab,
    },
  );

  return (
    <>
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
        messagesLoadError={messagesLoadError}
        onRetryMessages={retryLoadMessages}
        creatingChatPending={creatingChatPending && !blankNewChatComposer}
        activeChatTitle={displayActiveChat?.name ?? "New Chat"}
        isActiveChatTitleStreaming={!!displayActiveChat?.isTitleStreaming}
        isActiveChatPinned={!!displayActiveChat?.pinned}
        onRenameChat={handleRenameChat}
        onPinChat={handlePinChat}
        onDeleteChat={handleDeleteChatAndLeave}
        onOpenSettings={() => overlays.openSettings("General")}
        homerReasoningEffort={homerReasoningEffort}
        onHomerReasoningEffortChange={setHomerReasoningEffort}
        chatModel={chatModel}
        onChatModelChange={setChatModel}
        onOpenMobileNav={openMobileNav}
        showMobileMenu={isMobile && isSidebarCollapsed}
        projectBreadcrumb={effectiveBreadcrumb}
        lockedProjectId={projectId ?? bindProjectId}
      />
      <PaymentSuccessDialog
        open={showPaymentSuccess}
        planName={successPlanName}
        onGetStarted={() => setShowPaymentSuccess(false)}
      />
    </>
  );
}

/**
 * Prefer the shell ChatSessionProvider so project → `/c` keeps the live stream.
 */
export function ChatView({
  projectId = null,
  apiEnabled,
  projectBreadcrumb,
}: ChatViewProps) {
  const auth = useAuth();
  const session = useOptionalChatSession();

  if (session) {
    return (
      <ChatViewBody
        chat={session}
        projectId={projectId}
        projectBreadcrumb={projectBreadcrumb}
      />
    );
  }

  if (projectId && auth.loading) {
    return null;
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
