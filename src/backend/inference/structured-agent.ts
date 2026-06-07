import { env, requireNovitaApiKey } from "@/backend/config/env";
import { extractUpstreamError } from "@/backend/inference/novita";

export const defaultStructuredSchema = () =>
  ({
    type: "object",
    properties: {
      summary: { type: "string" },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            status: { type: "string" },
          },
          required: ["title", "status"],
        },
      },
      category: {
        type: "string",
        enum: ["coding", "writing", "analysis", "research", "general"],
      },
    },
    required: ["summary", "actions"],
  }) as const;

export async function structuredAgentCompletion(opts: {
  schema: Record<string, unknown>;
  schemaName: string;
  prompt: string;
  systemPrompt?: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  const apiKey = requireNovitaApiKey();
  const response = await fetch(env.novitaChatUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model ?? env.defaultModel,
      messages: [
        ...(opts.systemPrompt
          ? [{ role: "system", content: opts.systemPrompt }]
          : []),
        { role: "user", content: opts.prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: opts.schemaName,
          schema: opts.schema,
          strict: true,
        },
      },
      max_tokens: 1024,
      temperature: 0.3,
      enable_thinking: false,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractUpstreamError(body, "Structured completion failed."));
  }

  const content = (
    body as { choices?: Array<{ message?: { content?: string } }> }
  )?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty structured response");

  return JSON.parse(content) as unknown;
}
