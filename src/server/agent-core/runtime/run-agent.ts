/**
 * Claude Code–style agent loop entry for Clauxen Web.
 *
 * Stream → tools → tool_result → repeat, via Provider Messages API only.
 * UI events go to ClauxenSseStream → src/components/agent/* (DOM).
 */

export {
  runAutonomousAgent,
  runAutonomousAgent as runAgent,
  generateChatTitle,
  type AgentStreamOptions,
} from "@/server/agent-core/runtime/query-loop";
