import type { AgentSegment } from "@/frontend/lib/agent-segments";
import type { AgentFrame } from "@/frontend/lib/agent-frames";
import type { ChatArtifact } from "@/frontend/lib/chat-artifacts";
import type { MessageAttachment } from "@/frontend/lib/composer-attachments";

export type MessageBranchVersion = {
  readonly content: string;
  readonly attachments?: MessageAttachment[];
  readonly thinkingContent?: string;
  readonly hasThinking?: boolean;
  readonly thinkingDurationSeconds?: number;
  readonly agentMode?: boolean;
  readonly agentFrameComplete?: boolean;
  readonly agentSegments?: AgentSegment[];
  readonly agentFrames?: AgentFrame[];
  readonly agentArtifacts?: ChatArtifact[];
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
  agentFrames?: AgentFrame[];
  activeAgentFrameIndex?: number;
  agentArtifacts?: ChatArtifact[];
  /** User-uploaded images / documents shown as chips on the message. */
  attachments?: MessageAttachment[];
  branchVersions?: MessageBranchVersion[];
  activeBranchIndex?: number;
  /** Optional creation timestamp (ms since epoch) for UI like message menus. */
  createdAt?: number;
};

export type RecentChat = {
  readonly id: string;
  readonly name: string;
  readonly isTitleStreaming?: boolean;
  readonly titleGenerated?: boolean;
  readonly updatedAt?: number;
  readonly projectId?: string | null;
  readonly pinned?: boolean;
  /** Sidebar placeholder while the server allocates a unique chat id. */
  readonly isCreating?: boolean;
};

export type TextSize = "small" | "medium" | "large";
