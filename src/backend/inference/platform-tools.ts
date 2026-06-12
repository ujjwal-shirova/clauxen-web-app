import type { AnthropicTool } from "@/backend/inference/anthropic-adapter";

/** Anthropic tool schemas for Clauxen Agent (OpenClaw-style). */
export type PlatformToolName =
  | "bash_tool"
  | "create_file"
  | "view"
  | "str_replace"
  | "present_files"
  | "web_search"
  | "web_fetch"
  | "weather_fetch"
  | "places_search"
  | "run_code_interpreter"
  | "get_current_time"
  | "summarize_attached_media"
  | "create_browser_sandbox_recipe"
  | "create_desktop_sandbox_recipe";

function tool(
  name: PlatformToolName,
  description: string,
  input_schema: AnthropicTool["input_schema"],
): AnthropicTool {
  return { name, description, input_schema };
}

export function platformTools(): AnthropicTool[] {
  return [
    tool(
      "bash_tool",
      "Run a bash command in the Novita Agent Sandbox (Ubuntu Linux). Use for code execution, package installs, and file manipulation.",
      {
        type: "object",
        properties: {
          command: { type: "string", description: "Bash command to run" },
          description: {
            type: "string",
            description: "Why this command runs",
          },
        },
        required: ["command", "description"],
      },
    ),
    tool(
      "create_file",
      "Create a new file in the sandbox. Appears as an artifact in the chat UI. Use str_replace for edits.",
      {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Why this file is created",
          },
          path: {
            type: "string",
            description: "Absolute path e.g. /home/agent/app.tsx",
          },
          file_text: { type: "string", description: "Full file content" },
        },
        required: ["description", "path", "file_text"],
      },
    ),
    tool(
      "view",
      "Read a file or list a directory in the sandbox filesystem.",
      {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path" },
          description: {
            type: "string",
            description: "Why viewing this path",
          },
          view_range: {
            type: "array",
            items: { type: "integer" },
            description: "Optional [start_line, end_line]",
          },
        },
        required: ["path", "description"],
      },
    ),
    tool(
      "str_replace",
      "Replace a unique string in a sandbox file. old_str must appear exactly once.",
      {
        type: "object",
        properties: {
          path: { type: "string" },
          old_str: { type: "string" },
          new_str: { type: "string" },
          description: { type: "string" },
        },
        required: ["path", "old_str", "new_str", "description"],
      },
    ),
    tool(
      "present_files",
      "Present sandbox files to the user in the artifacts panel.",
      {
        type: "object",
        properties: {
          filepaths: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["filepaths"],
      },
    ),
    tool(
      "web_search",
      "Search the web for current information via Exa (neural search with highlights).",
      {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    ),
    tool(
      "web_fetch",
      "Fetch and read a specific URL as text.",
      {
        type: "object",
        properties: {
          url: { type: "string" },
        },
        required: ["url"],
      },
    ),
    tool(
      "weather_fetch",
      "Fetch weather and forecast for a location.",
      {
        type: "object",
        properties: {
          location_name: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
        required: ["location_name"],
      },
    ),
    tool(
      "places_search",
      "Search places via Google Places (when API key configured).",
      {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                query: { type: "string" },
                max_results: { type: "integer" },
              },
              required: ["query"],
            },
          },
        },
        required: ["queries"],
      },
    ),
    tool(
      "run_code_interpreter",
      "Run Python/JS/TS in the isolated sandbox code interpreter.",
      {
        type: "object",
        properties: {
          language: {
            type: "string",
            enum: ["python", "javascript", "typescript"],
          },
          code: { type: "string" },
        },
        required: ["language", "code"],
      },
    ),
    tool(
      "get_current_time",
      "Return current server time and timezone.",
      { type: "object", properties: {} },
    ),
    tool(
      "summarize_attached_media",
      "Summarize media metadata attached to the request.",
      {
        type: "object",
        properties: {
          media_count: { type: "number" },
          media_types: { type: "array", items: { type: "string" } },
        },
        required: ["media_count", "media_types"],
      },
    ),
    tool(
      "create_browser_sandbox_recipe",
      "Generate a BrowserUse Python recipe for Novita sandbox.",
      {
        type: "object",
        properties: {
          task: { type: "string" },
          model: { type: "string" },
        },
        required: ["task"],
      },
    ),
    tool(
      "create_desktop_sandbox_recipe",
      "Generate an E2B Desktop Python recipe for Novita sandbox.",
      {
        type: "object",
        properties: {
          view_only: { type: "boolean" },
        },
        required: ["view_only"],
      },
    ),
  ];
}

export function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    md: "markdown",
    html: "html",
    css: "css",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    sql: "sql",
  };
  return map[ext ?? ""] || "text";
}
