"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IsolatedChatInput } from "./isolated-chat-input";
import type { Message } from "@/lib/types";
import { ConversationThread } from "./conversation-thread";
import { ShareDialog } from "./share-dialog";
import { ChatViewHeader } from "./chat-view-header";
import { IncognitoChatHeader } from "./incognito-chat-header";
import { ChatViewPane } from "./chat-view-pane";
import { ChatArtifactsPanel } from "./chat-artifacts-panel";
import { ArtifactViewerPanel } from "./artifact-viewer-panel";
import {
  ArtifactViewerProvider,
  useArtifactViewer,
} from "@/contexts/artifact-viewer-context";
import { ChatSourcesPanel } from "./chat-sources";
import { collectChatSources, collectMessageSources } from "@/lib/chat-sources";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useChatScrollActivity } from "@/hooks/use-chat-scroll-activity";
import { cn } from "@/lib/utils";
import { CLAUXEN_CHAT_SEND_EVENT } from "@/lib/chat-send-event";
import type { SendMessageOptions } from "@/lib/composer-attachments";
import { findPendingAskUserInput } from "@/lib/pending-ask-user-input";
import { AskUserInputCard } from "@/components/agent/ask-user-input-card";

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (
    prompt: string,
    options?: SendMessageOptions,
  ) => void | Promise<void>;
  onStopGeneration: () => void;
  isGenerating: boolean;
  queuedMessages?: import("@/stores/chat-store").QueuedChatMessage[];
  onEditQueuedMessage?: (id: string, content: string) => void;
  onSendQueuedMessageNow?: (id: string) => void;
  onRemoveQueuedMessage?: (id: string) => void;
  onUpgradeClick: () => void;
  showFreePlanUpgrade?: boolean;
  /** Keep the free-plan card exclusive to the blank `/new` welcome state. */
  showNewChatUpgradeCard?: boolean;
  editMessageWithBranch: (
    chatId: string,
    messageId: string,
    newContent: string,
    options?: {
      attachments?: import("@/lib/composer-attachments").ComposerAttachment[];
    },
  ) => Promise<void>;
  redoUserMessageWithBranch: (
    chatId: string,
    messageId: string,
  ) => Promise<void>;
  retryAssistantWithBranch: (
    chatId: string,
    assistantMessageId: string,
  ) => Promise<void>;
  switchMessageBranch: (
    chatId: string,
    messageId: string,
    direction: "prev" | "next",
  ) => void;
  activeChatId: string | null;
  /** Route chat that is still hydrating — blank the pane instead of the New-chat landing. */
  blankPaneChatId?: string | null;
  /** True while hydrating messages for the active /c/[id] route. */
  messagesLoading?: boolean;
  /** Non-fatal hydrate failure for the active chat. */
  messagesLoadError?: string | null;
  onRetryMessages?: () => void | Promise<void>;
  /** True while a brand-new chat is being created / first reply boots. */
  creatingChatPending?: boolean;
  activeChatTitle?: string;
  isActiveChatTitleStreaming?: boolean;
  isActiveChatPinned?: boolean;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onPinChat?: (chatId: string, pinned: boolean) => void;
  onDeleteChat?: (chatId: string) => void;
  onOpenSettings?: () => void;
  onMoveToProject?: () => void;
  onMoveChatToProject?: (projectId: string | null) => void;
  projects?: import("@/lib/api/projects").ApiProject[];
  currentProjectId?: string | null;
  moveToProjectHref?: string;
  homerReasoningEffort: import("@/lib/model-effort").HomerReasoningEffort;
  onHomerReasoningEffortChange: (
    effort: import("@/lib/model-effort").HomerReasoningEffort,
  ) => void;
  extendedThinking?: boolean;
  onExtendedThinkingChange?: (enabled: boolean) => void;
  chatModel: import("@/lib/chat-models").ChatModelId;
  onChatModelChange: (model: import("@/lib/chat-models").ChatModelId) => void;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  projectBreadcrumb?: {
    label: string;
    onClick?: () => void;
  };
  /** When the chat already belongs to a project, lock the composer strip. */
  lockedProjectId?: string | null;
  /** Full-screen Incognito mode — no history chrome / attachments. */
  incognito?: boolean;
  onCloseIncognito?: () => void;
}

const ARTIFACTS_LIST_PANEL_WIDTH = 384;
/** Desktop file viewer rail — fixed px so open/close doesn't hard-cut the chat. */
const ARTIFACT_VIEWER_WIDTH = 560;
/** Right sidebar (artifacts/files) rail — user-resizable within these bounds. */
const ARTIFACTS_RAIL_DEFAULT_WIDTH = 480;
const ARTIFACTS_RAIL_MIN_WIDTH = 360;
const ARTIFACTS_RAIL_MAX_WIDTH = 880;

function ChatAreaLayout({
  messages,
  onSendMessage,
  onStopGeneration,
  isGenerating,
  queuedMessages = [],
  onEditQueuedMessage,
  onSendQueuedMessageNow,
  onRemoveQueuedMessage,
  onUpgradeClick,
  showFreePlanUpgrade = false,
  showNewChatUpgradeCard = false,
  editMessageWithBranch,
  redoUserMessageWithBranch,
  retryAssistantWithBranch,
  switchMessageBranch,
  activeChatId,
  blankPaneChatId = null,
  messagesLoading = false,
  messagesLoadError = null,
  onRetryMessages,
  creatingChatPending = false,
  activeChatTitle,
  isActiveChatTitleStreaming,
  isActiveChatPinned,
  onRenameChat,
  onPinChat,
  onDeleteChat,
  onOpenSettings,
  onMoveToProject,
  onMoveChatToProject,
  projects,
  currentProjectId,
  moveToProjectHref,
  homerReasoningEffort,
  onHomerReasoningEffortChange,
  extendedThinking = false,
  onExtendedThinkingChange,
  chatModel,
  onChatModelChange,
  onOpenMobileNav,
  showMobileMenu = false,
  projectBreadcrumb,
  lockedProjectId = null,
  incognito = false,
  onCloseIncognito,
}: ChatAreaProps) {
  const { isViewerOpen, activeArtifact, closeViewer, clearViewer } =
    useArtifactViewer();
  const isViewerOpenRef = React.useRef(isViewerOpen);
  isViewerOpenRef.current = isViewerOpen;
  const isMobile = useIsMobile();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const artifactPanelOpenTimerRef = React.useRef<number | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [hasPromptDraft, setHasPromptDraft] = useState(false);
  const [isArtifactsPanelOpen, setIsArtifactsPanelOpen] = useState(false);
  const [artifactsRailWidth, setArtifactsRailWidth] = useState(
    ARTIFACTS_RAIL_DEFAULT_WIDTH,
  );
  const [isArtifactsRailResizing, setIsArtifactsRailResizing] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [sourcesMessageId, setSourcesMessageId] = useState<string | null>(null);
  const [, startTransition] = React.useTransition();
  const displayMessages = messages;
  const chatSources = React.useMemo(
    () => collectChatSources(messages),
    [messages],
  );

  const isConversationStarted = messages.length > 0;
  // Route chat hydrating — blank pane (no welcome), no skeleton copy.
  // Load errors take priority so the blank pane never swallows failure UI.
  const blankRouteHydration = Boolean(
    blankPaneChatId && !isConversationStarted && !messagesLoadError,
  );
  // Composer + dock must look like a conversation immediately while hydrating
  // an existing chat (never flash the new-chat expanded prompt).
  const composerAsConversation =
    isConversationStarted || blankRouteHydration || Boolean(activeChatId);
  const showMessageSkeleton =
    messagesLoading &&
    !isConversationStarted &&
    Boolean(activeChatId) &&
    !blankRouteHydration &&
    !isGenerating;
  const showMessageLoadError =
    !isConversationStarted &&
    !showMessageSkeleton &&
    Boolean(activeChatId) &&
    Boolean(messagesLoadError);
  // Hide interactive header until the server chat id exists — no shimmer.
  const headerControlsLoading = Boolean(creatingChatPending);
  const showChatOptionsHeader =
    isConversationStarted ||
    Boolean(activeChatId) ||
    showMessageSkeleton ||
    showMessageLoadError;
  const showDesktopArtifactsRail =
    isConversationStarted && !isMobile && !isViewerOpen && !isSourcesPanelOpen;

  const { scrollToBottom, pinToBottom, showScrollToBottom } = useChatScroll({
    scrollAreaRef,
    enabled:
      isConversationStarted || showMessageSkeleton || showMessageLoadError,
  });
  const { isFastScrolling } = useChatScrollActivity(
    scrollAreaRef,
    isConversationStarted || showMessageSkeleton || showMessageLoadError,
  );
  const sourceCountRef = React.useRef(chatSources.length);

  React.useEffect(() => {
    if (chatSources.length > sourceCountRef.current) {
      // Do not auto-open the sources sidebar when search results arrive.
      // The panel should only become visible when the user explicitly clicks
      // a per-message "Sources" button. We still track the count ref so we
      // don't re-trigger on the same sources.
      // (We intentionally no longer auto-scope here either; manual open
      // handlers set the desired messageId scope.)
    }
    sourceCountRef.current = chatSources.length;
  }, [chatSources.length, messages]);

  React.useEffect(() => {
    setHasPromptDraft(false);
    setIsAddMenuOpen(false);
  }, [activeChatId]);

  React.useEffect(() => {
    return () => {
      if (artifactPanelOpenTimerRef.current != null) {
        window.clearTimeout(artifactPanelOpenTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isConversationStarted) return;
    const frame = requestAnimationFrame(() => {
      pinToBottom();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeChatId, isConversationStarted, pinToBottom]);

  const lastMessageKey = messages[messages.length - 1]
    ? `${messages[messages.length - 1].id}:${messages[messages.length - 1].role}`
    : "empty";

  React.useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    // A newly sent user message must remain visible even if the thread just
    // reset to its small recent-turn window. Streaming assistant growth is
    // followed by the scroll hook's ResizeObserver.
    if (last.role !== "user") return;
    pinToBottom();
    const raf = requestAnimationFrame(() => pinToBottom());
    return () => cancelAnimationFrame(raf);
  }, [lastMessageKey, messages, pinToBottom]);

  const handleSaveEditedMessage = React.useCallback(
    async (
      messageId: string,
      newContent: string,
      options?: {
        attachments?: import("@/lib/composer-attachments").ComposerAttachment[];
      },
    ) => {
      if (!activeChatId) return;
      await editMessageWithBranch(activeChatId, messageId, newContent, options);
    },
    [activeChatId, editMessageWithBranch],
  );

  const handleRetryUserMessage = React.useCallback(
    async (messageId: string) => {
      if (!activeChatId || isGenerating) return;
      await redoUserMessageWithBranch(activeChatId, messageId);
    },
    [activeChatId, isGenerating, redoUserMessageWithBranch],
  );

  const handleRetryAssistant = React.useCallback(
    async (messageId: string) => {
      if (!activeChatId) return;
      await retryAssistantWithBranch(activeChatId, messageId);
    },
    [activeChatId, retryAssistantWithBranch],
  );

  const handleSwitchBranch = React.useCallback(
    (messageId: string, direction: "prev" | "next") => {
      if (!activeChatId) return;
      startTransition(() => {
        switchMessageBranch(activeChatId, messageId, direction);
      });
    },
    [activeChatId, switchMessageBranch, startTransition],
  );

  const handleSendMessageAndScroll = React.useCallback(
    (prompt: string, options?: SendMessageOptions) => {
      void onSendMessage(prompt, options);
      pinToBottom();
      requestAnimationFrame(() => pinToBottom());
    },
    [onSendMessage, pinToBottom],
  );

  React.useEffect(() => {
    const onChatSend = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          content?: string;
          bypassQueue?: boolean;
        }>
      ).detail;
      const content = detail?.content?.trim();
      if (!content) return;
      handleSendMessageAndScroll(content, {
        bypassQueue: detail?.bypassQueue === true,
      });
    };

    window.addEventListener(CLAUXEN_CHAT_SEND_EVENT, onChatSend);
    return () =>
      window.removeEventListener(CLAUXEN_CHAT_SEND_EVENT, onChatSend);
  }, [handleSendMessageAndScroll]);

  const toggleArtifactsPanel = React.useCallback(() => {
    if (artifactPanelOpenTimerRef.current != null) {
      window.clearTimeout(artifactPanelOpenTimerRef.current);
      artifactPanelOpenTimerRef.current = null;
    }
    setIsSourcesPanelOpen(false);
    if (isViewerOpen) {
      closeViewer();
      artifactPanelOpenTimerRef.current = window.setTimeout(
        () => {
          setIsArtifactsPanelOpen(true);
          artifactPanelOpenTimerRef.current = null;
        },
        isMobile ? 360 : 220,
      );
      return;
    }
    setIsArtifactsPanelOpen((open) => !open);
  }, [closeViewer, isMobile, isViewerOpen]);

  const openSourcesPanel = React.useCallback((messageId?: string) => {
    setSourcesMessageId(messageId ?? null);
    setIsSourcesPanelOpen(true);
    setIsArtifactsPanelOpen(false);
  }, []);

  /** Drag the right sidebar's left edge to resize it; chat column follows. */
  const handleArtifactsRailResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = artifactsRailWidth;
      setIsArtifactsRailResizing(true);
      const onMove = (moveEvent: PointerEvent) => {
        const max = Math.min(
          ARTIFACTS_RAIL_MAX_WIDTH,
          Math.round(window.innerWidth * 0.62),
        );
        const next = Math.min(
          max,
          Math.max(
            ARTIFACTS_RAIL_MIN_WIDTH,
            startWidth + (startX - moveEvent.clientX),
          ),
        );
        setArtifactsRailWidth(next);
      };
      const onUp = () => {
        setIsArtifactsRailResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [artifactsRailWidth],
  );

  const handleDeleteActiveChat = React.useCallback(() => {
    if (!activeChatId) return;
    onDeleteChat?.(activeChatId);
  }, [activeChatId, onDeleteChat]);

  const handlePromptDraftChange = React.useCallback(
    (value: string) => {
      const has = value.trim().length > 0;
      startTransition(() => {
        setHasPromptDraft(has);
        if (has) setActiveChip(null);
      });
    },
    [startTransition],
  );

  const pendingAskQuestions = React.useMemo(
    () => findPendingAskUserInput(messages),
    [messages],
  );

  const promptInput = pendingAskQuestions ? (
    <div
      className="mx-auto w-full max-w-[var(--chat-column-max-width,720px)] px-0"
      data-ask-user-input-composer
    >
      <AskUserInputCard questions={pendingAskQuestions} />
    </div>
  ) : (
    <IsolatedChatInput
      key="prompt-input"
      onSendMessage={handleSendMessageAndScroll}
      onStopGeneration={onStopGeneration}
      onScrollToBottom={scrollToBottom}
      showScrollToBottomButton={showScrollToBottom}
      isConversationStarted={composerAsConversation}
      isGenerating={isGenerating}
      queuedMessages={queuedMessages}
      onEditQueuedMessage={onEditQueuedMessage}
      onSendQueuedMessageNow={onSendQueuedMessageNow}
      onRemoveQueuedMessage={onRemoveQueuedMessage}
      onPromptChange={handlePromptDraftChange}
      onAddMenuOpenChange={setIsAddMenuOpen}
      focusKey={activeChatId ?? (incognito ? "incognito" : "new")}
      onUpgradeClick={onUpgradeClick}
      isFreePlan={showFreePlanUpgrade}
      homerReasoningEffort={homerReasoningEffort}
      onHomerReasoningEffortChange={onHomerReasoningEffortChange}
      extendedThinking={extendedThinking}
      onExtendedThinkingChange={onExtendedThinkingChange}
      chatModel={chatModel}
      onChatModelChange={onChatModelChange}
      lockedProjectId={incognito ? null : lockedProjectId}
      showProjectStrip={!incognito && !composerAsConversation}
      allowAttachments={!incognito}
      placeholder={incognito ? "How can I help you today?" : undefined}
      composerVariant={incognito ? "incognito" : "default"}
    />
  );

  return (
    <div
      className={cn(
        "glass-agent-drop-target relative flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--chat-canvas-bg,#f2f3f6)]",
        incognito ? "rounded-none" : "rounded-[inherit]",
      )}
      data-incognito={incognito || undefined}
    >
      {incognito && onCloseIncognito ? (
        <IncognitoChatHeader
          onClose={onCloseIncognito}
          className="relative z-30"
        />
      ) : null}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0 pb-1.5 transition-[padding-right] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] sm:pb-1.5",
            showDesktopArtifactsRail &&
              isArtifactsPanelOpen &&
              "lg:pr-[var(--chat-right-rail-w,0px)]",
            isArtifactsRailResizing && "transition-none",
          )}
          style={
            {
              "--chat-right-rail-w":
                showDesktopArtifactsRail && isArtifactsPanelOpen
                  ? `${artifactsRailWidth}px`
                  : "0px",
            } as React.CSSProperties
          }
        >
          {!incognito &&
          !composerAsConversation &&
          !showMessageSkeleton &&
          !blankRouteHydration ? (
            <ChatViewHeader
              isConversationStarted={false}
              isGenerating={isGenerating}
              onUpgradeClick={onUpgradeClick}
              onShareClick={() => setIsShareDialogOpen(true)}
              onToggleArtifactsPanel={toggleArtifactsPanel}
              isArtifactsPanelOpen={isArtifactsPanelOpen}
              chatTitle={activeChatTitle}
              isTitleStreaming={isActiveChatTitleStreaming}
              onDeleteChat={handleDeleteActiveChat}
              onOpenSettings={onOpenSettings}
              onOpenMobileNav={onOpenMobileNav}
              showMobileMenu={showMobileMenu}
              showFreePlanUpgrade={false}
              className="relative z-20 shrink-0"
            />
          ) : null}
          <ChatViewPane
            className="flex min-h-0 flex-1 flex-col"
            hasConversation={
              composerAsConversation ||
              showMessageSkeleton ||
              showMessageLoadError ||
              blankRouteHydration
            }
            isGenerating={isGenerating}
            hasPromptDraft={hasPromptDraft}
            isAddMenuOpen={isAddMenuOpen}
            activeChip={activeChip}
            onActiveChipChange={setActiveChip}
            onSendMessage={handleSendMessageAndScroll}
            scrollAreaRef={scrollAreaRef}
            welcomeVariant={incognito ? "incognito" : "default"}
            onUpgradeClick={onUpgradeClick}
            showNewChatUpgradeCard={showNewChatUpgradeCard}
            conversation={
              blankRouteHydration ? (
                <div
                  className="flex w-full min-w-0 max-w-full flex-1 flex-col gap-6 px-4 pt-8 sm:px-6"
                  aria-busy="true"
                  aria-label="Loading conversation"
                >
                  <div className="ml-auto h-12 w-[min(72%,28rem)] rounded-2xl bg-[var(--ui-hover-wash)]" />
                  <div className="h-20 w-[min(80%,34rem)] rounded-2xl bg-[var(--ui-hover-wash)]" />
                  <div className="ml-auto h-10 w-[min(56%,22rem)] rounded-2xl bg-[var(--ui-hover-wash)]" />
                </div>
              ) : showMessageLoadError ? (
                <div className="flex w-full flex-col items-start gap-3 px-4 py-10 sm:px-6">
                  <p className="text-sm text-zinc-600">
                    {messagesLoadError || "Could not load this conversation."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onRetryMessages?.()}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    Retry
                  </button>
                </div>
              ) : showMessageSkeleton ? (
                <div
                  className="flex w-full min-w-0 max-w-full flex-1 flex-col gap-6 px-4 pt-8 sm:px-6"
                  aria-busy="true"
                  aria-label="Loading conversation"
                >
                  <div className="ml-auto h-12 w-[min(72%,28rem)] rounded-2xl bg-[var(--ui-hover-wash)]" />
                  <div className="h-20 w-[min(80%,34rem)] rounded-2xl bg-[var(--ui-hover-wash)]" />
                </div>
              ) : (
                <ConversationThread
                  messages={displayMessages}
                  conversationKey={activeChatId}
                  // The velocity-based fast-scroll heuristic can't tell our own
                  // programmatic auto-follow (streaming + a big block appearing)
                  // from a real user flick. Never let it starve the sticky
                  // code/table header resync while a response is generating —
                  // that's exactly when headers need to dock in real time.
                  isFastScrolling={isFastScrolling && !isGenerating}
                  isGenerating={isGenerating}
                  onSaveEditedMessage={handleSaveEditedMessage}
                  onRetryUserMessage={handleRetryUserMessage}
                  onRetryAssistant={handleRetryAssistant}
                  onSwitchBranch={handleSwitchBranch}
                  onOpenSources={openSourcesPanel}
                  onFollowUpSelect={(prompt) => {
                    handleSendMessageAndScroll(prompt);
                  }}
                  scrollAreaRef={scrollAreaRef}
                />
              )
            }
            promptInput={promptInput}
          />
          {!incognito && showChatOptionsHeader ? (
            <ChatViewHeader
              isConversationStarted
              isGenerating={isGenerating}
              onUpgradeClick={onUpgradeClick}
              onShareClick={() => setIsShareDialogOpen(true)}
              onToggleArtifactsPanel={toggleArtifactsPanel}
              isArtifactsPanelOpen={isArtifactsPanelOpen}
              chatTitle={activeChatTitle}
              isTitleStreaming={isActiveChatTitleStreaming}
              isChatPinned={isActiveChatPinned}
              headerControlsLoading={headerControlsLoading}
              onRenameChat={(title) => {
                if (!activeChatId) return;
                onRenameChat?.(activeChatId, title);
              }}
              onPinChat={() => {
                if (!activeChatId) return;
                onPinChat?.(activeChatId, true);
              }}
              onUnpinChat={() => {
                if (!activeChatId) return;
                onPinChat?.(activeChatId, false);
              }}
              onDeleteChat={handleDeleteActiveChat}
              onOpenSettings={onOpenSettings}
              onMoveToProject={onMoveToProject}
              onMoveChatToProject={onMoveChatToProject}
              projects={projects}
              currentProjectId={currentProjectId}
              moveToProjectHref={moveToProjectHref}
              onOpenMobileNav={onOpenMobileNav}
              showMobileMenu={showMobileMenu}
              projectBreadcrumb={projectBreadcrumb}
              className="z-40"
            />
          ) : null}
        </div>

        <AnimatePresence
          initial={false}
          onExitComplete={() => {
            if (!isViewerOpenRef.current) clearViewer();
          }}
        >
          {isViewerOpen && activeArtifact ? (
            <>
              <motion.div
                key="artifact-viewer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] lg:hidden"
                aria-hidden
                onClick={closeViewer}
              />
              <motion.div
                key="artifact-viewer-panel"
                initial={
                  isMobile
                    ? { x: "100%", opacity: 0.96 }
                    : { width: 0, opacity: 0.96 }
                }
                animate={
                  isMobile
                    ? { x: 0, opacity: 1 }
                    : { width: ARTIFACT_VIEWER_WIDTH, opacity: 1 }
                }
                exit={
                  isMobile
                    ? { x: "100%", opacity: 0.96 }
                    : { width: 0, opacity: 0.96 }
                }
                transition={{
                  duration: isMobile ? 0.42 : 0.4,
                  ease: [0.32, 0.72, 0, 1],
                }}
                className={cn(
                  "fixed inset-y-0 right-0 z-50 flex w-full max-w-full shrink-0 overflow-hidden border-l border-zinc-200/80 bg-white shadow-[-12px_0_40px_-24px_rgba(24,24,27,0.18)] will-change-[transform,width,opacity] lg:static lg:z-auto lg:w-auto lg:max-w-none lg:shadow-none",
                )}
              >
                <div
                  className="h-full w-full shrink-0 lg:w-[560px]"
                  style={
                    isMobile ? undefined : { width: ARTIFACT_VIEWER_WIDTH }
                  }
                >
                  <ArtifactViewerPanel
                    artifact={activeArtifact}
                    onClose={closeViewer}
                  />
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!isViewerOpen &&
          (isArtifactsPanelOpen || isSourcesPanelOpen) &&
          isMobile ? (
            <>
              <motion.div
                key="right-panel-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
                aria-hidden
                onClick={() => {
                  setIsArtifactsPanelOpen(false);
                  setIsSourcesPanelOpen(false);
                  setSourcesMessageId(null);
                }}
              />
              <motion.div
                key={
                  isSourcesPanelOpen
                    ? "sources-panel-mobile"
                    : "artifacts-panel-mobile"
                }
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-y-0 right-0 z-50 flex h-full w-[min(100vw,360px)] shrink-0 overflow-hidden rounded-l-[18px] border-l border-zinc-200/70 bg-white shadow-[-18px_0_40px_-24px_rgba(24,24,27,0.28)] will-change-[transform,opacity]"
              >
                <div className="h-full w-full min-w-0 shrink-0 bg-white">
                  {isSourcesPanelOpen ? (
                    <ChatSourcesPanel
                      messages={messages}
                      messageId={sourcesMessageId}
                      onClose={() => {
                        setIsSourcesPanelOpen(false);
                        setSourcesMessageId(null);
                      }}
                    />
                  ) : (
                    <ChatArtifactsPanel
                      messages={messages}
                      onClose={() => setIsArtifactsPanelOpen(false)}
                    />
                  )}
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!isViewerOpen && isSourcesPanelOpen && !isMobile ? (
            <>
              <motion.div
                key="sources-panel-desktop"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: ARTIFACTS_LIST_PANEL_WIDTH, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="hidden shrink-0 overflow-hidden lg:flex lg:h-full lg:min-h-0 lg:py-2 lg:pr-2 lg:pl-1"
              >
                <div className="h-full w-[360px] shrink-0">
                  <ChatSourcesPanel
                    messages={messages}
                    messageId={sourcesMessageId}
                    onClose={() => {
                      setIsSourcesPanelOpen(false);
                      setSourcesMessageId(null);
                    }}
                  />
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        {showDesktopArtifactsRail ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden lg:block"
            style={{ width: artifactsRailWidth }}
            aria-hidden={!isArtifactsPanelOpen}
          >
            <AnimatePresence initial={false}>
              {isArtifactsPanelOpen ? (
                <motion.div
                  key="desktop-artifacts-panel"
                  initial={{ x: 72, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 72, opacity: 0 }}
                  transition={{
                    duration: isArtifactsRailResizing ? 0 : 0.34,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  className="pointer-events-auto relative flex h-full min-h-0 flex-col bg-[var(--chat-canvas-bg,#f2f3f6)]"
                >
                  {/* Left-edge grip — drag to resize the right sidebar. */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize right sidebar"
                    onPointerDown={handleArtifactsRailResizeStart}
                    className="absolute inset-y-0 -left-2 z-40 w-4 cursor-col-resize touch-none"
                  />
                  <ChatArtifactsPanel
                    messages={messages}
                    onClose={() => setIsArtifactsPanelOpen(false)}
                    className="h-full min-h-0"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      <ShareDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        chatId={activeChatId}
      />
    </div>
  );
}

export function ChatArea(props: ChatAreaProps) {
  return (
    <ArtifactViewerProvider>
      <ChatAreaLayout {...props} />
    </ArtifactViewerProvider>
  );
}
