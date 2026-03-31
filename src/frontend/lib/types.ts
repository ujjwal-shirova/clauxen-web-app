
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
};

export type RecentChat = {
  id: string;
  name: string;
  isTitleStreaming?: boolean;
  titleGenerated?: boolean;
};

export type TextSize = "small" | "medium" | "large";
