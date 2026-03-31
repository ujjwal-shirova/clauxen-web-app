
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinkingContent?: string;
  isStreaming?: boolean;
  hasThinking?: boolean;
};

export type TextSize = "small" | "medium" | "large";
