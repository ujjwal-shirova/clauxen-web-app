import OpenAI from "openai";
import type { Responses } from "openai/resources/responses/responses";
import { parse as parsePartialJson, Allow } from "partial-json";
import {
  requireOpenAIApiKey,
  optionalOpenAIBaseUrl,
} from "@/server/config/env";

export type OpenAIToolDefinition = Responses.FunctionTool;
export type OpenAIInputItem = Responses.ResponseInputItem;
export type OpenAIOutputItem = Responses.ResponseOutputItem;
export type OpenAIMessageContent =
  | string
  | Responses.ResponseInputMessageContentList;

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

const STRUCTURED_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: ["narration", "answer"],
      description:
        "Use narration while more tool work is needed; use answer for the final response.",
    },
    content: {
      type: "string",
      description:
        "Natural-language content shown to the user. Markdown is allowed.",
    },
  },
  required: ["kind", "content"],
} as const;

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: requireOpenAIApiKey(),
    ...(optionalOpenAIBaseUrl()
      ? { baseURL: optionalOpenAIBaseUrl() }
      : {}),
  });
}

function structuredContent(raw: string): string {
  if (!raw.trim()) return "";
  try {
    const value = JSON.parse(raw) as { content?: unknown };
    return typeof value.content === "string" ? value.content : "";
  } catch {
    try {
      const value = parsePartialJson(raw, Allow.ALL) as {
        content?: unknown;
      };
      return typeof value?.content === "string" ? value.content : "";
    } catch {
      return "";
    }
  }
}

/**
 * Stream one OpenAI Responses API round.
 *
 * The provider emits typed semantic events. Function calls use strict JSON
 * schemas; visible model output follows a strict response schema and only its
 * `content` field is forwarded to the app's SSE activity/answer protocol.
 */
export async function* streamOpenAIResponse(
  options: OpenAICompletionOptions,
): AsyncGenerator<OpenAIStreamPart> {
  const client = createClient();
  const toolByItemId = new Map<
    string,
    { callId: string; name: string; arguments: string }
  >();
  let rawStructured = "";
  let emittedContent = "";
  let completed: Responses.Response | null = null;

  try {
    const stream = client.responses.stream(
      {
        model: options.model,
        input: options.input,
        instructions: options.instructions,
        tools: options.tools,
        tool_choice: options.tools?.length ? "auto" : undefined,
        parallel_tool_calls: false,
        max_output_tokens: options.maxOutputTokens ?? 8192,
        ...(options.reasoningEffort
          ? {
              reasoning: {
                effort: options.reasoningEffort,
                summary: "auto",
              },
            }
          : {}),
        text: {
          format: {
            type: "json_schema",
            name: "agent_response",
            description:
              "Structured visible output for the Clauxen agent UI.",
            strict: true,
            schema: STRUCTURED_RESPONSE_SCHEMA,
          },
        },
        stream: true,
        store: false,
      },
      { signal: options.signal },
    );

    for await (const event of stream) {
      if (options.signal?.aborted) {
        yield { type: "abort" };
        return;
      }

      switch (event.type) {
        case "response.reasoning_summary_text.delta":
        case "response.reasoning_text.delta":
          yield { type: "reasoning-delta", delta: event.delta };
          break;

        case "response.output_text.delta": {
          rawStructured += event.delta;
          const content = structuredContent(rawStructured);
          if (content.startsWith(emittedContent)) {
            const delta = content.slice(emittedContent.length);
            if (delta) {
              emittedContent = content;
              yield { type: "text-delta", delta };
            }
          }
          break;
        }

        case "response.output_item.added": {
          if (event.item.type !== "function_call") break;
          const callId = event.item.call_id;
          toolByItemId.set(event.item.id ?? callId, {
            callId,
            name: event.item.name,
            arguments: event.item.arguments ?? "",
          });
          yield {
            type: "tool-call-start",
            toolCallId: callId,
            toolName: event.item.name,
          };
          break;
        }

        case "response.function_call_arguments.delta": {
          const entry = toolByItemId.get(event.item_id);
          if (!entry) break;
          entry.arguments += event.delta;
          yield {
            type: "tool-call-delta",
            toolCallId: entry.callId,
            argumentsDelta: event.delta,
          };
          break;
        }

        case "response.function_call_arguments.done": {
          const entry = toolByItemId.get(event.item_id);
          const callId = entry?.callId ?? event.item_id;
          const name = entry?.name ?? event.name;
          yield {
            type: "tool-call-end",
            toolCallId: callId,
            toolName: name,
            arguments: event.arguments || entry?.arguments || "{}",
          };
          break;
        }

        case "response.completed":
          completed = event.response;
          break;

        case "response.failed":
          yield {
            type: "error",
            error:
              event.response.error?.message ??
              "OpenAI response generation failed.",
          };
          return;

        case "error":
          yield {
            type: "error",
            error: event.message || "OpenAI streaming error.",
          };
          return;
      }
    }

    completed ??= await stream.finalResponse();
    const finalContent = structuredContent(completed.output_text);
    if (finalContent.startsWith(emittedContent)) {
      const delta = finalContent.slice(emittedContent.length);
      if (delta) yield { type: "text-delta", delta };
    }
    yield {
      type: "finish",
      reason: completed.status ?? "completed",
      output: completed.output,
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
    name: tool.name,
    description: tool.description ?? tool.name,
    parameters: strictToolSchema(tool.parameters ?? {}),
    strict: true,
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
