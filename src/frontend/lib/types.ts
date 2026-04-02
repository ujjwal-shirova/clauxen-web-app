
export type MessageBranchVersion = {
  content: string;
  thinkingContent?: string;
  hasThinking?: boolean;
  thinkingDurationSeconds?: number;
  snapshot?: Message[];
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinkingContent?: string;
  isStreaming?: boolean;
  isThinkingStreaming?: boolean;
  hasThinking?: boolean;
  thinkingStartedAtMs?: number;
  thinkingDurationSeconds?: number;
  branchVersions?: MessageBranchVersion[];
  activeBranchIndex?: number;
};

export type RecentChat = {
  id: string;
  name: string;
  isTitleStreaming?: boolean;
  titleGenerated?: boolean;
};

export type TextSize = "small" | "medium" | "large";
