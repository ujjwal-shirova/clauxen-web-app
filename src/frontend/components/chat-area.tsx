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
import { ChatMessageNavigator } from "./chat-message-navigator";
import { useIsMobile } from "@/frontend/hooks/use-mobile";
import { useChatScroll } from "@/frontend/hooks/use-chat-scroll";
import { useChatScrollActivity } from "@/frontend/hooks/use-chat-scroll-activity";
import { cn } from "@/frontend/lib/utils";
import { CLAUXEN_CHAT_SEND_EVENT } from "@/frontend/lib/chat-send-event";

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (prompt: string) => void | Promise<void>;
  onStopGeneration: () => void;
  isGenerating: boolean;
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
  onUpgradeClick,
  editMessageWithBranch,
  redoUserMessageWithBranch,
  retryAssistantWithBranch,
  switchMessageBranch,
  activeChatId,
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

  const isConversationStarted = messages.length > 0;
  const showChatOptionsHeader = isConversationStarted || Boolean(activeChatId);
  const showDesktopArtifactsRail =
    isConversationStarted && !isMobile && !isViewerOpen && !isSourcesPanelOpen;

  const { scrollToBottom, pinToBottom, showScrollToBottom, followContentGrowth } =
    useChatScroll({
      scrollAreaRef,
      enabled: isConversationStarted,
    });
  const { isFastScrolling } = useChatScrollActivity(
    scrollAreaRef,
    isConversationStarted,
  );
  const chatArtifacts = React.useMemo(
    () => collectChatArtifacts(messages),
    [messages],
  );
  const chatSources = React.useMemo(() => collectChatSources(messages), [messages]);
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

  const streamFollowKey = React.useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last?.isStreaming) return 0;
    return (
      last.content.length +
      (last.thinkingContent?.length ?? 0) +
      (last.agentSegments?.length ?? 0)
    );
  }, [messages]);

  React.useLayoutEffect(() => {
    if (!isGenerating) return;
    followContentGrowth();
  }, [isGenerating, streamFollowKey, followContentGrowth]);

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
    (prompt: string) => {
      onSendMessage(prompt);
      pinToBottom();
      requestAnimationFrame(() => pinToBottom());
    },
    [onSendMessage, pinToBottom],
  );

  React.useEffect(() => {
    const onChatSend = (event: Event) => {
      const detail = (event as CustomEvent<{ content?: string }>).detail;
      const content = detail?.content?.trim();
      if (!content || isGenerating) return;
      handleSendMessageAndScroll(content);
    };

    window.addEventListener(CLAUXEN_CHAT_SEND_EVENT, onChatSend);
    return () => window.removeEventListener(CLAUXEN_CHAT_SEND_EVENT, onChatSend);
  }, [handleSendMessageAndScroll, isGenerating]);

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
          {!isConversationStarted ? (
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
            hasConversation={isConversationStarted}
            isGenerating={isGenerating}
            hasPromptDraft={hasPromptDraft}
            isAddMenuOpen={isAddMenuOpen}
            activeChip={activeChip}
            onActiveChipChange={setActiveChip}
            onSendMessage={handleSendMessageAndScroll}
            scrollAreaRef={scrollAreaRef}
            conversation={
              <ConversationThread
                messages={displayMessages}
                conversationKey={activeChatId}
                isFastScrolling={isFastScrolling}
                onSaveEditedMessage={handleSaveEditedMessage}
                onRetryUserMessage={handleRetryUserMessage}
                onRetryAssistant={handleRetryAssistant}
                onSwitchBranch={handleSwitchBranch}
                onOpenSources={openSourcesPanel}
                scrollAreaRef={scrollAreaRef}
              />
            }
            promptInput={promptInput}
            messageNavigator={
              isConversationStarted ? (
                <ChatMessageNavigator
                  messages={displayMessages}
                  scrollAreaRef={scrollAreaRef}
                />
              ) : null
            }
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
                  duration: isMobile ? 0.5 : 0.32,
                  ease: [0.32, 0.72, 0, 1],
                }}
                className={cn(
                  "fixed inset-y-0 right-0 z-50 flex shrink-0 overflow-hidden border-l border-zinc-200 will-change-[transform,width,opacity] lg:static lg:z-auto",
                )}
              >
                <div className="h-full w-full min-w-0 shrink-0 lg:w-full">
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
