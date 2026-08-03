/**
 * Custom Novita OpenAI-compatible streaming client.
 *
 * Replaces @ai-sdk/openai + Vercel AI SDK entirely. Talks directly to
 * Novita's /v1/chat/completions endpoint, parses SSE chunks manually,
 * and yields typed streaming parts.
 *
 * Key design decisions for maximum autonomy + low latency:
 *  - Uses undici with HTTP/1.1 forced (HTTP/2 to Novita stalls).
 *  - No SDK abstraction layer — every token goes straight to the caller.
 *  - Tool calls are parsed from the stream into structured objects.
 *  - Reasoning content (DeepSeek/Kimi style) is extracted via `reasoning_content`.
 */

import { Agent, fetch as undiciFetch } from "undici";
import {
  requireProviderApiKey,
  requireProviderBaseUrl,
} from "@/server/config/env";

const novitaDispatcher = new Agent({
  allowH2: false,
  connect: { timeout: 30_000 },
  headersTimeout: 120_000,
  bodyTimeout: 0,
  keepAliveTimeout: 4_000,
  keepAliveMaxTimeout: 30_000,
  pipelining: 0,
});

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: ChatRole;
  content: string | null;
  /** Tool calls produced by the assistant. */
  tool_calls?: ChatToolCall[];
  /** Tool call id this message responds to (role: "tool"). */
  tool_call_id?: string;
  /** Reasoning content (DeepSeek/Kimi interleaved thinking). */
  reasoning_content?: string;
  /** Name of the tool (role: "tool"). */
  name?: string;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type NovitaReasoningEffort = "low" | "medium" | "high" | "max";

export type ChatCompletionOptions = {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  parallel_tool_calls?: boolean;
  /** Explicit thinking toggle — always set so models do not think by default. */
  enable_thinking?: boolean;
  reasoning_effort?: NovitaReasoningEffort;
  text_verbosity?: "low" | "medium" | "high";
  signal?: AbortSignal;
};

/** A single parsed chunk from the SSE stream. */
export type StreamPart =
  | { type: "text-delta"; delta: string }
  | { type: "reasoning-delta"; delta: string }
  | {
      type: "tool-call-start";
      toolCallId: string;
      toolName: string;
    }
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
  | { type: "finish"; reason: string }
  | { type: "error"; error: string }
  | { type: "abort" };

type RawChoice = {
  delta?: {
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: Array<{
      index: number;
      id?: string;
      type?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  finish_reason?: string | null;
};

type RawChunk = {
  choices?: RawChoice[];
  error?: { message?: string } | string;
};

function normalizeBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl?.trim() || requireProviderBaseUrl()).replace(/\/+$/, "");
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : String(error);
  return (
    name === "AbortError" ||
    name === "ResponseAborted" ||
    /aborted/i.test(message)
  );
}

/**
 * Stream a chat completion from Novita. Yields StreamPart objects as they arrive.
 * This is the lowest-latency path — tokens are forwarded to the caller immediately.
 */
export async function* streamChatCompletion(
  options: ChatCompletionOptions,
): AsyncGenerator<StreamPart> {
  const apiKey = requireProviderApiKey();
  const baseUrl = normalizeBaseUrl();
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: true,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.max_tokens ?? 8192,
    enable_thinking: options.enable_thinking ?? false,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }
  if (options.parallel_tool_calls !== undefined) {
    body.parallel_tool_calls = options.parallel_tool_calls;
  }
  if (options.reasoning_effort) {
    body.reasoning_effort = options.reasoning_effort;
  }
  if (options.text_verbosity) {
    body.text_verbosity = options.text_verbosity;
  }

  let response: Response;
  try {
    response = await novitaFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error, options.signal)) {
      yield { type: "abort" };
      return;
    }
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    yield {
      type: "error",
      error: `Novita API error ${response.status}: ${text || response.statusText}`,
    };
    return;
  }

  if (!response.body) {
    yield { type: "error", error: "No response body from Novita." };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let aborted = options.signal?.aborted === true;
  const toolCallState = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  // Cancel the upstream body immediately on stop so the provider stops
  // generating tokens — releaseLock alone leaves the HTTP stream open.
  const cancelUpstream = () => {
    aborted = true;
    void reader.cancel().catch(() => undefined);
  };
  if (options.signal) {
    if (options.signal.aborted) {
      cancelUpstream();
    } else {
      options.signal.addEventListener("abort", cancelUpstream, { once: true });
    }
  }

  try {
    if (aborted) {
      yield { type: "abort" };
      return;
    }

    while (true) {
      if (aborted || options.signal?.aborted) {
        yield { type: "abort" };
        break;
      }

      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (error) {
        if (aborted || isAbortError(error, options.signal)) {
          yield { type: "abort" };
          break;
        }
        yield {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        break;
      }

      const { done, value } = readResult;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          continue;
        }

        let chunk: RawChunk;
        try {
          chunk = JSON.parse(data) as RawChunk;
        } catch {
          continue;
        }

        if (chunk.error) {
          const msg =
            typeof chunk.error === "string"
              ? chunk.error
              : chunk.error.message ?? "Unknown error";
          yield { type: "error", error: msg };
          continue;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (delta?.reasoning_content) {
          yield { type: "reasoning-delta", delta: delta.reasoning_content };
        }

        if (delta?.content) {
          yield { type: "text-delta", delta: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallState.get(tc.index);

            if (!existing) {
              const id = tc.id ?? `call_${tc.index}`;
              const name = tc.function?.name ?? "";
              const args = tc.function?.arguments ?? "";
              toolCallState.set(tc.index, { id, name, arguments: args });

              if (name) {
                yield { type: "tool-call-start", toolCallId: id, toolName: name };
              }
              if (args) {
                yield {
                  type: "tool-call-delta",
                  toolCallId: id,
                  argumentsDelta: args,
                };
              }
            } else {
              const argsDelta = tc.function?.arguments ?? "";
              if (argsDelta) {
                existing.arguments += argsDelta;
                yield {
                  type: "tool-call-delta",
                  toolCallId: existing.id,
                  argumentsDelta: argsDelta,
                };
              }
              if (tc.id && existing.id.startsWith("call_") && existing.id === `call_${tc.index}`) {
                existing.id = tc.id;
              }
              if (tc.function?.name && !existing.name) {
                existing.name = tc.function.name;
                yield {
                  type: "tool-call-start",
                  toolCallId: existing.id,
                  toolName: existing.name,
                };
              }
            }
          }
        }

        if (choice.finish_reason) {
          for (const [, tc] of toolCallState) {
            if (tc.name && tc.arguments) {
              yield {
                type: "tool-call-end",
                toolCallId: tc.id,
                toolName: tc.name,
                arguments: tc.arguments,
              };
            }
          }
          toolCallState.clear();
          yield { type: "finish", reason: choice.finish_reason };
        }
      }
    }
  } finally {
    if (options.signal) {
      options.signal.removeEventListener("abort", cancelUpstream);
    }
    if (aborted || options.signal?.aborted) {
      try {
        await reader.cancel();
      } catch {
        // already cancelled / locked
      }
    }
    try {
      reader.releaseLock();
    } catch {
      // already released after cancel
    }
  }
}

/** Non-streaming completion for short tasks like title generation. */
export async function completeChat(
  options: Omit<ChatCompletionOptions, "stream">,
): Promise<string> {
  const apiKey = requireProviderApiKey();
  const baseUrl = normalizeBaseUrl();
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: false,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 256,
    enable_thinking: options.enable_thinking ?? false,
  };

  if (options.reasoning_effort) {
    body.reasoning_effort = options.reasoning_effort;
  }

  const response = await novitaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Novita API error ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

function novitaFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  return undiciFetch(
    input as Parameters<typeof undiciFetch>[0],
    {
      ...init,
      cache: "no-store",
      dispatcher: novitaDispatcher,
    } as Parameters<typeof undiciFetch>[1],
  ) as unknown as Promise<Response>;
}
