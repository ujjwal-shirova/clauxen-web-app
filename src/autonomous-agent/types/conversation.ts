import type { ResponseInputItem } from "openai/resources/responses/responses";

export type ConversationStatus =
  | "idle"
  | "running"
  | "waiting_for_user"
  | "error";

export type ConversationRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: ConversationStatus;
  lastResponseId: string | null;
  /** Pending input items for the next Responses API call (user msgs, fn outputs). */
  pendingItems: ResponseInputItem[];
  /** Active run id when a turn is in progress. */
  activeRunId: string | null;
  /** Clarification question surfaced to the user. */
  pendingClarification: { toolCallId: string; question: string } | null;
};

export type UserMessagePayload = {
  conversationId: string;
  content: string;
};

export type StreamClientMessage =
  | { type: "user_message"; conversationId: string; content: string }
  | { type: "subscribe"; conversationId: string; lastEventIndex?: number }
  | { type: "resume"; conversationId: string };
