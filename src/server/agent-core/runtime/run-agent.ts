/**
 * Claude Code–style agent loop entry for Clauxen Web.
 *
 * Stream → tools → tool_result → repeat, via Provider Messages API only.
 * UI events go to ClauxenSseStream → src/components/agent/* (DOM).
 */

export {
  runAutonomousAgent,
  runAutonomousAgent as runAgent,
  type AgentStreamOptions,
} from "@/server/inference/agent-engine";
