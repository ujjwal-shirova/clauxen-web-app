import { env } from "@/backend/config/env";
import { resolveModelRuntime, modelCatalogEnvFromProcess } from "@/lib/model-catalog";

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const autonomousAgentConfig = {
  /** Runaway-loop safety rail only — never shown to the model. */
  maxIterations: Number(optional("AUTONOMOUS_AGENT_MAX_ITERATIONS", "25")),
  /** Scoped file workspace root per conversation. */
  fileWorkspaceRoot: optional(
    "AUTONOMOUS_AGENT_FILE_ROOT",
    ".autonomous-agent-files",
  ),
  /** WebSocket port for standalone server. */
  wsPort: Number(optional("AUTONOMOUS_AGENT_WS_PORT", "8081")),
  /** Default model when none passed from chat routing. */
  defaultModel: env.heliosModel,
  defaultBaseUrl: env.novitaOpenAiBaseUrl,
};

export function resolveAutonomousAgentModel(chatModel?: string): {
  model: string;
  baseUrl: string;
} {
  if (!chatModel) {
    return {
      model: autonomousAgentConfig.defaultModel,
      baseUrl: autonomousAgentConfig.defaultBaseUrl,
    };
  }
  const runtime = resolveModelRuntime(chatModel, modelCatalogEnvFromProcess());
  return {
    model: runtime.modelSlug,
    baseUrl: runtime.baseUrl,
  };
}
