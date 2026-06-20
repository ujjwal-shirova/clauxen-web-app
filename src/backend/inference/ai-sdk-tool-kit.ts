import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { autonomousAgentTools } from "@/backend/inference/autonomous-tools/definitions";
import { executeAutonomousTool } from "@/backend/inference/autonomous-tools/executor";
import {
  executePlatformTool,
  type ToolEventSender,
} from "@/backend/inference/tool-executor";
import type { PlatformToolName } from "@/backend/inference/platform-tools";

export type AiSdkToolContext = {
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
};

function mapToolEventsToBridge(send: ToolEventSender) {
  return send;
}

function toolErrorOutput(error: unknown) {
  return JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  });
}

function platformTool(
  name: PlatformToolName,
  description: string,
  inputSchema: z.ZodTypeAny,
  send: ToolEventSender,
  context: AiSdkToolContext,
) {
  return tool({
    description,
    inputSchema,
    execute: async (input, { toolCallId }) => {
      try {
        return await executePlatformTool(name, JSON.stringify(input), send, {
          ...context,
          toolCallId,
        });
      } catch (error) {
        return toolErrorOutput(error);
      }
    },
  });
}

export function buildWebAiSdkTools(
  send: ToolEventSender,
  context: AiSdkToolContext,
): ToolSet {
  const bridge = mapToolEventsToBridge(send);
  return {
    web_search: platformTool(
      "web_search",
      [
        "Search the live web for current information.",
        "SEQUENCING: First output one short sentence that you are about to search (e.g. 'Got it — let me search the web for that.'), then call this tool.",
        "After results return, output one short transition sentence before writing the cited final answer (e.g. 'Good — I found solid sources. Writing this up now.').",
      ].join(" "),
      z.object({
        query: z.string().describe("Short specific search query."),
      }),
      bridge,
      context,
    ),
    web_fetch: platformTool(
      "web_fetch",
      "Fetch full text from a known URL after search when snippets are insufficient.",
      z.object({
        url: z.string().describe("Fully qualified https URL."),
      }),
      bridge,
      context,
    ),
  };
}

const autonomousZodByName: Record<string, z.ZodTypeAny> = {
  read_skill: z.object({
    skill_id: z.string().describe("Skill identifier, e.g. pdf or playwright."),
  }),
  web_search: z.object({
    query: z.string().describe("Short specific search query."),
  }),
  web_fetch: z.object({
    url: z.string().describe("Fully qualified https URL."),
  }),
  execute_code: z.object({
    code: z.string().describe("Complete runnable Python source."),
  }),
  file_read: z.object({
    path: z.string().describe("Relative path in the conversation workspace."),
  }),
  file_write: z.object({
    path: z.string().describe("Relative path in the conversation workspace."),
    content: z.string().describe("Full text content to write."),
  }),
  ask_user_clarification: z.object({
    question: z.string().describe("One specific clarifying question."),
  }),
};

/** Full autonomous toolkit — tool descriptions are the only steering (no system prompt). */
export function buildThinkingAiSdkTools(
  send: ToolEventSender,
  context: AiSdkToolContext,
): ToolSet {
  const bridge = mapToolEventsToBridge(send);
  const tools: ToolSet = {};

  for (const definition of autonomousAgentTools) {
    const name = definition.name;
    const inputSchema = autonomousZodByName[name];
    if (!inputSchema) continue;

    tools[name] = tool({
      description: definition.description ?? name,
      inputSchema,
      execute: async (input, { toolCallId }) => {
        try {
          const outcome = await executeAutonomousTool(
            name,
            input as Record<string, unknown>,
            {
              conversationId: context.conversationId ?? "chat",
              userId: context.userId,
              userCountryCode: context.userCountryCode,
              toolCallId,
              onToolProgress: (data) => {
                bridge("tool_progress", {
                  tool_call_id: toolCallId,
                  ...data,
                });
              },
            },
          );

          if (outcome.pauseForUser) {
            bridge("clarification", {
              question: outcome.clarificationQuestion,
            });
          }

          return typeof outcome.output === "string"
            ? outcome.output
            : JSON.stringify(outcome.output ?? {});
        } catch (error) {
          return toolErrorOutput(error);
        }
      },
    });
  }

  return tools;
}

export function createToolEventSender(
  emit: (event: string, data: Record<string, unknown>) => void,
): ToolEventSender {
  return (event, data) => {
    emit(event, (data ?? {}) as Record<string, unknown>);
  };
}
