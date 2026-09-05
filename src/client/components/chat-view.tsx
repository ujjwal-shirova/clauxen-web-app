"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppPathname } from "@/hooks/use-app-pathname";
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
  getProjectIdFromPath,
  isIncognitoPath,
  isIncognitoSessionId,
  isNewChatPath,
  isProjectHomePath,
} from "@/lib/app-routes";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { useProjects } from "@/hooks/use-projects";
import * as projectsApi from "@/lib/api/projects";
import { getBillingSubscription } from "@/lib/api/billing";
import {
  readCachedBillingPlan,
  writeCachedBillingPlan,
} from "@/lib/billing-plan-cache";
import { DEFAULT_CHAT_MODEL_ID, type ChatModelId } from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

interface ChatViewProps {
  projectId?: string | null;
  apiEnabled?: boolean;
  /** Full-screen ephemeral chat — no history, files, or sidebar. */
  incognito?: boolean;
  projectBreadcrumb?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Optional prompt launched from a plugin example. Sent once on mount. */
  initialPrompt?: string;
}

type ChatController = ReturnType<typeof useChat> & {
  chatModel?: ChatModelId;
  setChatModel?: (model: ChatModelId) => void;
  homerReasoningEffort?: HomerReasoningEffort;
  setHomerReasoningEffort?: (effort: HomerReasoningEffort) => void;
  extendedThinking?: boolean;
  setExtendedThinking?: (enabled: boolean) => void;
};

function getRouteChatId(pathname: string): string | null {
  return (
    pathname.match(/^\/project\/[^/]+\/c\/([^/]+)/)?.[1] ??
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
  incognito = false,
  initialPrompt,
}: {
  chat: ChatController;
  projectId?: string | null;
  projectBreadcrumb?: ChatViewProps["projectBreadcrumb"];
  incognito?: boolean;
  initialPrompt?: string;
}) {
  const pathname = useAppPathname();
  const instantNavigate = useInstantNavigate();
  const overlays = useAppOverlays();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();
  const auth = useAuth();
  const projects = useProjects(Boolean(auth.user?.id));
  const isIncognito = incognito || isIncognitoPath(pathname);

  const [localEffort, setLocalEffort] = useState<HomerReasoningEffort>(
    DEFAULT_HOMER_REASONING_EFFORT,
  );
  const [localModel, setLocalModel] = useState<ChatModelId>(
    DEFAULT_CHAT_MODEL_ID,
  );
  const [localExtendedThinking, setLocalExtendedThinking] = useState(false);
  const [resolvedProjectName, setResolvedProjectName] = useState<string | null>(
    projectBreadcrumb?.label ?? null,
  );
  const [enterMethod, setEnterMethod] = useState<string | null>(null);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [successPlanName, setSuccessPlanName] = useState<string | null>(null);
  const [showFreePlanUpgrade, setShowFreePlanUpgrade] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const updateFromPlanId = (planId: string | null | undefined) => {
      if (!cancelled) {
        setShowFreePlanUpgrade(
          (planId || "free").trim().toLowerCase() === "free",
        );
      }
    };

    const loadPlan = async () => {
      const cachedPlan = readCachedBillingPlan();
      if (cachedPlan) updateFromPlanId(cachedPlan.planId);

      if (!auth.user?.id) {
        if (!auth.loading) updateFromPlanId("free");
        return;
      }

      try {
        const overview = await getBillingSubscription();
        if (cancelled) return;
        const planId = overview.subscription?.plan_id ?? "free";
        const match = overview.plans?.find((plan) => plan.id === planId);
        writeCachedBillingPlan(planId, match?.display_name || planId);
        updateFromPlanId(planId);
      } catch {
        if (!cachedPlan) updateFromPlanId("free");
      }
    };

    void loadPlan();
    const onBillingUpdated = () => void loadPlan();
    window.addEventListener("clauxen:billing-updated", onBillingUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("clauxen:billing-updated", onBillingUpdated);
    };
  }, [auth.loading, auth.user?.id]);

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
        const planId = overview.subscription?.plan_id ?? "free";
        const match = overview.plans?.find((p) => p.id === planId);
        writeCachedBillingPlan(planId, match?.display_name || planId);
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

  const homerReasoningEffort = chat.homerReasoningEffort ?? localEffort;
  const setHomerReasoningEffort =
    chat.setHomerReasoningEffort ?? setLocalEffort;
  const chatModel = chat.chatModel ?? localModel;
  const setChatModel = chat.setChatModel ?? setLocalModel;
  const extendedThinking = chat.extendedThinking ?? localExtendedThinking;
  const setExtendedThinking =
    chat.setExtendedThinking ?? setLocalExtendedThinking;

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
  const sentInitialPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (!prompt || sentInitialPromptRef.current === prompt) return;
    sentInitialPromptRef.current = prompt;
    void handleSendMessage(prompt);
  }, [handleSendMessage, initialPrompt]);

  const creatingChatPending = Boolean(
    (chat as { creatingChatPending?: boolean }).creatingChatPending,
  );
  const messagesLoading = Boolean(
    (chat as { messagesLoading?: boolean }).messagesLoading,
  );
  const messagesLoadError =
    (chat as { messagesLoadError?: string | null }).messagesLoadError ?? null;
  const retryLoadMessages = (
    chat as { retryLoadMessages?: () => Promise<void> }
  ).retryLoadMessages;

  const routeChatId = getRouteChatId(pathname);
  const isProjectHome = isProjectHomePath(pathname);
  const routeProjectId = getProjectIdFromPath(pathname);
  const scopedProjectId = projectId ?? routeProjectId;

  // Bind new chats from the project dashboard without filtering the sidebar list.
  const bindProjectId = scopedProjectId ?? activeChat?.projectId ?? null;

  // Keep showing the live conversation as soon as a chat id / messages exist,
  // even before Next finishes soft-navigating off /new or /project/:id.
  // Incognito stays on /incognito for the whole ephemeral session.
  const blankNewChatComposer = isIncognito
    ? !isIncognitoSessionId(activeChatId) &&
      messages.length === 0 &&
      !creatingChatPending
    : isProjectHome
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
    if (isIncognito) {
      // Entering Incognito: clear any durable active chat so we don't hydrate.
      if (activeChatId && !isIncognitoSessionId(activeChatId)) {
        startNewChatRef.current();
      }
      return;
    }
    if (routeChatId) {
      void handleSelectChatRef.current(routeChatId);
      return;
    }
    // ChatView stays mounted off-route; only clear when the visible surface
    // is the blank new-chat page. Project dashboards use ProjectHomeView.
    if (isNewChatPath(pathname)) {
      startNewChatRef.current();
    }
  }, [isIncognito, activeChatId, routeChatId, pathname]);

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
      Boolean(scopedProjectId) ||
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
    scopedProjectId,
  ]);

  const openChatRoute = useCallback(
    (chatId: string) => {
      if (scopedProjectId || bindProjectId) {
        instantNavigate(
          APP_ROUTES.projectChat(scopedProjectId ?? bindProjectId!, chatId),
          { replace: true },
        );
        return;
      }
      instantNavigate(APP_ROUTES.chat(chatId), { replace: true });
    },
    [instantNavigate, scopedProjectId, bindProjectId],
  );

  const handleSendMessageAndRoute = useCallback(
    async (
      prompt: string,
      options?: import("@/lib/composer-attachments").SendMessageOptions,
    ) => {
      if (isIncognito) {
        await handleSendMessage(prompt, {
          forceNewChat: !isIncognitoSessionId(activeChatId),
          attachments: undefined,
          bypassQueue: options?.bypassQueue,
          ephemeral: true,
        });
        return;
      }

      const forceNew =
        isProjectHome ||
        (!activeChatId && (blankNewChatComposer || isNewChatPath(pathname)));
      const shouldOpenRoute =
        forceNew ||
        isNewChatPath(pathname) ||
        isProjectHome ||
        Boolean(scopedProjectId);

      const chatId = await handleSendMessage(prompt, {
        forceNewChat: forceNew,
        attachments: options?.attachments,
        bypassQueue: options?.bypassQueue,
        projectId: scopedProjectId ?? undefined,
        // Swap URL the instant the durable chat id exists.
        ...(shouldOpenRoute ? { onChatCreated: openChatRoute } : {}),
      });
      if (!chatId) return;

      const pathNow =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
      const targetPath =
        scopedProjectId || bindProjectId
          ? APP_ROUTES.projectChat(scopedProjectId ?? bindProjectId!, chatId)
          : APP_ROUTES.chat(chatId);
      if (shouldOpenRoute && pathNow !== targetPath) {
        openChatRoute(chatId);
      }
    },
    [
      handleSendMessage,
      blankNewChatComposer,
      activeChatId,
      scopedProjectId,
      bindProjectId,
      pathname,
      isProjectHome,
      isIncognito,
      openChatRoute,
    ],
  );

  const handleCloseIncognito = useCallback(() => {
    startNewChat();
    instantNavigate(APP_ROUTES.newChat, { replace: true });
  }, [instantNavigate, startNewChat]);

  const handleDeleteChatAndLeave = useCallback(
    (chatId: string) => {
      const wasActive = activeChatId === chatId;
      // Optimistic delete updates UI sync; navigate away without waiting on API.
      void handleDeleteChat(chatId);
      if (!wasActive) return;
      const target =
        scopedProjectId || bindProjectId
          ? APP_ROUTES.project(scopedProjectId || bindProjectId!)
          : APP_ROUTES.newChat;
      instantNavigate(target, { replace: true });
    },
    [activeChatId, handleDeleteChat, scopedProjectId, bindProjectId, instantNavigate],
  );

  const switchingRouteChat = Boolean(
    routeChatId && routeChatId !== activeChatId && !isIncognito,
  );
  const displayMessages =
    blankNewChatComposer || switchingRouteChat ? [] : messages;
  const displayActiveChatId = blankNewChatComposer
    ? null
    : switchingRouteChat
      ? routeChatId
      : activeChatId;
  const displayActiveChat =
    blankNewChatComposer || switchingRouteChat ? null : activeChat;
  // Route-first title: while `activeChatId` catches up after soft-nav to /c/:id,
  // resolve the clicked row's title so the header never falls back to "New Chat".
  const routeChat = routeChatId
    ? ((chat.recentChats ?? []).find((c) => c.id === routeChatId) ?? null)
    : null;
  const displayTitleChat =
    displayActiveChat ??
    (switchingRouteChat ? routeChat : null) ??
    (!blankNewChatComposer ? routeChat : null);
  const displayMessagesLoading =
    !blankNewChatComposer && Boolean(messagesLoading);

  // Switching between existing chats: keep the pane blank (never the
  // New-chat landing) until the route chat hydrates. Also treat sidebar
  // selection (activeChatId before pathname updates) as hydrating so the
  // collapsed dock composer never flashes as the welcome composer.
  const isChatRoute = Boolean(routeChatId) && !isIncognito;
  const hydratingChatId =
    routeChatId ??
    (activeChatId && !isIncognitoSessionId(activeChatId) ? activeChatId : null);
  const awaitingRouteHydration =
    !blankNewChatComposer &&
    displayMessages.length === 0 &&
    Boolean(hydratingChatId) &&
    (isChatRoute || Boolean(hydratingChatId));
  const blankPaneChatId = awaitingRouteHydration ? hydratingChatId : null;

  const brandOnlyTab =
    !blankNewChatComposer &&
    isGenerating &&
    (!displayActiveChat?.name ||
      /^new chat$/i.test(displayActiveChat.name.trim()));

  useDocumentTitle(
    isIncognito
      ? "Incognito"
      : blankNewChatComposer
        ? (resolvedProjectName ?? "Project")
        : (displayTitleChat?.name ?? null),
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
        showFreePlanUpgrade={showFreePlanUpgrade}
        showNewChatUpgradeCard={
          showFreePlanUpgrade &&
          blankNewChatComposer &&
          isNewChatPath(pathname) &&
          !isIncognito
        }
        editMessageWithBranch={editMessageWithBranch}
        redoUserMessageWithBranch={redoUserMessageWithBranch}
        retryAssistantWithBranch={retryAssistantWithBranch}
        switchMessageBranch={switchMessageBranch}
        activeChatId={displayActiveChatId}
        blankPaneChatId={blankPaneChatId}
        messagesLoading={displayMessagesLoading}
        messagesLoadError={messagesLoadError}
        onRetryMessages={retryLoadMessages}
        creatingChatPending={creatingChatPending && !blankNewChatComposer}
        activeChatTitle={displayTitleChat?.name ?? "New Chat"}
        isActiveChatTitleStreaming={
          !!displayActiveChat?.isTitleStreaming &&
          displayActiveChat?.id === displayTitleChat?.id
        }
        isActiveChatPinned={!!displayTitleChat?.pinned}
        onRenameChat={handleRenameChat}
        onPinChat={handlePinChat}
        onDeleteChat={handleDeleteChatAndLeave}
        onOpenSettings={() => overlays.openSettings("General")}
        onMoveChatToProject={(projectId) => {
          if (!displayActiveChatId) return;
          void chat.handleMoveChatToProject?.(displayActiveChatId, projectId);
          if (projectId) {
            instantNavigate(
              APP_ROUTES.projectChat(projectId, displayActiveChatId),
            );
          } else {
            instantNavigate(APP_ROUTES.chat(displayActiveChatId));
          }
        }}
        projects={projects.projects}
        currentProjectId={
          displayTitleChat?.projectId ?? scopedProjectId ?? bindProjectId
        }
        moveToProjectHref={
          displayActiveChatId
            ? APP_ROUTES.projectNewWithChat(displayActiveChatId)
            : APP_ROUTES.projectNew
        }
        onOpenMobileNav={openMobileNav}
        showMobileMenu={isMobile && isSidebarCollapsed}
        chatModel={chatModel}
        onChatModelChange={setChatModel}
        homerReasoningEffort={homerReasoningEffort}
        onHomerReasoningEffortChange={setHomerReasoningEffort}
        extendedThinking={extendedThinking}
        onExtendedThinkingChange={setExtendedThinking}
        projectBreadcrumb={effectiveBreadcrumb}
        lockedProjectId={scopedProjectId ?? bindProjectId}
        incognito={isIncognito}
        onCloseIncognito={handleCloseIncognito}
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
  incognito = false,
  projectBreadcrumb,
  initialPrompt,
}: ChatViewProps) {
  const auth = useAuth();
  const session = useOptionalChatSession();

  if (session) {
    return (
      <ChatViewBody
        chat={session}
        projectId={projectId}
        projectBreadcrumb={projectBreadcrumb}
        incognito={incognito}
        initialPrompt={initialPrompt}
      />
    );
  }

  if (projectId && auth.loading) {
    return null;
  }

  return (
    <ChatViewStandalone
      key={`${auth.user?.id ?? "anon"}:${projectId ?? "home"}:${incognito ? "incognito" : "chat"}`}
      projectId={projectId}
      apiEnabled={apiEnabled ?? Boolean(auth.user)}
      projectBreadcrumb={projectBreadcrumb}
      incognito={incognito}
      initialPrompt={initialPrompt}
    />
  );
}

function ChatViewStandalone({
  projectId,
  apiEnabled,
  projectBreadcrumb,
  incognito = false,
  initialPrompt,
}: {
  projectId?: string | null;
  apiEnabled: boolean;
  projectBreadcrumb?: ChatViewProps["projectBreadcrumb"];
  incognito?: boolean;
  initialPrompt?: string;
}) {
  const [chatModel, setChatModel] = useState<ChatModelId>(
    DEFAULT_CHAT_MODEL_ID,
  );
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
      incognito={incognito}
      initialPrompt={initialPrompt}
    />
  );
}
