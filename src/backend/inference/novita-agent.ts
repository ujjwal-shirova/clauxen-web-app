import { env, requireNovitaApiKey } from "@/backend/config/env";
import {
  buildAssistantAgentMessage,
  buildStructuredOutputTool,
  convertAgentMessagesToAnthropic,
  extractAnthropicToolUses,
  type AgentToolUse,
} from "@/backend/inference/anthropic-adapter";
import {
  getAnthropicClient,
  AVAILABLE_MODELS,
} from "@/backend/inference/anthropic-client";
import { extractUpstreamError } from "@/backend/inference/novita";
import {
  platformTools,
  type PlatformToolName,
} from "@/backend/inference/platform-tools";
import { executePlatformTool } from "@/backend/inference/tool-executor";
import { defaultStructuredSchema } from "@/backend/inference/structured-agent";
import {
  browserUseRecipe,
  desktopRecipe,
} from "@/backend/inference/novita-agent-recipes";

export type { PlatformToolName };

type AgentRole = "system" | "user" | "assistant" | "tool";

type TextPart = { type: "text"; text: string };
type ImagePart = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
type VideoPart = { type: "video_url"; video_url: { url: string } };
type AudioPart = {
  type: "input_audio";
  input_audio: { data: string; format: string };
};

export type AgentContentPart = TextPart | ImagePart | VideoPart | AudioPart;

export type { AgentToolUse };

export type AgentMessage = {
  role: AgentRole;
  content: string | AgentContentPart[] | null;
  /** Anthropic tool_result.tool_use_id */
  tool_use_id?: string;
  /** @deprecated Use tool_use_id */
  tool_call_id?: string;
  tool_uses?: AgentToolUse[];
  thinking?: string | null;
};

/** @deprecated Use PlatformToolName */
export type AgentToolName = PlatformToolName;

export type AgentChatRequest = {
  messages?: AgentMessage[];
  model?: string;
  mode?: "chat" | "structured";
  enableThinking?: boolean;
  enableTools?: boolean;
  allowedTools?: PlatformToolName[];
  webSearchMode?: boolean;
  reasoningSplit?: boolean;
  responseSchema?: Record<string, unknown>;
  conversationId?: string;
};

const MAX_MESSAGES = 32;
const MAX_TEXT_CHARS = 80_000;
const MAX_IMAGE_DATA_URL_CHARS = 1_600_000;
const MAX_VIDEO_URL_CHARS = 2_048;
const MAX_TOOL_ROUNDS = 8;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isAllowedImageUrl(value: string) {
  return (
    isHttpUrl(value) || /^data:image\/(png|jpe?g|webp);base64,/i.test(value)
  );
}

function isAllowedVideoUrl(value: string) {
  return isHttpUrl(value);
}

function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT_CHARS) : "";
}

function sanitizePart(part: unknown): AgentContentPart | null {
  if (!part || typeof part !== "object") return null;
  const candidate = part as {
    type?: unknown;
    text?: unknown;
    image_url?: unknown;
    video_url?: unknown;
    input_audio?: unknown;
  };

  if (candidate.type === "text") {
    const text = sanitizeText(candidate.text);
    return text ? { type: "text", text } : null;
  }

  if (candidate.type === "image_url") {
    const image = candidate.image_url as { url?: unknown; detail?: unknown };
    const url = typeof image?.url === "string" ? image.url : "";
    if (!isAllowedImageUrl(url) || url.length > MAX_IMAGE_DATA_URL_CHARS) {
      return null;
    }
    const detail =
      image.detail === "low" ||
      image.detail === "high" ||
      image.detail === "auto"
        ? image.detail
        : "auto";
    return { type: "image_url", image_url: { url, detail } };
  }

  if (candidate.type === "video_url") {
    const video = candidate.video_url as { url?: unknown };
    const url = typeof video?.url === "string" ? video.url : "";
    if (!isAllowedVideoUrl(url) || url.length > MAX_VIDEO_URL_CHARS) {
      return null;
    }
    return { type: "video_url", video_url: { url } };
  }

  if (candidate.type === "input_audio") {
    const audio = candidate.input_audio as { data?: unknown; format?: unknown };
    const data = typeof audio?.data === "string" ? audio.data : "";
    const format = typeof audio?.format === "string" ? audio.format : "";
    if (!data || !/^(wav|mp3|webm|m4a)$/i.test(format)) return null;
    return { type: "input_audio", input_audio: { data, format } };
  }

  return null;
}

export function sanitizeAgentMessages(input: unknown): AgentMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .slice(-MAX_MESSAGES)
    .map((message): AgentMessage | null => {
      if (!message || typeof message !== "object") return null;
      const candidate = message as { role?: unknown; content?: unknown };
      if (
        candidate.role !== "system" &&
        candidate.role !== "user" &&
        candidate.role !== "assistant" &&
        candidate.role !== "tool"
      ) {
        return null;
      }

      if (typeof candidate.content === "string") {
        return {
          role: candidate.role,
          content: sanitizeText(candidate.content),
        };
      }

      if (Array.isArray(candidate.content)) {
        const parts = candidate.content.map(sanitizePart).filter(Boolean);
        return parts.length > 0
          ? { role: candidate.role, content: parts as AgentContentPart[] }
          : null;
      }

      return candidate.role === "assistant"
        ? { role: candidate.role, content: null }
        : null;
    })
    .filter(Boolean) as AgentMessage[];
}

export function novitaAgentTools() {
  return platformTools();
}

export async function executeAgentTool(
  name: PlatformToolName | string,
  rawArgs?: string,
  context?: { userId?: string; conversationId?: string },
) {
  return executePlatformTool(name, rawArgs, () => {}, context);
}

export { browserUseRecipe, desktopRecipe };

function resolveStructuredTools(request: AgentChatRequest) {
  if (request.mode !== "structured") return undefined;
  return [
    buildStructuredOutputTool(
      "clauxen_agent_result",
      (request.responseSchema ?? defaultStructuredSchema()) as Record<
        string,
        unknown
      >,
    ),
  ];
}

async function createAnthropicMessage(
  conversation: AgentMessage[],
  request: AgentChatRequest,
  signal?: AbortSignal,
) {
  const client = getAnthropicClient();
  const model = request.model?.trim() || env.defaultModel;
  const platformToolList =
    request.enableTools === false ? undefined : platformTools();
  const structuredTools = resolveStructuredTools(request);
  const tools = structuredTools ?? platformToolList;
  const { system, messages } = convertAgentMessagesToAnthropic(conversation);

  return client.messages.create(
    {
      model,
      max_tokens: 8192,
      temperature: 0.6,
      system,
      messages,
      tools: tools?.length ? tools : undefined,
      tool_choice:
        structuredTools?.length === 1
          ? { type: "tool", name: "clauxen_agent_result" }
          : tools?.length
            ? { type: "auto" }
            : undefined,
      thinking: request.enableThinking
        ? { type: "enabled", budget_tokens: 8192 }
        : undefined,
    },
    { signal },
  );
}

export async function runNovitaAgentChat(
  request: AgentChatRequest,
  signal?: AbortSignal,
  context?: { userId?: string; conversationId?: string },
) {
  const messages = sanitizeAgentMessages(request.messages);
  if (messages.length === 0) {
    throw new Error("At least one valid message is required.");
  }

  const conversation: AgentMessage[] = [
    {
      role: "system",
      content:
        "You are Clauxen Agent on Novita AI. Use sandbox tools for coding and research tools for current data. Never provide abuse or evasion guidance.",
    },
    ...messages,
  ];
  const model = request.model?.trim() || env.defaultModel;

  let response = await createAnthropicMessage(conversation, request, signal);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const assistantMessage = buildAssistantAgentMessage(response.content);
    const toolUses = extractAnthropicToolUses(response.content);
    if (toolUses.length === 0) break;

    conversation.push(assistantMessage);
    for (const toolUse of toolUses) {
      const result = await executeAgentTool(
        toolUse.name,
        JSON.stringify(toolUse.input),
        context,
      );
      conversation.push({
        role: "tool",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    response = await createAnthropicMessage(conversation, request, signal);
  }

  const finalMessage = buildAssistantAgentMessage(response.content);
  return {
    message: finalMessage,
    usage: response.usage ?? null,
    model,
  };
}

function novitaHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
}

export async function listNovitaModels(signal?: AbortSignal) {
  if (!env.novitaModelsUrl) {
    return { data: AVAILABLE_MODELS.map((model) => ({ id: model.id })) };
  }

  const apiKey = requireNovitaApiKey();
  const response = await fetch(env.novitaModelsUrl, {
    headers: novitaHeaders(apiKey),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      extractUpstreamError(payload, "Could not list Novita models."),
    );
  }
  return payload;
}
