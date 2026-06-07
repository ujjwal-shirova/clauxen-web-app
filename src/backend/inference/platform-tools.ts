/** OpenAI-compatible tool schemas for Clauxen Agent (OpenClaw-style). */
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

export function platformTools() {
  return [
    {
      type: "function" as const,
      function: {
        name: "bash_tool",
        description:
          "Run a bash command in the Novita Agent Sandbox (Ubuntu Linux). Use for code execution, package installs, and file manipulation.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "Bash command to run" },
            description: { type: "string", description: "Why this command runs" },
          },
          required: ["command", "description"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_file",
        description:
          "Create a new file in the sandbox. Appears as an artifact in the chat UI. Use str_replace for edits.",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string", description: "Why this file is created" },
            path: { type: "string", description: "Absolute path e.g. /home/agent/app.tsx" },
            file_text: { type: "string", description: "Full file content" },
          },
          required: ["description", "path", "file_text"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "view",
        description: "Read a file or list a directory in the sandbox filesystem.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute path" },
            description: { type: "string", description: "Why viewing this path" },
            view_range: {
              type: "array",
              items: { type: "integer" },
              description: "Optional [start_line, end_line]",
            },
          },
          required: ["path", "description"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "str_replace",
        description:
          "Replace a unique string in a sandbox file. old_str must appear exactly once.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            old_str: { type: "string" },
            new_str: { type: "string" },
            description: { type: "string" },
          },
          required: ["path", "old_str", "new_str", "description"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "present_files",
        description: "Present sandbox files to the user in the artifacts panel.",
        parameters: {
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
      },
    },
    {
      type: "function" as const,
      function: {
        name: "web_search",
        description: "Search the web for current information.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "web_fetch",
        description: "Fetch and read a specific URL as text.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "weather_fetch",
        description: "Fetch weather and forecast for a location.",
        parameters: {
          type: "object",
          properties: {
            location_name: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
          },
          required: ["location_name"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "places_search",
        description: "Search places via Google Places (when API key configured).",
        parameters: {
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
      },
    },
    {
      type: "function" as const,
      function: {
        name: "run_code_interpreter",
        description: "Run Python/JS/TS in the isolated sandbox code interpreter.",
        parameters: {
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
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_current_time",
        description: "Return current server time and timezone.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "summarize_attached_media",
        description: "Summarize media metadata attached to the request.",
        parameters: {
          type: "object",
          properties: {
            media_count: { type: "number" },
            media_types: { type: "array", items: { type: "string" } },
          },
          required: ["media_count", "media_types"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_browser_sandbox_recipe",
        description: "Generate a BrowserUse Python recipe for Novita sandbox.",
        parameters: {
          type: "object",
          properties: {
            task: { type: "string" },
            model: { type: "string" },
          },
          required: ["task"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_desktop_sandbox_recipe",
        description: "Generate an E2B Desktop Python recipe for Novita sandbox.",
        parameters: {
          type: "object",
          properties: {
            view_only: { type: "boolean" },
          },
          required: ["view_only"],
        },
      },
    },
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
