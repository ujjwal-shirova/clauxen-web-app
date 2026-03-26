'use client';

import type { ReactNode } from 'react';
import { ChatViewPane } from '../chat-view-pane';

interface AgentSwarmLeftPaneProps {
  hasConversation: boolean;
  activeChip: string | null;
  onActiveChipChange: (chip: string | null) => void;
  onOpenAgentSwarm: () => void;
  onSendMessage: (prompt: string) => void;
  promptInput: ReactNode;
  conversation: ReactNode;
}

export function AgentSwarmLeftPane({
  hasConversation,
  activeChip,
  onActiveChipChange,
  onOpenAgentSwarm,
  onSendMessage,
  promptInput,
  conversation,
}: AgentSwarmLeftPaneProps) {
  return (
    <ChatViewPane
      hasConversation={hasConversation}
      activeChip={activeChip}
      onActiveChipChange={onActiveChipChange}
      onOpenAgentSwarm={onOpenAgentSwarm}
      onSendMessage={onSendMessage}
      promptInput={promptInput}
      conversation={conversation}
      className="flex min-h-0 flex-col overflow-hidden"
    />
  );
}
