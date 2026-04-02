'use client';

import React, { useState } from 'react';
import { PromptInput } from './prompt-input';
import type { Message } from '@/frontend/lib/types';
import { ConversationThread } from './conversation-thread';
import { AgentSwarmWorkspace } from './agent-swarm/agent-swarm-workspace';
import { ShareDialog } from './share-dialog';
import { ChatViewHeader } from './chat-view-header';
import { ChatViewPane } from './chat-view-pane';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (prompt: string) => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  onUpgradeClick: () => void;
  editMessageWithBranch: (chatId: string, messageId: string, newContent: string) => Promise<void>;
  retryAssistantWithBranch: (chatId: string, assistantMessageId: string) => Promise<void>;
  switchMessageBranch: (chatId: string, messageId: string, direction: 'prev' | 'next') => void;
  activeChatId: string | null;
  activeChatTitle?: string;
  isActiveChatTitleStreaming?: boolean;
  onOpenAgentSwarm: () => void;
  onRequestCollapseSidebar: () => void;
}

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
  onOpenAgentSwarm,
  onRequestCollapseSidebar,
}: ChatAreaProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [isAgentSwarmOpen, setIsAgentSwarmOpen] = useState(false);
  const [isArtifactsPanelOpen, setIsArtifactsPanelOpen] = useState(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const deferredMessages = React.useDeferredValue(messages);
  const scrollRafRef = React.useRef<number | null>(null);
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null);
  const isAutoScrollEnabledRef = React.useRef(true);

  const isConversationStarted = messages.length > 0;

  React.useEffect(() => {
    if (!isConversationStarted) {
      isAutoScrollEnabledRef.current = true;
    }
  }, [isConversationStarted]);

  React.useEffect(() => {
    if (!isConversationStarted || !scrollAreaRef.current) return;
    const scrollableViewport = scrollAreaRef.current.querySelector<HTMLDivElement>('div[data-radix-scroll-area-viewport]');
    if (!scrollableViewport) return;
    scrollViewportRef.current = scrollableViewport;

    if (!isAutoScrollEnabledRef.current) {
      return;
    }

    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      const distanceToBottom =
        scrollableViewport.scrollHeight - scrollableViewport.scrollTop - scrollableViewport.clientHeight;
      const shouldAutoScroll = distanceToBottom < 180;

      if (shouldAutoScroll) {
        scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
      }
    });

    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [deferredMessages, isConversationStarted]);

  React.useEffect(() => {
    if (!isConversationStarted || !scrollAreaRef.current) {
      setShowScrollToBottomButton(false);
      return;
    }

    const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>('div[data-radix-scroll-area-viewport]');
    if (!viewport) return;
    scrollViewportRef.current = viewport;

    const updateButtonVisibility = () => {
      const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const isAtBottom = distanceToBottom <= 80;
      isAutoScrollEnabledRef.current = isAtBottom;
      setShowScrollToBottomButton(!isAtBottom);
    };

    updateButtonVisibility();
    viewport.addEventListener('scroll', updateButtonVisibility, { passive: true });
    return () => viewport.removeEventListener('scroll', updateButtonVisibility);
  }, [isConversationStarted, deferredMessages.length]);

  const scrollToBottom = React.useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    isAutoScrollEnabledRef.current = true;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const handleSaveEditedMessage = React.useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeChatId) return;
      await editMessageWithBranch(activeChatId, messageId, newContent);
    },
    [activeChatId, editMessageWithBranch]
  );

  const handleRetryAssistant = React.useCallback(async (messageId: string) => {
    if (!activeChatId) return;
    await retryAssistantWithBranch(activeChatId, messageId);
  }, [activeChatId, retryAssistantWithBranch]);

  const handleSwitchBranch = React.useCallback((messageId: string, direction: 'prev' | 'next') => {
    if (!activeChatId) return;
    switchMessageBranch(activeChatId, messageId, direction);
  }, [activeChatId, switchMessageBranch]);

  const handleSendMessageAndScroll = React.useCallback((prompt: string) => {
    isAutoScrollEnabledRef.current = true;
    setShowScrollToBottomButton(false);
    onSendMessage(prompt);
    requestAnimationFrame(() => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;
      viewport.scrollTop = viewport.scrollHeight;
    });
  }, [onSendMessage]);

  const openAgentSwarm = () => {
    setActiveChip(null);
    setIsAgentSwarmOpen(true);
    onOpenAgentSwarm();
  };

  const toggleArtifactsPanel = React.useCallback(() => {
    const next = !isArtifactsPanelOpen;
    if (next) {
      onRequestCollapseSidebar();
    }
    setIsArtifactsPanelOpen(next);
  }, [isArtifactsPanelOpen, onRequestCollapseSidebar]);

  return (
    <div className="flex flex-col flex-1 relative h-full w-full bg-[#faf9f5] overflow-hidden">
      {isAgentSwarmOpen ? (
        <AgentSwarmWorkspace
          hasConversation={isConversationStarted}
          promptInput={
            <PromptInput
              onSendMessage={handleSendMessageAndScroll}
              onStopGeneration={onStopGeneration}
              onScrollToBottom={scrollToBottom}
              showScrollToBottomButton={showScrollToBottomButton}
              isConversationStarted={isConversationStarted}
              isGenerating={isGenerating}
            />
          }
          activeChip={activeChip}
          onActiveChipChange={setActiveChip}
          onOpenAgentSwarm={openAgentSwarm}
          onSendMessage={handleSendMessageAndScroll}
          onUpgradeClick={onUpgradeClick}
          onShareClick={() => setIsShareDialogOpen(true)}
          conversation={
            <ConversationThread
              messages={deferredMessages}
              onSaveEditedMessage={handleSaveEditedMessage}
              onRetryAssistant={handleRetryAssistant}
              onSwitchBranch={handleSwitchBranch}
              className="max-w-full px-0 py-2"
            />
          }
        />
      ) : (
        <>
          <ChatViewHeader
            isConversationStarted={isConversationStarted}
            onUpgradeClick={onUpgradeClick}
            onShareClick={() => setIsShareDialogOpen(true)}
            onToggleArtifactsPanel={toggleArtifactsPanel}
            isArtifactsPanelOpen={isArtifactsPanelOpen}
            chatTitle={activeChatTitle}
            isTitleStreaming={isActiveChatTitleStreaming}
          />
          <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
            <ChatViewPane
              hasConversation={isConversationStarted}
              activeChip={activeChip}
              onActiveChipChange={setActiveChip}
              onOpenAgentSwarm={openAgentSwarm}
              onSendMessage={handleSendMessageAndScroll}
              scrollAreaRef={scrollAreaRef}
              promptInput={
                <PromptInput
                  onSendMessage={handleSendMessageAndScroll}
                  onStopGeneration={onStopGeneration}
                  onScrollToBottom={scrollToBottom}
                  showScrollToBottomButton={showScrollToBottomButton}
                  isConversationStarted={isConversationStarted}
                  isGenerating={isGenerating}
                />
              }
              conversation={
                <ConversationThread
                  messages={deferredMessages}
                  onSaveEditedMessage={handleSaveEditedMessage}
                  onRetryAssistant={handleRetryAssistant}
                  onSwitchBranch={handleSwitchBranch}
                />
              }
              className="flex min-h-0 flex-1 flex-col"
            />

            {isArtifactsPanelOpen ? (
              <aside className="h-full w-[384px] overflow-y-auto rounded-2xl border border-[#1f1e1d]/15 bg-[#faf9f5] p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-[#3d3d3a]">Artifacts</h3>
                  <button className="inline-flex h-8 min-w-[64px] items-center gap-1 rounded-md px-2.5 text-[12px] font-[430] text-[#3d3d3a] transition-colors hover:bg-black/5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" /></svg>
                    <span>Download all</span>
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {['Gitee dataset metadata', 'Jihulab dataset documentation', 'Notabug dataset documentation', 'Gitflic dataset documentation', 'Gitverse dataset documentation'].map((item) => (
                    <button key={item} className="flex w-full items-center justify-between rounded-lg border border-[#1f1e1d]/15 px-4 py-3 text-left transition-colors hover:bg-[#f3f1ea]">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] text-[#3d3d3a]">{item}</p>
                        <p className="text-[12px] text-[#73726c]">Document · MD</p>
                      </div>
                      <span className="ml-2 text-[#73726c]">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.5 13a.5.5 0 0 1 .5.5v2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-2a.5.5 0 0 1 1 0v2a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 1 .5-.5M10 3a.5.5 0 0 1 .5.5v8.686l3.126-3.518a.5.5 0 0 1 .748.664l-4 4.5-.08.071a.5.5 0 0 1-.668-.071l-4-4.5-.059-.082A.5.5 0 0 1 6.3 8.6l.075.068L9.5 12.186V3.5A.5.5 0 0 1 10 3" /></svg>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            ) : null}
          </div>
        </>
      )}

      <ShareDialog isOpen={isShareDialogOpen} onClose={() => setIsShareDialogOpen(false)} />
    </div>
  );
}
