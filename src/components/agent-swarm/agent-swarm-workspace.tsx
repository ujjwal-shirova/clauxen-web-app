'use client';

import type { ReactNode } from 'react';
import { ChatViewHeader } from '../chat-view-header';
import { AgentSwarmLeftPane } from './agent-swarm-left-pane';
import { AgentSwarmRightPane } from './agent-swarm-right-pane';

interface AgentSwarmWorkspaceProps {
  hasConversation: boolean;
  conversation: ReactNode;
  promptInput: ReactNode;
  activeChip: string | null;
  onActiveChipChange: (chip: string | null) => void;
  onOpenAgentSwarm: () => void;
  onSendMessage: (prompt: string) => void;
  onUpgradeClick: () => void;
  onShareClick: () => void;
}

export function AgentSwarmWorkspace({
  hasConversation,
  conversation,
  promptInput,
  activeChip,
  onActiveChipChange,
  onOpenAgentSwarm,
  onSendMessage,
  onUpgradeClick,
  onShareClick,
}: AgentSwarmWorkspaceProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatViewHeader
        isConversationStarted={hasConversation}
        onUpgradeClick={onUpgradeClick}
        onShareClick={onShareClick}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 pt-1 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <AgentSwarmLeftPane
          hasConversation={hasConversation}
          activeChip={activeChip}
          onActiveChipChange={onActiveChipChange}
          onOpenAgentSwarm={onOpenAgentSwarm}
          onSendMessage={onSendMessage}
          conversation={conversation}
          promptInput={promptInput}
        />
        <AgentSwarmRightPane />
      </div>
    </div>
  );
}
