import type { AgentSegment } from "@/frontend/lib/agent-segments";

export type MessageBranchVersion = {
  readonly content: string;
  readonly thinkingContent?: string;
  readonly hasThinking?: boolean;
  readonly thinkingDurationSeconds?: number;
  readonly agentSegments?: AgentSegment[];
  readonly agentMode?: boolean;
  readonly agentFrameComplete?: boolean;
  readonly snapshot?: readonly Message[];
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
  agentMode?: boolean;
  agentFrameComplete?: boolean;
  agentSegments?: AgentSegment[];
  branchVersions?: MessageBranchVersion[];
  activeBranchIndex?: number;
};

export type RecentChat = {
  readonly id: string;
  readonly name: string;
  readonly isTitleStreaming?: boolean;
  readonly titleGenerated?: boolean;
  readonly updatedAt?: number;
  readonly projectId?: string | null;
  readonly pinned?: boolean;
};

export type TextSize = "small" | "medium" | "large";
