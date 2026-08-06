import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions/completions";
import {
  requireOpenAIApiKey,
  optionalOpenAIBaseUrl,
} from "@/server/config/env";

export type OpenAIToolDefinition = ChatCompletionTool;
export type OpenAIInputItem = ChatCompletionMessageParam;
/**
 * Legacy transcript shape. Chat Completions does not expose Responses output
 * items, so callers use `replay` to continue a tool round instead.
 */
export type OpenAIOutputItem = never;
export type OpenAIMessageContent = ChatCompletionMessageParam["content"];

export type OpenAIStreamPart =
  | { type: "reasoning-delta"; delta: string }
  | { type: "text-delta"; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | {
      type: "tool-call-delta";
      toolCallId: string;
      argumentsDelta: string;
    }
  | {
      type: "tool-call-end";
      toolCallId: string;
      toolName: string;
      arguments: string;
    }
  | {
      type: "finish";
      reason: string;
      output: OpenAIOutputItem[];
      replay: OpenAIInputItem[];
    }
  | { type: "error"; error: string }
  | { type: "abort" };

export type OpenAICompletionOptions = {
  model: string;
  instructions?: string;
  input: OpenAIInputItem[];
  tools?: OpenAIToolDefinition[];
  maxOutputTokens?: number;
  signal?: AbortSignal;
  reasoningEffort?: "low" | "medium" | "high";
};

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: requireOpenAIApiKey(),
    ...(optionalOpenAIBaseUrl()
      ? { baseURL: optionalOpenAIBaseUrl() }
      : {}),
  });
}

/**
 * Stream one OpenAI-compatible Chat Completions round.
 *
 * Novita's OpenAI-compatible API supports Chat Completions but not the newer
 * Responses API. This intentionally uses the broadly supported protocol for
 * both Novita and official OpenAI-compatible providers.
 */
export async function* streamOpenAIResponse(
  options: OpenAICompletionOptions,
): AsyncGenerator<OpenAIStreamPart> {
  const client = createClient();
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let text = "";

  try {
    const stream = await client.chat.completions.create(
      {
        model: options.model,
        messages: [
          ...(options.instructions
            ? [{ role: "system" as const, content: options.instructions }]
            : []),
          ...options.input,
        ],
        tools: options.tools,
        tool_choice: options.tools?.length ? "auto" : undefined,
        parallel_tool_calls: false,
        max_tokens: options.maxOutputTokens ?? 8192,
        stream: true,
      },
      { signal: options.signal },
    );

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        yield { type: "abort" };
        return;
      }
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;
      const reasoning = (delta as { reasoning_content?: unknown }).reasoning_content;
      if (typeof reasoning === "string" && reasoning) {
        yield { type: "reasoning-delta", delta: reasoning };
      }
      if (typeof delta.content === "string" && delta.content) {
        text += delta.content;
        yield { type: "text-delta", delta: delta.content };
      }
      for (const toolCall of delta.tool_calls ?? []) {
        const index = toolCall.index;
        let entry = toolCalls.get(index);
        if (!entry) {
          entry = {
            id: toolCall.id ?? `call_${index}`,
            name: toolCall.function?.name ?? "",
            arguments: "",
          };
          toolCalls.set(index, entry);
          if (entry.name) {
            yield { type: "tool-call-start", toolCallId: entry.id, toolName: entry.name };
          }
        }
        if (toolCall.function?.name && !entry.name) {
          entry.name = toolCall.function.name;
          yield { type: "tool-call-start", toolCallId: entry.id, toolName: entry.name };
        }
        if (toolCall.function?.arguments) {
          entry.arguments += toolCall.function.arguments;
          yield { type: "tool-call-delta", toolCallId: entry.id, argumentsDelta: toolCall.function.arguments };
        }
      }
    }
    for (const entry of toolCalls.values()) {
      if (entry.name) {
        yield { type: "tool-call-end", toolCallId: entry.id, toolName: entry.name, arguments: entry.arguments || "{}" };
      }
    }
    const replay: OpenAIInputItem[] = [
      {
        role: "assistant",
        content: text || null,
        ...(toolCalls.size
          ? { tool_calls: [...toolCalls.values()].map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.arguments || "{}" } })) }
          : {}),
      },
    ];
    yield {
      type: "finish",
      reason: "stop",
      output: [],
      replay,
    };
  } catch (error) {
    if (options.signal?.aborted) {
      yield { type: "abort" };
      return;
    }
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function toOpenAITools(
  tools: Array<{
    name: string;
    description?: string | null;
    parameters: Record<string, unknown>;
  }>,
): OpenAIToolDefinition[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? tool.name,
      parameters: strictToolSchema(tool.parameters ?? {}),
      strict: true,
    },
  }));
}

/**
 * OpenAI strict function schemas require every object property to be listed in
 * `required` and disallow extra keys. Existing optional fields become nullable,
 * preserving their optional semantics for tool executors.
 */
function strictToolSchema(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const normalize = (node: unknown): unknown => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const source = { ...(node as Record<string, unknown>) };
    delete source.default;
    delete source.examples;
    delete source.$schema;
    delete source.$defs;
    delete source.definitions;
    const type = source.type;

    if (type === "object" || source.properties) {
      const rawProperties =
        source.properties && typeof source.properties === "object"
          ? (source.properties as Record<string, unknown>)
          : {};
      const originallyRequired = new Set(
        Array.isArray(source.required)
          ? source.required.filter((item): item is string => typeof item === "string")
          : [],
      );
      const properties: Record<string, unknown> = {};
      for (const [key, property] of Object.entries(rawProperties)) {
        const normalized = normalize(property);
        properties[key] = originallyRequired.has(key)
          ? normalized
          : {
              anyOf: [normalized, { type: "null" }],
            };
      }
      const rest = { ...source };
      delete rest.required;
      delete rest.additionalProperties;
      return {
        ...rest,
        type: "object",
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      };
    }

    if (type === "array") {
      return {
        ...source,
        items: normalize(source.items ?? {}),
      };
    }

    if (Array.isArray(source.anyOf)) {
      return { ...source, anyOf: source.anyOf.map(normalize) };
    }
    if (Array.isArray(source.oneOf)) {
      return { ...source, oneOf: source.oneOf.map(normalize) };
    }
    return source;
  };

  const schema = normalize({
    type: "object",
    ...value,
  }) as Record<string, unknown>;
  return schema;
}
