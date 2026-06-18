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
import { collectChatArtifacts } from "@/frontend/lib/chat-artifacts";
import { ChatMessageNavigator } from "./chat-message-navigator";
import { useIsMobile } from "@/frontend/hooks/use-mobile";
import { useChatScroll } from "@/frontend/hooks/use-chat-scroll";
import { useChatScrollActivity } from "@/frontend/hooks/use-chat-scroll-activity";
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
  thinkingEnabled: boolean;
  onThinkingEnabledChange: (enabled: boolean) => void;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (enabled: boolean) => void;
  chatModel: import("@/lib/chat-models").ChatModelId;
  onChatModelChange: (model: import("@/lib/chat-models").ChatModelId) => void;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  projectBreadcrumb?: {
    label: string;
    onClick?: () => void;
  };
}

const ARTIFACTS_PANEL_WIDTH = 360;

export function ChatArea({
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
  thinkingEnabled,
  onThinkingEnabledChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
  chatModel,
  onChatModelChange,
  onOpenMobileNav,
  showMobileMenu = false,
  projectBreadcrumb,
}: ChatAreaProps) {
  const isMobile = useIsMobile();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [hasPromptDraft, setHasPromptDraft] = useState(false);
  const [isArtifactsPanelOpen, setIsArtifactsPanelOpen] = useState(false);
  const [, startTransition] = React.useTransition();
  const displayMessages = messages;

  const isConversationStarted = messages.length > 0;
  const showChatOptionsHeader = isConversationStarted || Boolean(activeChatId);

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
  const artifactCountRef = React.useRef(chatArtifacts.length);

  React.useEffect(() => {
    if (chatArtifacts.length > artifactCountRef.current) {
      setIsArtifactsPanelOpen(true);
    }
    artifactCountRef.current = chatArtifacts.length;
  }, [chatArtifacts.length]);

  React.useEffect(() => {
    setHasPromptDraft(false);
  }, [activeChatId]);

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
      showScrollToBottomButton={showScrollToBottom}
      isConversationStarted={isConversationStarted}
      isGenerating={isGenerating}
      onPromptChange={handlePromptDraftChange}
      focusKey={activeChatId ?? "new"}
      onUpgradeClick={onUpgradeClick}
      thinkingEnabled={thinkingEnabled}
      onThinkingEnabledChange={onThinkingEnabledChange}
      webSearchEnabled={webSearchEnabled}
      onWebSearchEnabledChange={onWebSearchEnabledChange}
      chatModel={chatModel}
      onChatModelChange={onChatModelChange}
    />
  );

  return (
    <div className="glass-agent-drop-target relative flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[inherit] bg-white">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0 pb-1.5 sm:pb-1.5">
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
                conversationKey={activeChatId}
                isFastScrolling={isFastScrolling}
                onSaveEditedMessage={handleSaveEditedMessage}
                onRetryUserMessage={handleRetryUserMessage}
                onRetryAssistant={handleRetryAssistant}
                onSwitchBranch={handleSwitchBranch}
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
                    messages={messages}
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
