import type { AgentTraceState } from "@/lib/agent-trace";
import type { ChatArtifact } from "@/lib/chat-artifacts";
import type { MessageAttachment } from "@/lib/composer-attachments";

export type Message = {
  id: string;
  /**
   * Stable UI identity for the lifetime of a turn. Never changes when `id`
   * swaps from optimistic (`temp-*` / client UUID) → durable DB id — keeps
   * React keys, enter animations, and Streamdown trees from remounting.
   */
  clientId?: string;
  /**
   * Stable id shared by the user prompt and its assistant reply. Keeps the
   * transcript from re-pairing across queue flushes / realtime races.
   */
  turnId?: string;
  role: "user" | "assistant";
  content: string;
  thinkingContent?: string;
  isStreaming?: boolean;
  isThinkingStreaming?: boolean;
  hasThinking?: boolean;
  thinkingStartedAtMs?: number;
  thinkingDurationSeconds?: number;
  /**
   * True when this assistant turn failed (timeout / connection / provider).
   * Error turns hide action buttons; editing the parent user message branches.
   */
  generationFailed?: boolean;
  agentMode?: boolean;
  /** @deprecated Kept for persisted-message compat; the trace carries state. */
  agentFrameComplete?: boolean;
  /** Flat ordered activity trace for this assistant turn. */
  agentTrace?: AgentTraceState;
  agentArtifacts?: ChatArtifact[];
  /** User-uploaded images / documents shown as chips on the message. */
  attachments?: MessageAttachment[];
  /**
   * Server tree parent — the fork point this message hangs from. Sibling
   * branches (edited prompts, regenerated replies) share one parent; the
   * active branch is resolved server-side, so reloads always render the
   * exact thread without client-side overlays.
   */
  parentId?: string;
  /** 0-based position of the active variant among its siblings. */
  variantIndex?: number;
  /** Total sibling variants at this fork point (server truth). */
  variantCount?: number;
  /** Sibling message IDs in chronological order. */
  siblingIds?: string[];
  /**
   * Client cache of inactive sibling contents for instant arrow paint,
   * keyed by variant index. Authoritative content always comes from the
   * server switch response; this only removes the round-trip flicker.
   */
  siblingVariants?: Array<{ id?: string; index: number; content: string }>;
  /** Optional creation timestamp (ms since epoch) for UI like message menus. */
  createdAt?: number;
};

export type RecentChat = {
  readonly id: string;
  readonly name: string;
  readonly isTitleStreaming?: boolean;
  readonly titleGenerated?: boolean;
  readonly updatedAt?: number;
  readonly pinned?: boolean;
  /** Sidebar placeholder while the server allocates a unique chat id. */
  readonly isCreating?: boolean;
};

export type TextSize = "small" | "medium" | "large";
