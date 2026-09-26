"use client";

import React, {
  useCallback,
  useEffect,
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
  isIncognitoPath,
  isIncognitoSessionId,
  isNewChatPath,
} from "@/lib/app-routes";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { getChatProject } from "@/lib/api/projects";
import { resolveDisplayChatTitle } from "@/lib/chat-title";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
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
  apiEnabled?: boolean;
  /** Full-screen ephemeral chat — no history, files, or sidebar. */
  incognito?: boolean;
  /** Optional prompt launched from an example. Sent once on mount. */
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
    pathname.match(/\/conversations\/([^/]+)/)?.[1] ??
    pathname.match(/^\/c\/([^/]+)/)?.[1] ??
    null
  );
}

function ChatViewBody({
  chat,
  incognito = false,
  initialPrompt,
}: {
  chat: ChatController;
  incognito?: boolean;
  initialPrompt?: string;
}) {
  const pathname = useAppPathname();
  const instantNavigate = useInstantNavigate();
  const overlays = useAppOverlays();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();
  const auth = useAuth();
  const isIncognito = incognito || isIncognitoPath(pathname);

  const [localEffort, setLocalEffort] = useState<HomerReasoningEffort>(
    DEFAULT_HOMER_REASONING_EFFORT,
  );
  const [localModel, setLocalModel] = useState<ChatModelId>(
    DEFAULT_CHAT_MODEL_ID,
  );
  const [localExtendedThinking, setLocalExtendedThinking] = useState(false);
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
  const [projectCrumb, setProjectCrumb] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!routeChatId || isIncognito) {
      setProjectCrumb(null);
      return;
    }
    let cancelled = false;
    void getChatProject(routeChatId)
      .then((result) => {
        if (!cancelled) setProjectCrumb(result.project);
      })
      .catch(() => {
        if (!cancelled) setProjectCrumb(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isIncognito, routeChatId]);

  // Keep showing the live conversation as soon as a chat id / messages exist,
  // even before Next finishes soft-navigating off /new.
  // Incognito stays on /incognito for the whole ephemeral session.
  const blankNewChatComposer = isIncognito
    ? !isIncognitoSessionId(activeChatId) &&
      messages.length === 0 &&
      !creatingChatPending
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
    // is the blank new-chat page.
    if (isNewChatPath(pathname)) {
      startNewChatRef.current();
    }
  }, [isIncognito, activeChatId, routeChatId, pathname]);

  const openChatRoute = useCallback(
    (chatId: string) => {
      instantNavigate(APP_ROUTES.chat(chatId), { replace: true });
    },
    [instantNavigate],
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
        !activeChatId && (blankNewChatComposer || isNewChatPath(pathname));
      const shouldOpenRoute = forceNew || isNewChatPath(pathname);

      const chatId = await handleSendMessage(prompt, {
        forceNewChat: forceNew,
        attachments: options?.attachments,
        bypassQueue: options?.bypassQueue,
        // Swap URL the instant the durable chat id exists.
        ...(shouldOpenRoute ? { onChatCreated: openChatRoute } : {}),
      });
      if (!chatId) return;

      const pathNow =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
      const targetPath = APP_ROUTES.chat(chatId);
      if (shouldOpenRoute && pathNow !== targetPath) {
        openChatRoute(chatId);
      }
    },
    [
      handleSendMessage,
      blankNewChatComposer,
      activeChatId,
      pathname,
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
      instantNavigate(APP_ROUTES.newChat, { replace: true });
    },
    [activeChatId, handleDeleteChat, instantNavigate],
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

  const visibleChatTitle = displayTitleChat?.name
    ? resolveDisplayChatTitle(
        displayTitleChat.name,
        Boolean(displayTitleChat.isTitleStreaming),
      )
    : "";
  const brandOnlyTab =
    !blankNewChatComposer &&
    isGenerating &&
    (!visibleChatTitle || /^new chat$/i.test(visibleChatTitle.trim()));

  useDocumentTitle(
    isIncognito
      ? "Incognito"
      : projectCrumb && visibleChatTitle
        ? `${projectCrumb.name} / ${visibleChatTitle}`
        : visibleChatTitle || null,
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
        projectCrumb={projectCrumb}
        isActiveChatTitleStreaming={
          !!displayActiveChat?.isTitleStreaming &&
          displayActiveChat?.id === displayTitleChat?.id
        }
        isActiveChatPinned={!!displayTitleChat?.pinned}
        onRenameChat={handleRenameChat}
        onPinChat={handlePinChat}
        onDeleteChat={handleDeleteChatAndLeave}
        onOpenSettings={() => overlays.openSettings("General")}
        onOpenMobileNav={openMobileNav}
        showMobileMenu={isMobile && isSidebarCollapsed}
        chatModel={chatModel}
        onChatModelChange={setChatModel}
        homerReasoningEffort={homerReasoningEffort}
        onHomerReasoningEffortChange={setHomerReasoningEffort}
        extendedThinking={extendedThinking}
        onExtendedThinkingChange={setExtendedThinking}
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
 * Prefer the shell ChatSessionProvider so route changes keep the live stream.
 */
export function ChatView({
  apiEnabled,
  incognito = false,
  initialPrompt,
}: ChatViewProps) {
  const auth = useAuth();
  const session = useOptionalChatSession();

  if (session) {
    return (
      <ChatViewBody
        chat={session}
        incognito={incognito}
        initialPrompt={initialPrompt}
      />
    );
  }

  return (
    <ChatViewStandalone
      key={`${auth.user?.id ?? "anon"}:${incognito ? "incognito" : "chat"}`}
      apiEnabled={apiEnabled ?? Boolean(auth.user)}
      incognito={incognito}
      initialPrompt={initialPrompt}
    />
  );
}

function ChatViewStandalone({
  apiEnabled,
  incognito = false,
  initialPrompt,
}: {
  apiEnabled: boolean;
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
      incognito={incognito}
      initialPrompt={initialPrompt}
    />
  );
}
