import type { ThinkingType } from "@/backend/inference/novita";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
  type InferenceProviderKind,
  parseChatModelId,
  resolveModelRuntime,
  modelCatalogEnvFromProcess,
} from "@/lib/model-catalog";

export type InferenceRouteInput = {
  chatModel?: ChatModelId | string;
  thinkingType?: ThinkingType;
  webSearchEnabled?: boolean;
  agentMode?: boolean;
  structuredOutput?: boolean;
  toolCalling?: boolean;
};

export type InferenceRoute = {
  provider: InferenceProviderKind;
  modelSlug: string;
  baseUrl: string;
  reason: string;
};

/** Resolve provider, base URL, and upstream model for a product model selection. */
export function resolveInferenceRoute(
  input: InferenceRouteInput = {},
): InferenceRoute {
  const runtime = resolveModelRuntime(
    input.chatModel ?? DEFAULT_CHAT_MODEL_ID,
    modelCatalogEnvFromProcess(),
  );

  const thinkingEnabled = input.thinkingType === "enabled";
  const webEnabled = input.webSearchEnabled === true;
  const toolCallingEnabled =
    input.agentMode === true || input.toolCalling === true;
  const catalogEnv = modelCatalogEnvFromProcess();
  const modelSlug = thinkingEnabled
    ? catalogEnv.thinkingModel
    : runtime.modelSlug;

  return {
    provider: runtime.provider,
    modelSlug,
    baseUrl: runtime.baseUrl,
    reason: thinkingEnabled
      ? `thinking agent via ${modelSlug} @ ${runtime.baseUrl}`
      : webEnabled
        ? `${runtime.id} web-capable chat via ${runtime.provider} @ ${runtime.baseUrl}`
        : toolCallingEnabled
          ? `${runtime.id} tool-capable chat via ${runtime.provider} @ ${runtime.baseUrl}`
          : `${runtime.id} chat path via ${runtime.provider} @ ${runtime.baseUrl}`,
  };
}

export function parseChatModelIdFromRequest(
  value?: string | null,
): ChatModelId {
  return parseChatModelId(value);
}
