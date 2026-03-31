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
  updateMessage: (chatId: string, messageId: string, newContent: string) => void;
  activeChatId: string | null;
  activeChatTitle?: string;
  isActiveChatTitleStreaming?: boolean;
  onOpenAgentSwarm: () => void;
}

export function ChatArea({
  messages,
  onSendMessage,
  onStopGeneration,
  isGenerating,
  onUpgradeClick,
  updateMessage,
  activeChatId,
  activeChatTitle,
  isActiveChatTitleStreaming,
  onOpenAgentSwarm,
}: ChatAreaProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [isAgentSwarmOpen, setIsAgentSwarmOpen] = useState(false);
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

  const handleCopy = React.useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleStartEdit = React.useCallback((message: Message) => {
    setEditingMessageId(message.id);
    setEditValue(message.content);
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setEditingMessageId(null);
    setEditValue('');
  }, []);

  const handleSaveEdit = React.useCallback((messageId: string) => {
    if (activeChatId && editValue.trim()) {
      updateMessage(activeChatId, messageId, editValue);
    }
    setEditingMessageId(null);
    setEditValue('');
  }, [activeChatId, editValue, updateMessage]);

  const openAgentSwarm = () => {
    setActiveChip(null);
    setIsAgentSwarmOpen(true);
    onOpenAgentSwarm();
  };

  return (
    <div className="flex flex-col flex-1 relative h-full w-full bg-[#faf9f5] overflow-hidden">
      {isAgentSwarmOpen ? (
        <AgentSwarmWorkspace
          hasConversation={isConversationStarted}
          promptInput={
            <PromptInput
              onSendMessage={onSendMessage}
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
          onSendMessage={onSendMessage}
          onUpgradeClick={onUpgradeClick}
          onShareClick={() => setIsShareDialogOpen(true)}
          conversation={
            <ConversationThread
              messages={deferredMessages}
              editingMessageId={editingMessageId}
              editValue={editValue}
              copiedId={copiedId}
              onEditValueChange={setEditValue}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onCopy={handleCopy}
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
            chatTitle={activeChatTitle}
            isTitleStreaming={isActiveChatTitleStreaming}
          />
          <ChatViewPane
            hasConversation={isConversationStarted}
            activeChip={activeChip}
            onActiveChipChange={setActiveChip}
            onOpenAgentSwarm={openAgentSwarm}
            onSendMessage={onSendMessage}
            scrollAreaRef={scrollAreaRef}
            promptInput={
              <PromptInput
                onSendMessage={onSendMessage}
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
                editingMessageId={editingMessageId}
                editValue={editValue}
                copiedId={copiedId}
                onEditValueChange={setEditValue}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                onCopy={handleCopy}
              />
            }
            className="flex min-h-0 flex-1 flex-col"
          />
        </>
      )}

      <ShareDialog isOpen={isShareDialogOpen} onClose={() => setIsShareDialogOpen(false)} />
    </div>
  );
}
