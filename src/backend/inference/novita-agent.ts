import { env, requireNovitaApiKey } from "@/backend/config/env";
import { extractUpstreamError } from "@/backend/inference/novita";
import { platformTools, type PlatformToolName } from "@/backend/inference/platform-tools";
import { executePlatformTool } from "@/backend/inference/tool-executor";
import { defaultStructuredSchema } from "@/backend/inference/structured-agent";
import { browserUseRecipe, desktopRecipe } from "@/backend/inference/novita-agent-recipes";

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

export type AgentMessage = {
  role: AgentRole;
  content: string | AgentContentPart[] | null;
  tool_call_id?: string;
  tool_calls?: unknown;
  reasoning_content?: string | null;
  reasoning_details?: unknown;
};

/** @deprecated Use PlatformToolName */
export type AgentToolName = PlatformToolName;

export type AgentChatRequest = {
  messages?: AgentMessage[];
  model?: string;
  mode?: "chat" | "structured";
  enableThinking?: boolean;
  enableTools?: boolean;
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

function buildResponseFormat(request: AgentChatRequest) {
  if (request.mode !== "structured") return undefined;
  return {
    type: "json_schema",
    json_schema: {
      name: "clauxen_agent_result",
      strict: true,
      schema: request.responseSchema ?? defaultStructuredSchema(),
    },
  };
}

function novitaHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function createChatCompletion(
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const apiKey = requireNovitaApiKey();
  const upstream = await fetch(env.novitaChatUrl, {
    method: "POST",
    headers: novitaHeaders(apiKey),
    signal,
    body: JSON.stringify(body),
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw new Error(
      extractUpstreamError(payload, "Novita agent request failed."),
    );
  }
  return payload as {
    choices?: Array<{
      finish_reason?: string;
      message?: AgentMessage & {
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments?: string };
        }>;
      };
    }>;
    usage?: unknown;
  };
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
  const tools = request.enableTools === false ? undefined : platformTools();
  const model = request.model?.trim() || env.defaultModel;

  let response = await createChatCompletion(
    {
      model,
      messages: conversation,
      stream: false,
      max_tokens: 8192,
      temperature: 0.6,
      top_p: 0.95,
      tools,
      tool_choice: tools ? "auto" : undefined,
      response_format: buildResponseFormat(request),
      enable_thinking: Boolean(request.enableThinking),
      separate_reasoning: Boolean(request.enableThinking),
      reasoning_split: Boolean(
        request.reasoningSplit ?? request.enableThinking,
      ),
    },
    signal,
  );

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const message = response.choices?.[0]?.message;
    const toolCalls = message?.tool_calls ?? [];
    if (!message || toolCalls.length === 0) break;

    conversation.push(message);
    for (const toolCall of toolCalls as Array<{
      id: string;
      function: { name: string; arguments?: string };
    }>) {
      const result = await executeAgentTool(
        toolCall.function.name,
        toolCall.function.arguments,
        context,
      );
      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    response = await createChatCompletion(
      {
        model,
        messages: conversation,
        stream: false,
        max_tokens: 8192,
        temperature: 0.6,
        top_p: 0.95,
        tools,
        tool_choice: tools ? "auto" : undefined,
        response_format: buildResponseFormat(request),
        enable_thinking: Boolean(request.enableThinking),
        separate_reasoning: Boolean(request.enableThinking),
        reasoning_split: Boolean(
          request.reasoningSplit ?? request.enableThinking,
        ),
      },
      signal,
    );
  }

  const finalMessage = response.choices?.[0]?.message;
  return {
    message: finalMessage ?? { role: "assistant", content: "" },
    usage: response.usage ?? null,
    model,
  };
}

export async function listNovitaModels(signal?: AbortSignal) {
  const apiKey = requireNovitaApiKey();
  const response = await fetch("https://api.novita.ai/openai/v1/models", {
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
