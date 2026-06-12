"use client";

import type { ReactNode } from "react";
import { ChatViewPane } from "../chat-view-pane";

interface AgentSwarmLeftPaneProps {
  hasConversation: boolean;
  activeChip: string | null; // selected quick-action chip; null = chips visible
  onActiveChipChange: (chip: string | null) => void; // chip select/clear callback
  onSendMessage: (prompt: string) => void; // user prompt submit handler
  promptInput: ReactNode; // pre-built PromptInput slot; composition pattern
  conversation: ReactNode; // ConversationThread slot; parent injects messages UI
}

export function AgentSwarmLeftPane({
  hasConversation,
  activeChip,
  onActiveChipChange,
  onSendMessage,
  promptInput,
  conversation,
}: AgentSwarmLeftPaneProps) {
  return (
    <ChatViewPane
      hasConversation={hasConversation} // conversation state pass-through
      hasPromptDraft={false}
      activeChip={activeChip} // chip selection state
      onActiveChipChange={onActiveChipChange} // chip change handler
      onSendMessage={onSendMessage} // send handler
      promptInput={promptInput} // injected input component
      conversation={conversation} // injected thread component
      className="flex min-h-0 flex-col overflow-hidden"
    />
  );
}
