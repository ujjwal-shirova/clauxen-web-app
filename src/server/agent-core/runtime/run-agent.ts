/**
 * OpenAI Responses agent loop entry for Clauxen Web.
 *
 * Stream → strict function calls → function outputs → repeat via OpenAI Responses.
 * UI events go to ClauxenSseStream → src/components/agent/* (DOM).
 */

export {
  runAutonomousAgent,
  runAutonomousAgent as runAgent,
  generateChatTitle,
  type AgentStreamOptions,
} from "@/server/agent-core/runtime/query-loop";
