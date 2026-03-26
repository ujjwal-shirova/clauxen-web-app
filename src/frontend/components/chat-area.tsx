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
  isGenerating: boolean;
  onUpgradeClick: () => void;
  updateMessage: (chatId: string, messageId: string, newContent: string) => void;
  activeChatId: string | null;
  onOpenAgentSwarm: () => void;
}

export function ChatArea({
  messages,
  onSendMessage,
  isGenerating,
  onUpgradeClick,
  updateMessage,
  activeChatId,
  onOpenAgentSwarm,
}: ChatAreaProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [isAgentSwarmOpen, setIsAgentSwarmOpen] = useState(false);

  const isConversationStarted = messages.length > 0;

  React.useEffect(() => {
    if (isConversationStarted && scrollAreaRef.current) {
      const scrollableViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollableViewport) {
        scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
      }
    }
  }, [messages, isGenerating, isConversationStarted]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditValue(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditValue('');
  };

  const handleSaveEdit = (messageId: string) => {
    if (activeChatId && editValue.trim()) {
      updateMessage(activeChatId, messageId, editValue);
    }
    setEditingMessageId(null);
    setEditValue('');
  };

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
              messages={messages}
              isGenerating={isGenerating}
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
                isConversationStarted={isConversationStarted}
                isGenerating={isGenerating}
              />
            }
            conversation={
              <ConversationThread
                messages={messages}
                isGenerating={isGenerating}
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
