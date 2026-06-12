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
import { ChatMessageNavigator } from "./chat-message-navigator";
import { useIsMobile } from "@/frontend/hooks/use-mobile";
import { cn } from "@/frontend/lib/utils";

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (prompt: string) => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  onUpgradeClick: () => void;
  editMessageWithBranch: (
    chatId: string,
    messageId: string,
    newContent: string,
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
  thinkingEnabled: boolean;
  onThinkingEnabledChange: (enabled: boolean) => void;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (enabled: boolean) => void;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
}

const ARTIFACTS_PANEL_WIDTH = 360;

export function ChatArea({
  messages,
  onSendMessage,
  onStopGeneration,
  isGenerating,
  onUpgradeClick,
  editMessageWithBranch,
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
  thinkingEnabled,
  onThinkingEnabledChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
  onOpenMobileNav,
  showMobileMenu = false,
}: ChatAreaProps) {
  const isMobile = useIsMobile();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [hasPromptDraft, setHasPromptDraft] = useState(false);
  const [isArtifactsPanelOpen, setIsArtifactsPanelOpen] = useState(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] =
    useState(false);
  const [, startTransition] = React.useTransition();
  const deferredMessages = React.useDeferredValue(messages);
  const displayMessages = isGenerating ? messages : deferredMessages;
  const scrollRafRef = React.useRef<number | null>(null);
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null);
  const isAutoScrollEnabledRef = React.useRef(true);
  const [isFastScrolling, setIsFastScrolling] = React.useState(false);
  const lastScrollTopRef = React.useRef(0);
  const lastScrollTimeRef = React.useRef(0);
  const fastScrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isConversationStarted = messages.length > 0;

  React.useEffect(() => {
    setHasPromptDraft(false);
  }, [activeChatId]);

  React.useEffect(() => {
    if (!isConversationStarted) {
      isAutoScrollEnabledRef.current = true;
    }
  }, [isConversationStarted]);

  React.useEffect(() => {
    if (!isConversationStarted || !scrollAreaRef.current) return;
    const scrollableViewport =
      scrollAreaRef.current.querySelector<HTMLDivElement>(
        "div[data-radix-scroll-area-viewport]",
      );
    if (!scrollableViewport) return;
    scrollViewportRef.current = scrollableViewport;

    if (!isAutoScrollEnabledRef.current) {
      return;
    }

    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
    });

    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [displayMessages, isConversationStarted]);

  React.useEffect(() => {
    if (!isConversationStarted || !scrollAreaRef.current) {
      setShowScrollToBottomButton(false);
      return;
    }

    const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>(
      "div[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;
    scrollViewportRef.current = viewport;

    const updateButtonVisibility = () => {
      const now = performance.now();
      const deltaY = Math.abs(viewport.scrollTop - lastScrollTopRef.current);
      const deltaT = now - lastScrollTimeRef.current;
      if (deltaT > 0 && deltaY / deltaT > 2.5) {
        setIsFastScrolling(true);
        if (fastScrollTimeoutRef.current) {
          clearTimeout(fastScrollTimeoutRef.current);
        }
        fastScrollTimeoutRef.current = setTimeout(
          () => setIsFastScrolling(false),
          150,
        );
      }
      lastScrollTopRef.current = viewport.scrollTop;
      lastScrollTimeRef.current = now;

      const distanceToBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

      if (distanceToBottom > 120) {
        isAutoScrollEnabledRef.current = false;
      } else if (distanceToBottom <= 15) {
        isAutoScrollEnabledRef.current = true;
      }

      setShowScrollToBottomButton(distanceToBottom > 15);
    };

    updateButtonVisibility();
    viewport.addEventListener("scroll", updateButtonVisibility, {
      passive: true,
    });
    return () => {
      viewport.removeEventListener("scroll", updateButtonVisibility);
      if (fastScrollTimeoutRef.current) {
        clearTimeout(fastScrollTimeoutRef.current);
        fastScrollTimeoutRef.current = null;
      }
    };
  }, [isConversationStarted, displayMessages.length]);

  const scrollToBottom = React.useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    isAutoScrollEnabledRef.current = true;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const handleSaveEditedMessage = React.useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeChatId) return;
      await editMessageWithBranch(activeChatId, messageId, newContent);
    },
    [activeChatId, editMessageWithBranch],
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
      isAutoScrollEnabledRef.current = true;
      setShowScrollToBottomButton(false);
      onSendMessage(prompt);
      requestAnimationFrame(() => {
        const viewport = scrollViewportRef.current;
        if (!viewport) return;
        viewport.scrollTop = viewport.scrollHeight;
      });
    },
    [onSendMessage],
  );

  const toggleArtifactsPanel = React.useCallback(() => {
    setIsArtifactsPanelOpen((open) => !open);
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
      showScrollToBottomButton={showScrollToBottomButton}
      isConversationStarted={isConversationStarted}
      isGenerating={isGenerating}
      onPromptChange={handlePromptDraftChange}
      focusKey={activeChatId ?? "new"}
      onUpgradeClick={onUpgradeClick}
      thinkingEnabled={thinkingEnabled}
      onThinkingEnabledChange={onThinkingEnabledChange}
      webSearchEnabled={webSearchEnabled}
      onWebSearchEnabledChange={onWebSearchEnabledChange}
      showModelSelector={isConversationStarted}
    />
  );

  return (
    <div className="relative flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0 pb-2 sm:px-5 sm:pb-2 md:px-6">
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
              onDeleteChat={handleDeleteActiveChat}
              onOpenSettings={onOpenSettings}
              thinkingEnabled={thinkingEnabled}
              onThinkingEnabledChange={onThinkingEnabledChange}
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
            activeChip={activeChip}
            onActiveChipChange={setActiveChip}
            onSendMessage={handleSendMessageAndScroll}
            scrollAreaRef={scrollAreaRef}
            conversation={
              <ConversationThread
                messages={displayMessages}
                onSaveEditedMessage={handleSaveEditedMessage}
                onRetryAssistant={handleRetryAssistant}
                onSwitchBranch={handleSwitchBranch}
                scrollAreaRef={scrollAreaRef}
                isFastScrolling={isFastScrolling}
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
          {isConversationStarted ? (
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
              onOpenMobileNav={onOpenMobileNav}
              showMobileMenu={showMobileMenu}
              className="z-20"
            />
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {isArtifactsPanelOpen ? (
            <>
              <motion.div
                key="artifacts-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] lg:hidden"
                aria-hidden
                onClick={() => setIsArtifactsPanelOpen(false)}
              />
              <motion.div
                key="artifacts-panel"
                initial={
                  isMobile
                    ? { x: "100%", opacity: 0 }
                    : { width: 0, opacity: 0 }
                }
                animate={
                  isMobile
                    ? { x: 0, opacity: 1 }
                    : { width: ARTIFACTS_PANEL_WIDTH, opacity: 1 }
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
                  "fixed inset-y-0 right-0 z-50 flex shrink-0 overflow-hidden shadow-[-8px_0_28px_rgba(26,23,18,0.12)] will-change-[transform,width,opacity] lg:static lg:z-auto lg:shadow-none",
                )}
              >
                <div className="h-full w-[min(100vw,360px)] shrink-0 lg:w-[360px]">
                  <ChatArtifactsPanel
                    onClose={() => setIsArtifactsPanelOpen(false)}
                  />
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </div>

      <ShareDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        chatId={activeChatId}
      />
    </div>
  );
}
