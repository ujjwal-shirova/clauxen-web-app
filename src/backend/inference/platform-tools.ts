export type PlatformToolInputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type PlatformTool = {
  name: string;
  description: string;
  input_schema: PlatformToolInputSchema;
};

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
  | "create_desktop_sandbox_recipe"
  | "ask_user_input_v0"
  | "fetch_sports_data"
  | "image_search"
  | "message_compose_v1"
  | "places_map_display_v0"
  | "recipe_display_v0"
  | "recommend_clauxen_apps"
  | "search_mcp_registry"
  | "suggest_connectors"
  // Additional tools described in the full model system prompts (homor/helios/virgil .md)
  | "conversation_search"
  | "end_conversation"
  | "tool_search"
  | "recent_chats"
  | "memory_user_edits"
  | "visualize:read_me"
  | "visualize:show_widget";

function tool(
  name: PlatformToolName,
  description: string,
  input_schema: PlatformToolInputSchema,
): PlatformTool {
  return { name, description, input_schema };
}

export function platformTools(): PlatformTool[] {
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
      [
        "Search the web (Exa, type=auto) with highlights. Ground your answer ONLY in the returned results.",
        "OUTPUT FORMAT (MANDATORY for any web_search answer):",
        "- Write clear, well-structured prose or lists.",
        "- Immediately after each sentence or bullet that uses information from a result, add an inline citation using this EXACT markdown syntax:",
        "  ([Exact Title or Domain][N])",
        "  Example: The government announced a major milestone ([The Times of India][1]).",
        "- N must be the 1-based index of the result in the order they were provided (first result = 1).",
        "- At the VERY END of your complete response, append ONLY the reference definitions (no extra headings):",
        "  [1]: https://full-url \"Title or short description\"",
        "  [2]: https://... \"...\"",
        "- Do NOT output any 'Sources' list, pills, or UI elements yourself — the client will turn your [N] citations into nice inline chips for display.",
        "- The raw text you produce (with inline citations + trailing references) is what the user will copy when they press the copy button, so make it complete and self-contained markdown.",
        "- Use the exact titles and URLs from the tool results. Never invent URLs or titles.",
      ].join(" "),
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
      "Search places via Google Places (when API key configured). Supports multiple queries in a single call.",
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
    tool(
      "ask_user_input_v0",
      "Present tappable options to gather user preferences before providing advice. This tool displays interactive buttons that users can tap to answer, which is much easier than typing on mobile. Always include a brief conversational message before presenting options. Keep it to one question where possible — three is a ceiling — with 2-4 short, mutually exclusive options. After calling this, your turn is done — the user's selection comes as their next message.",
      {
        type: "object",
        properties: {
          questions: {
            type: "array",
            description: "1-3 questions to ask the user",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              required: ["question", "options"],
              properties: {
                question: {
                  type: "string",
                  description: "The question text shown to user",
                },
                options: {
                  type: "array",
                  description: "2-4 options with short labels",
                  minItems: 2,
                  maxItems: 4,
                  items: { type: "string", description: "Short label" },
                },
                type: {
                  type: "string",
                  enum: ["single_select", "multi_select", "rank_priorities"],
                  default: "single_select",
                  description: "Question type: 'single_select' for choosing 1 option, 'multi_select' for choosing 1 or more options, and 'rank_priorities' for drag-and-drop ranking",
                },
              },
            },
          },
        },
        required: ["questions"],
      },
    ),
    tool(
      "fetch_sports_data",
      "Use this tool whenever you need to fetch current, upcoming or recent sports data including scores, standings/rankings, and detailed game stats for the provided sports. If a user is interested in the score of an event or game, and the game is live or recent in last 24hr, fetch both the game scores and game_stats in the same turn (game stats are not available for golf and nascar). For broad queries (e.g. 'latest NBA results'), fetch both scores and standings. Do NOT rely on your memory or assume which players are in a game; fetch both scores, stats, details using the tool. PREFER using this tool over web search for data, scores, stats about recent and upcoming games.",
      {
        type: "object",
        properties: {
          data_type: {
            type: "string",
            enum: ["scores", "standings", "game_stats"],
            description: "Type of data to fetch. scores returns recent results, live games, and upcoming games with win probabilities. game_stats requires a game_id from scores results for detailed box score, play-by-play, and player stats.",
          },
          game_id: {
            type: "string",
            description: "SportRadar game/match ID (required for game_stats). Get this from the id field in scores results.",
          },
          league: {
            type: "string",
            enum: [
              "nfl", "nba", "nhl", "mlb", "wnba", "ncaafb", "ncaamb", "ncaawb",
              "epl", "la_liga", "serie_a", "bundesliga", "ligue_1", "mls",
              "champions_league", "tennis", "golf", "nascar", "cricket", "mma"
            ],
            description: "The sports league to query",
          },
          team: {
            type: "string",
            description: "Optional team name to filter scores by a specific team",
          },
        },
        required: ["data_type", "league"],
      },
    ),
    tool(
      "image_search",
      "Default to using image search for any query where visuals would enhance the user's understanding; skip when the deliverable is primarily textual e.g. for pure text tasks, code, technical support.",
      {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant images",
          },
          max_results: {
            type: "integer",
            description: "Maximum number of images to return (default: 3, minimum: 3)",
            minimum: 3,
            maximum: 5,
          },
        },
        required: ["query"],
      },
    ),
    tool(
      "message_compose_v1",
      "Draft a message (email, Slack, or text) with goal-oriented approaches based on what the user is trying to accomplish. Analyze the situation type and identify competing goals or relationship stakes. MULTIPLE APPROACHES (if high-stakes, ambiguous, or competing goals): Start with a scenario summary. Generate 2-3 strategies that lead to different outcomes—not just tones. Label each clearly. SINGLE MESSAGE (if transactional, one clear approach, or user just needs wording help): Just draft it.",
      {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["email", "textMessage", "other"],
            description: "The type of message. 'email' shows a subject field and 'Open in Mail' button. 'textMessage' shows 'Open in Messages' button. 'other' shows 'Copy' button for platforms like LinkedIn, Slack, etc.",
          },
          summary_title: {
            type: "string",
            description: "A brief title that summarizes the message (shown in the share sheet)",
          },
          variants: {
            type: "array",
            minItems: 1,
            description: "Message variants representing different strategic approaches",
            items: {
              type: "object",
              required: ["label", "body"],
              properties: {
                label: {
                  type: "string",
                  description: "2-4 word goal-oriented label. E.g., 'Apologetic', 'Suggest alternative', 'Hold firm'",
                },
                body: { type: "string", description: "The message content" },
                subject: {
                  type: "string",
                  description: "Email subject line (only used when kind is 'email')",
                },
              },
            },
          },
        },
        required: ["kind", "variants"],
      },
    ),
    tool(
      "places_map_display_v0",
      "Display locations on a map with your recommendations and insider tips. WORKFLOW: 1. Use places_search tool first to find places and get their place_id. 2. Call this tool with place_id references - the backend will fetch full details. CRITICAL: Copy place_id values EXACTLY from places_search tool results.",
      {
        type: "object",
        properties: {
          title: { type: "string", description: "Title for the map or itinerary" },
          narrative: { type: "string", description: "Tour guide intro for the trip" },
          mode: {
            type: "string",
            enum: ["markers", "itinerary"],
            description: "Display mode. Auto-inferred: markers if locations, itinerary if days.",
          },
          show_route: {
            type: "boolean",
            description: "Show route between stops. Default: true for itinerary, false for markers.",
          },
          travel_mode: {
            type: "string",
            enum: ["driving", "walking", "transit", "bicycling"],
            description: "Travel mode for directions (default: driving)",
          },
          locations: {
            type: "array",
            maxItems: 50,
            items: {
              type: "object",
              required: ["latitude", "longitude", "name"],
              properties: {
                name: { type: "string" },
                latitude: { type: "number" },
                longitude: { type: "number" },
                place_id: { type: "string" },
                notes: { type: "string" },
                address: { type: "string" },
                arrival_time: { type: "string" },
                duration_minutes: { type: "integer" },
              },
            },
            description: "Simple marker display - list of locations without day structure",
          },
          days: {
            type: "array",
            maxItems: 30,
            items: {
              type: "object",
              required: ["day_number", "locations"],
              properties: {
                day_number: { type: "integer" },
                title: { type: "string" },
                narrative: { type: "string" },
                locations: {
                  type: "array",
                  minItems: 1,
                  maxItems: 50,
                  items: {
                    type: "object",
                    required: ["latitude", "longitude", "name"],
                    properties: {
                      name: { type: "string" },
                      latitude: { type: "number" },
                      longitude: { type: "number" },
                      place_id: { type: "string" },
                      notes: { type: "string" },
                      address: { type: "string" },
                      arrival_time: { type: "string" },
                      duration_minutes: { type: "integer" },
                    },
                  },
                },
              },
            },
            description: "Itinerary with day structure for multi-day trips",
          },
        },
      },
    ),
    tool(
      "recipe_display_v0",
      "Display an interactive recipe with adjustable servings. Use when the user asks for a recipe, cooking instructions, or food preparation guide. The widget allows users to scale all ingredient amounts proportionally by adjusting the servings control.",
      {
        type: "object",
        required: ["ingredients", "steps", "title"],
        properties: {
          title: { type: "string", description: "The name of the recipe" },
          description: { type: "string", description: "A brief description or tagline for the recipe" },
          base_servings: { type: "integer", description: "The number of servings this recipe makes at base amounts (default: 4)" },
          notes: { type: "string", description: "Optional tips, variations, or additional notes about the recipe" },
          ingredients: {
            type: "array",
            description: "List of ingredients with amounts",
            items: {
              type: "object",
              required: ["amount", "id", "name"],
              properties: {
                id: { type: "string", description: "4 character unique identifier number for this ingredient (e.g., '0001', '0002')" },
                name: { type: "string", description: "Display name of the ingredient" },
                amount: { type: "number", description: "The quantity for base_servings" },
                unit: {
                  type: "string",
                  enum: ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "fl_oz", "oz", "lb", "pinch"],
                },
              },
            },
          },
          steps: {
            type: "array",
            description: "Cooking instructions. Reference ingredients using {ingredient_id} syntax.",
            items: {
              type: "object",
              required: ["content", "id", "title"],
              properties: {
                id: { type: "string" },
                title: { type: "string", description: "Short summary of the step" },
                content: { type: "string", description: "The full instruction text" },
                timer_seconds: { type: "integer" },
              },
            },
          },
        },
      },
    ),
    tool(
      "recommend_clauxen_apps",
      "Recommend 1-3 Clauxen apps or extensions (Code, Cowork, browser, Excel, PowerPoint, Design, etc.) when they would be a better fit than plain chat.",
      {
        type: "object",
        properties: {
          app_ids: {
            type: "array",
            description: "IDs of Claude apps or extensions to recommend.",
            items: {
              type: "string",
              enum: [
                "desktop", "ios", "android", "claude_code_terminal",
                "claude_code_vscode", "claude_code_jetbrains",
                "claude_code_slack", "excel", "powerpoint", "chrome"
              ],
            },
          },
        },
        required: ["app_ids"],
      },
    ),
    tool(
      "search_mcp_registry",
      "Search for available connectors in the MCP registry. Call this when connecting to a new MCP might help resolve the user query — whether or not they name a specific product.",
      {
        type: "object",
        properties: {
          keywords: { type: "array", items: { type: "string" } },
        },
        required: ["keywords"],
      },
    ),
    tool(
      "suggest_connectors",
      "Present connector options to the user. Each option renders with a Connect or Use button, plus a 'None of these' option. Do NOT call this tool unless you have already called the search_mcp_registry tool or are handling a tool auth/credential error.",
      {
        type: "object",
        properties: {
          uuids: { type: "array", items: { type: "string" } },
        },
        required: ["uuids"],
      },
    ),

    // Tools described in the model system prompts (loaded from .md). Register so model can invoke via standard tool calling.
    tool(
      "conversation_search",
      "Search the user's past conversations for relevant context, facts, or preferences. Use proactively for personalization or references to prior discussions.",
      {
        type: "object",
        properties: {
          query: { type: "string", description: "Keywords or short query describing what to recall" },
          max_results: { type: "integer", description: "Max past items to return" },
        },
        required: ["query"],
      },
    ),
    tool(
      "recent_chats",
      "List or peek at the user's most recent chats for context.",
      {
        type: "object",
        properties: {
          max_results: { type: "integer" },
        },
      },
    ),
    tool(
      "end_conversation",
      "End the current conversation (last resort for abusive cases after warnings).",
      {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
        required: [],
      },
    ),
    tool(
      "tool_search",
      "Discover additional tools/capabilities (including third-party via MCP). Call before claiming a feature is unavailable.",
      {
        type: "object",
        properties: {
          query: { type: "string", description: "What capability or integration to look for" },
        },
        required: ["query"],
      },
    ),
    tool(
      "memory_user_edits",
      "Record or update persistent user memory/preferences from the conversation.",
      {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["key", "value"],
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
