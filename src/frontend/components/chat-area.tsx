"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IsolatedChatInput } from "./isolated-chat-input";
import type { Message } from "@/frontend/lib/types";
import { ConversationThread } from "./conversation-thread";
import { ShareDialog } from "./share-dialog";
import { ChatViewHeader } from "./chat-view-header";
import { ChatViewPane } from "./chat-view-pane";
import { ChatArtifactsPanel } from "./chat-artifacts-panel";
import { ChatRightRailControls } from "./chat-right-rail-controls";
import { ArtifactViewerPanel } from "./artifact-viewer-panel";
import { ArtifactViewerProvider, useArtifactViewer } from "@/frontend/contexts/artifact-viewer-context";
import { ChatSourcesPanel } from "./chat-sources";
import { collectChatArtifacts } from "@/frontend/lib/chat-artifacts";
import { collectChatSources, collectMessageSources } from "@/frontend/lib/chat-sources";
import { useIsMobile } from "@/frontend/hooks/use-mobile";
import { useChatScroll } from "@/frontend/hooks/use-chat-scroll";
import { useChatScrollActivity } from "@/frontend/hooks/use-chat-scroll-activity";
import { cn } from "@/frontend/lib/utils";
import { CLAUXEN_CHAT_SEND_EVENT } from "@/frontend/lib/chat-send-event";
import type { SendMessageOptions } from "@/frontend/lib/composer-attachments";

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (
    prompt: string,
    options?: SendMessageOptions,
  ) => void | Promise<void>;
  onStopGeneration: () => void;
  isGenerating: boolean;
  queuedMessages?: import("@/frontend/stores/chat-store").QueuedChatMessage[];
  onEditQueuedMessage?: (id: string, content: string) => void;
  onSendQueuedMessageNow?: (id: string) => void;
  onRemoveQueuedMessage?: (id: string) => void;
  onUpgradeClick: () => void;
  editMessageWithBranch: (
    chatId: string,
    messageId: string,
    newContent: string,
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
  /** True while hydrating messages for the active /c/[id] route. */
  messagesLoading?: boolean;
  /** True while a brand-new chat is being created / first reply boots. */
  creatingChatPending?: boolean;
  /** Server keyset: older history remains beyond the loaded window. */
  hasMoreMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => Promise<boolean>;
  activeChatTitle?: string;
  isActiveChatTitleStreaming?: boolean;
  isActiveChatPinned?: boolean;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onPinChat?: (chatId: string, pinned: boolean) => void;
  onDeleteChat?: (chatId: string) => void;
  onOpenSettings?: () => void;
  onMoveToProject?: () => void;
  homerReasoningEffort: import("@/lib/model-effort").HomerReasoningEffort;
  onHomerReasoningEffortChange: (
    effort: import("@/lib/model-effort").HomerReasoningEffort,
  ) => void;
  chatModel: import("@/lib/chat-models").ChatModelId;
  onChatModelChange: (model: import("@/lib/chat-models").ChatModelId) => void;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  projectBreadcrumb?: {
    label: string;
    onClick?: () => void;
  };
}

const ARTIFACTS_LIST_PANEL_WIDTH = 384;

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
  editMessageWithBranch,
  redoUserMessageWithBranch,
  retryAssistantWithBranch,
  switchMessageBranch,
  activeChatId,
  messagesLoading = false,
  creatingChatPending = false,
  hasMoreMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
  activeChatTitle,
  isActiveChatTitleStreaming,
  isActiveChatPinned,
  onRenameChat,
  onPinChat,
  onDeleteChat,
  onOpenSettings,
  onMoveToProject,
  homerReasoningEffort,
  onHomerReasoningEffortChange,
  chatModel,
  onChatModelChange,
  onOpenMobileNav,
  showMobileMenu = false,
  projectBreadcrumb,
}: ChatAreaProps) {
  const { isViewerOpen, activeArtifact, closeViewer } = useArtifactViewer();
  const isMobile = useIsMobile();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const artifactPanelOpenTimerRef = React.useRef<number | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [hasPromptDraft, setHasPromptDraft] = useState(false);
  const [isArtifactsPanelOpen, setIsArtifactsPanelOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [sourcesMessageId, setSourcesMessageId] = useState<string | null>(null);
  const [, startTransition] = React.useTransition();
  const displayMessages = messages;
  const chatArtifacts = React.useMemo(
    () => collectChatArtifacts(messages),
    [messages],
  );
  const chatSources = React.useMemo(() => collectChatSources(messages), [messages]);

  const isConversationStarted = messages.length > 0;
  const showMessageSkeleton =
    messagesLoading && !isConversationStarted && Boolean(activeChatId);
  const hasArtifacts = chatArtifacts.length > 0;
  const headerControlsLoading =
    Boolean(creatingChatPending) ||
    (Boolean(isGenerating) &&
      isConversationStarted &&
      messages.every(
        (message) =>
          message.role !== "assistant" ||
          (!message.content.trim() && !message.thinkingContent?.trim()),
      ));
  const showChatOptionsHeader =
    isConversationStarted || Boolean(activeChatId) || showMessageSkeleton;
  const showDesktopArtifactsRail =
    hasArtifacts &&
    isConversationStarted &&
    !isMobile &&
    !isViewerOpen &&
    !isSourcesPanelOpen;

  const {
    scrollToBottom,
    pinToBottom,
    showScrollToBottom,
    followContentGrowth,
    setHistoryLoading,
  } = useChatScroll({
    scrollAreaRef,
    enabled: isConversationStarted || showMessageSkeleton,
  });
  const { isFastScrolling } = useChatScrollActivity(
    scrollAreaRef,
    isConversationStarted || showMessageSkeleton,
  );
  const artifactCountRef = React.useRef(chatArtifacts.length);
  const sourceCountRef = React.useRef(chatSources.length);

  React.useEffect(() => {
    // Do not auto-open the artifacts sidebar when new artifacts arrive.
    // Keep the ref updated so we don't re-trigger logic on the same count.
    artifactCountRef.current = chatArtifacts.length;
  }, [chatArtifacts.length]);

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

  const lastMessageKey =
    messages[messages.length - 1]
      ? `${messages[messages.length - 1].id}:${messages[messages.length - 1].role}`
      : "empty";

  React.useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    // A newly sent user message must remain visible even if the thread just
    // reset to its small recent-turn window. Streaming assistant updates are
    // handled by followContentGrowth below.
    if (last.role !== "user") return;
    pinToBottom();
    const raf = requestAnimationFrame(() => pinToBottom());
    return () => cancelAnimationFrame(raf);
  }, [lastMessageKey, messages, pinToBottom]);

  React.useEffect(() => {
    if (!isGenerating) return;

    let rafId = 0;
    const tick = () => {
      followContentGrowth();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [isGenerating, followContentGrowth]);

  const handleSaveEditedMessage = React.useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeChatId) return;
      await editMessageWithBranch(activeChatId, messageId, newContent);
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
      const detail = (event as CustomEvent<{ content?: string }>).detail;
      const content = detail?.content?.trim();
      if (!content) return;
      handleSendMessageAndScroll(content);
    };

    window.addEventListener(CLAUXEN_CHAT_SEND_EVENT, onChatSend);
    return () => window.removeEventListener(CLAUXEN_CHAT_SEND_EVENT, onChatSend);
  }, [handleSendMessageAndScroll]);

  const toggleArtifactsPanel = React.useCallback(() => {
    if (artifactPanelOpenTimerRef.current != null) {
      window.clearTimeout(artifactPanelOpenTimerRef.current);
      artifactPanelOpenTimerRef.current = null;
    }
    setIsSourcesPanelOpen(false);
    if (isViewerOpen) {
      closeViewer();
      artifactPanelOpenTimerRef.current = window.setTimeout(() => {
        setIsArtifactsPanelOpen(true);
        artifactPanelOpenTimerRef.current = null;
      }, isMobile ? 360 : 220);
      return;
    }
    setIsArtifactsPanelOpen((open) => !open);
  }, [closeViewer, isMobile, isViewerOpen]);

  const openSourcesPanel = React.useCallback((messageId?: string) => {
    setSourcesMessageId(messageId ?? null);
    setIsSourcesPanelOpen(true);
    setIsArtifactsPanelOpen(false);
  }, []);

  const handleDeleteActiveChat = React.useCallback(() => {
    if (!activeChatId) return;
    onDeleteChat?.(activeChatId);
  }, [activeChatId, onDeleteChat]);

  const handlePromptDraftChange = React.useCallback((value: string) => {
    const has = value.trim().length > 0;
    startTransition(() => {
      setHasPromptDraft(has);
      if (has) setActiveChip(null);
    });
  }, [startTransition]);

  const promptInput = (
    <IsolatedChatInput
      key="prompt-input"
      onSendMessage={handleSendMessageAndScroll}
      onStopGeneration={onStopGeneration}
      onScrollToBottom={scrollToBottom}
      showScrollToBottomButton={showScrollToBottom}
      isConversationStarted={isConversationStarted}
      isGenerating={isGenerating}
      queuedMessages={queuedMessages}
      onEditQueuedMessage={onEditQueuedMessage}
      onSendQueuedMessageNow={onSendQueuedMessageNow}
      onRemoveQueuedMessage={onRemoveQueuedMessage}
      onPromptChange={handlePromptDraftChange}
      onAddMenuOpenChange={setIsAddMenuOpen}
      focusKey={activeChatId ?? "new"}
      onUpgradeClick={onUpgradeClick}
      homerReasoningEffort={homerReasoningEffort}
      onHomerReasoningEffortChange={onHomerReasoningEffortChange}
      chatModel={chatModel}
      onChatModelChange={onChatModelChange}
    />
  );

  return (
    <div className="glass-agent-drop-target relative flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[inherit] bg-white">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "relative flex min-h-0 min-w-0 flex-col overflow-hidden px-0 pb-1.5 transition-[width,padding-right] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:pb-1.5",
            isViewerOpen && !isMobile ? "w-1/2 flex-none" : "flex-1",
            showDesktopArtifactsRail &&
              (isArtifactsPanelOpen ? "lg:pr-[392px]" : "lg:pr-28"),
          )}
        >
          {!isConversationStarted && !showMessageSkeleton ? (
            <ChatViewHeader
              isConversationStarted={false}
              isGenerating={isGenerating}
              onUpgradeClick={onUpgradeClick}
              onShareClick={() => setIsShareDialogOpen(true)}
              onToggleArtifactsPanel={toggleArtifactsPanel}
              isArtifactsPanelOpen={isArtifactsPanelOpen}
              chatTitle={activeChatTitle}
              isTitleStreaming={isActiveChatTitleStreaming}
              suppressArtifactsHover={isViewerOpen}
              onDeleteChat={handleDeleteActiveChat}
              onOpenSettings={onOpenSettings}
              onOpenMobileNav={onOpenMobileNav}
              showMobileMenu={showMobileMenu}
              className="relative z-20 shrink-0"
            />
          ) : null}
          <ChatViewPane
            className="flex min-h-0 flex-1 flex-col"
            hasConversation={isConversationStarted || showMessageSkeleton}
            isGenerating={isGenerating}
            hasPromptDraft={hasPromptDraft}
            isAddMenuOpen={isAddMenuOpen}
            activeChip={activeChip}
            onActiveChipChange={setActiveChip}
            onSendMessage={handleSendMessageAndScroll}
            scrollAreaRef={scrollAreaRef}
            conversation={
              showMessageSkeleton ? (
                <div
                  className="flex w-full min-w-0 max-w-full flex-col gap-6 px-0 pt-5 pb-5 sm:gap-8 sm:pt-10 sm:pb-8"
                  aria-busy="true"
                  aria-label="Loading conversation"
                >
                  {[0, 1].map((turn) => (
                    <div key={turn} className="flex flex-col gap-3">
                      <div className="ml-auto h-10 w-[min(72%,28rem)] overflow-hidden rounded-2xl">
                        <div className="h-full w-full shimmer-bg" />
                      </div>
                      <div className="mr-auto flex w-full max-w-[40rem] flex-col gap-2">
                        <div className="h-3.5 w-[92%] overflow-hidden rounded-full">
                          <div className="h-full w-full shimmer-bg" />
                        </div>
                        <div className="h-3.5 w-[78%] overflow-hidden rounded-full">
                          <div className="h-full w-full shimmer-bg" />
                        </div>
                        <div className="h-3.5 w-[64%] overflow-hidden rounded-full">
                          <div className="h-full w-full shimmer-bg" />
                        </div>
                      </div>
                    </div>
                  ))}
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
                  hasMoreMessages={hasMoreMessages}
                  isLoadingOlderMessages={isLoadingOlderMessages}
                  onLoadOlderMessages={onLoadOlderMessages}
                  onHistoryLoadChange={setHistoryLoading}
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
          {showChatOptionsHeader ? (
            <ChatViewHeader
              isConversationStarted
              isGenerating={isGenerating}
              onUpgradeClick={onUpgradeClick}
              onShareClick={() => setIsShareDialogOpen(true)}
              onToggleArtifactsPanel={toggleArtifactsPanel}
              isArtifactsPanelOpen={isArtifactsPanelOpen}
              chatTitle={activeChatTitle}
              isTitleStreaming={isActiveChatTitleStreaming}
              suppressArtifactsHover={isViewerOpen}
              isChatPinned={isActiveChatPinned}
              hasArtifacts={hasArtifacts}
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
              onOpenMobileNav={onOpenMobileNav}
              showMobileMenu={showMobileMenu}
              projectBreadcrumb={projectBreadcrumb}
              className="z-20"
              hideTrailingRailControlsOnDesktop={showDesktopArtifactsRail}
            />
          ) : null}
        </div>

        <AnimatePresence initial={false}>
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
                    ? { x: "100%", opacity: 0 }
                    : { width: 0, opacity: 0 }
                }
                animate={
                  isMobile
                    ? { x: 0, opacity: 1 }
                    : { width: "50%", opacity: 1 }
                }
                exit={
                  isMobile
                    ? { x: "100%", opacity: 0 }
                    : { width: 0, opacity: 0 }
                }
                transition={{
                  duration: isMobile ? 0.5 : 0.42,
                  ease: [0.32, 0.72, 0, 1],
                }}
                className={cn(
                  "fixed inset-y-0 right-0 z-50 flex shrink-0 overflow-hidden border-l border-zinc-200 will-change-[transform,width,opacity] lg:static lg:z-auto",
                )}
              >
                <motion.div
                  initial={{ opacity: 0, x: isMobile ? 24 : 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isMobile ? 24 : 12 }}
                  transition={{
                    duration: 0.24,
                    delay: isMobile ? 0.08 : 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="h-full w-full min-w-0 shrink-0 lg:w-full"
                >
                  <ArtifactViewerPanel
                    artifact={activeArtifact}
                    onClose={closeViewer}
                  />
                </motion.div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!isViewerOpen && (isArtifactsPanelOpen || isSourcesPanelOpen) && isMobile ? (
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
                key={isSourcesPanelOpen ? "sources-panel-mobile" : "artifacts-panel-mobile"}
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-y-0 right-0 z-50 flex shrink-0 overflow-hidden shadow-[-8px_0_28px_rgba(26,23,18,0.12)] will-change-[transform,width,opacity]"
              >
                <div className="h-full w-[min(100vw,360px)] shrink-0">
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
          <div className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden w-[384px] flex-col items-stretch py-2 pr-2 lg:flex">
            <div className="pointer-events-auto flex h-[35px] shrink-0 items-center justify-end px-1">
              <ChatRightRailControls
                isArtifactsPanelOpen={isArtifactsPanelOpen}
                onToggleArtifactsPanel={toggleArtifactsPanel}
                onShareClick={() => setIsShareDialogOpen(true)}
              />
            </div>
            <AnimatePresence initial={false}>
              {isArtifactsPanelOpen ? (
                <motion.div
                  key="desktop-artifacts-panel"
                  initial={{ opacity: 0, y: -8, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.985 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="pointer-events-auto mt-2.5 flex min-h-0 flex-1 flex-col overflow-hidden"
                >
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
