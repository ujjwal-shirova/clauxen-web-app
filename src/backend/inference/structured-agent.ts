import { getNovitaClient, DEFAULT_MODEL } from "@/backend/inference/novita-client";
import { extractPromptCacheStats } from "@/backend/inference/prompt-cache";
import { extractUpstreamError } from "@/backend/inference/novita";
import { env } from "@/backend/config/env";

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

export const expenseTrackingSchema = () =>
  ({
    type: "object",
    properties: {
      expenses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            amount: { type: "number" },
            date: { type: "string" },
            category: { type: "string" },
          },
          required: ["description", "amount"],
        },
      },
      total: { type: "number" },
    },
    required: ["expenses", "total"],
  }) as const;

export async function structuredAgentCompletion(opts: {
  schema: Record<string, unknown>;
  schemaName: string;
  prompt: string;
  systemPrompt?: string;
  model?: string;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}) {
  const client = getNovitaClient();
  const response = await client.chat.completions.create(
    {
      model: opts.model ?? env.defaultModel,
      messages: [
        ...(opts.systemPrompt
          ? [{ role: "system" as const, content: opts.systemPrompt }]
          : []),
        { role: "user" as const, content: opts.prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: opts.schemaName,
          schema: opts.schema,
          strict: true,
        },
      },
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.3,
      stream: false,
    },
    { signal: opts.signal },
  );

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty structured response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse structured JSON: ${content.slice(0, 200)}`);
  }

  return {
    data: parsed,
    usage: extractPromptCacheStats(response.usage),
    model: opts.model ?? DEFAULT_MODEL,
  };
}

export async function structuredExpenseExtraction(prompt: string) {
  return structuredAgentCompletion({
    schemaName: "expense_tracking_schema",
    schema: expenseTrackingSchema(),
    systemPrompt:
      "You are an expense tracking assistant. Extract expense information from the user's input and format it according to the provided schema.",
    prompt,
    model: "mistralai/mistral-7b-instruct",
    temperature: 0.8,
    maxTokens: 1024,
  });
}
