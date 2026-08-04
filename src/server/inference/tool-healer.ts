/**
 * Self-Healing Tool Wrapper Layer ("Immune System").
 *
 * When the LLM outputs malformed tool arguments (wrong types, arrays where
 * strings are expected, stringified numbers, etc.), standard agents either
 * crash or waste tokens asking the LLM to fix it.
 *
 * Instead, we deterministically mutate the arguments locally until the Zod
 * schema passes. No extra LLM round-trips. The agent becomes crash-proof.
 */

import { z } from "zod";

export type ToolExecutionContext = {
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  toolCallId: string;
  /** Model id that produced the current tool call (for agent-trace attribution). */
  modelId?: string;
  onProgress?: (data: Record<string, unknown>) => void;
};

export type ToolExecutionResult = {
  output: unknown;
  pauseForUser?: boolean;
  clarificationQuestion?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Promise<ToolExecutionResult>;
};

export type ToolCallArgs = Record<string, unknown>;

/**
 * Attempt to heal malformed arguments to match a Zod schema.
 * Returns the healed args, or null if healing is impossible.
 */
export function healToolArgs(
  raw: unknown,
  schema: z.ZodTypeAny,
): ToolCallArgs | null {
  if (raw == null) return {};

  let args: ToolCallArgs;
  if (typeof raw === "string") {
    try {
      args = JSON.parse(raw) as ToolCallArgs;
    } catch {
      // Maybe it's a partial JSON — try to extract key fields
      args = extractPartialJson(raw);
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    args = raw as ToolCallArgs;
  } else {
    args = {};
  }

  // First try: validate as-is
  const result = schema.safeParse(args);
  if (result.success) return result.data as ToolCallArgs;

  // Second try: apply deterministic healers based on common LLM errors
  const healed = applyHeuristics(args, result.error);
  const healedResult = schema.safeParse(healed);
  if (healedResult.success) return healedResult.data as ToolCallArgs;

  // Third try: coerce types field by field using schema shape
  const coerced = coerceToSchema(args, schema);
  const coercedResult = schema.safeParse(coerced);
  if (coercedResult.success) return coercedResult.data as ToolCallArgs;

  return null;
}

/** Common LLM argument errors and their deterministic fixes. */
function applyHeuristics(
  args: ToolCallArgs,
  _error: z.ZodError,
): ToolCallArgs {
  const healed: ToolCallArgs = { ...args };

  for (const [key, value] of Object.entries(healed)) {
    if (typeof value === "string") {
      // "50" → 50, "true" → true, "null" → null
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        healed[key] = parseFloat(value);
      } else if (value === "true") {
        healed[key] = true;
      } else if (value === "false") {
        healed[key] = false;
      } else if (value === "null") {
        delete healed[key];
      }
    }

    // Array where a string is expected — extract first element
    if (Array.isArray(value) && value.length === 1) {
      healed[key] = value[0];
    }

    // Object with a single "value" key — unwrap
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as object).length === 1 &&
      "value" in (value as object)
    ) {
      healed[key] = (value as { value: unknown }).value;
    }
  }

  return healed;
}

/** Coerce values to match Zod primitive types field by field. */
function coerceToSchema(
  args: ToolCallArgs,
  schema: z.ZodTypeAny,
): ToolCallArgs {
  if (!(schema instanceof z.ZodObject)) return args;
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  const coerced: ToolCallArgs = { ...args };

  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (!(key in coerced)) continue;
    const value = coerced[key];

    if (fieldSchema instanceof z.ZodString && typeof value !== "string") {
      coerced[key] = String(value);
    } else if (
      fieldSchema instanceof z.ZodNumber &&
      typeof value !== "number"
    ) {
      const n = Number(value);
      if (!Number.isNaN(n)) coerced[key] = n;
    } else if (
      fieldSchema instanceof z.ZodBoolean &&
      typeof value !== "boolean"
    ) {
      coerced[key] = Boolean(value);
    }
  }

  return coerced;
}

/** Extract partial JSON from malformed strings (e.g. missing closing brace). */
function extractPartialJson(raw: string): ToolCallArgs {
  const result: ToolCallArgs = {};

  // Extract "key": "value" pairs
  const stringMatch = raw.matchAll(/"(\w+)"\s*:\s*"([^"]*)"/g);
  for (const m of stringMatch) {
    result[m[1]] = m[2];
  }

  // Extract "key": number
  const numMatch = raw.matchAll(/"(\w+)"\s*:\s*(\d+(?:\.\d+)?)/g);
  for (const m of numMatch) {
    if (!(m[1] in result)) {
      result[m[1]] = parseFloat(m[2]);
    }
  }

  return result;
}

/**
 * Execute a tool with self-healing argument validation.
 * If the args are malformed, we heal them deterministically instead of
 * asking the LLM to fix them — saves a full round-trip.
 */
export async function executeToolSafely(
  tool: ToolDefinition,
  rawArgs: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const healed = healToolArgs(rawArgs, tool.inputSchema);

  if (healed === null) {
    return {
      output: {
        error: `Arguments for ${tool.name} could not be validated. Please check the parameter types and try again.`,
      },
    };
  }

  try {
    return await tool.execute(healed, context);
  } catch (error) {
    return {
      output: {
        error:
          error instanceof Error
            ? error.message
            : `Tool ${tool.name} failed unexpectedly`,
      },
    };
  }
}
