import type { FunctionTool } from "openai/resources/responses/responses";

/**
 * Autonomous agent tool definitions.
 *
 * These descriptions ARE the only steering for the thinking-agent path.
 * Each description answers three questions the model needs:
 *   1. WHEN to use this tool (decision signal)
 *   2. WHAT it does (capability)
 *   3. HOW to chain it with other tools (sequencing hints)
 *
 * Autonomy techniques applied here (no system prompt required):
 *   • "Use proactively when…" — makes the model self-initiate
 *   • "After using X, you may want Y" — chains tools naturally
 *   • "Do not use when…" — prevents wasted token rounds
 *   • "Emit a brief progress note before calling this" — drives the visible
 *     narration the user sees between tool calls (image reference in the ticket)
 *   • Capability framing ("observe…", "decide…") activates ReAct-style thinking
 */
export const autonomousAgentTools: FunctionTool[] = [
  {
    type: "function",
    name: "web_search",
    description: [
      "Search the live web (Exa, type=auto) for current, factual, or recent information. Results include titles, urls and highlights.",
      "USE PROACTIVELY when you need up-to-date or sourced information.",
      "CITATION FORMAT — in your FINAL answer after using results:",
      "• Cite inline as ([Title or Domain][N]) where N is the result's 1-based index field.",
      "• Never invent indexes beyond the returned results. Never append [N]: url reference lines.",
      "• Before calling, one short sentence of progress prose is enough; then call the tool; then write the cited final answer.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A short, specific search query (1–8 words). Use natural phrasing — the same words a person would type into a search engine.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "web_fetch",
    description: [
      "Fetch the full text of a specific URL you already know.",
      "USE when search snippets are insufficient and you need the complete page content — e.g. official documentation, a GitHub README, a full article, or an API reference.",
      "DO NOT use to guess URLs — use web_search first to find the right URL.",
      "SEQUENCING: typically follows web_search. After fetching, decide whether the information is sufficient or whether another search/fetch is needed.",
      "Before calling, tell the user you are reading the page in natural prose (e.g. 'Let me fetch the full Klaviyo benchmark report.'). After fetching, emit a brief note on what you found before the next step.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Fully qualified https URL to fetch.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "places_search",
    description: [
      "Search for places (businesses, landmarks, addresses) by name or description, from OpenStreetMap's free Nominatim search — no Google Maps, no paid key.",
      "USE for: finding a specific place's location, 'places near X', restaurant/landmark/address lookups.",
      "Returns name, resolved address, and coordinates for each match — no ratings/reviews/photos (that's a Google-specific feature this free source doesn't have); rely on web_search instead if the user wants reviews or opinions about a place.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for, e.g. 'coffee shops in Brooklyn' or 'Eiffel Tower'.",
        },
        max_results: {
          type: "integer",
          description: "Max results to return (default 5, max 10).",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "image_search",
    description: [
      "Search openly-licensed (Creative Commons / public domain) images by keyword, from Openverse — no Google, no paid key.",
      "USE when a visual would meaningfully help the answer (e.g. showing what something looks like) and the deliverable isn't purely textual.",
      "SKIP for pure text/code/technical-support tasks, or when you already have relevant images from another tool.",
      "Results are illustrative CC-licensed photos, not authoritative/branded/product photography — do not present them as official images of a specific person, product, or brand.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        max_results: {
          type: "integer",
          description: "Number of images to return (default 3, max 6).",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "weather_fetch",
    description: [
      "Get live current conditions plus an hourly and 7-day forecast for any location worldwide, from Open-Meteo — a free, keyless public weather API that aggregates official national weather models (NOAA GFS, ECMWF, DWD ICON, etc). No Google Maps, no paid key.",
      "USE for: weather in a specific place, 'should I bring an umbrella/jacket', outdoor-activity planning, 'what's it like in [city]' weather context.",
      "SKIP for: historical/climate questions, or weather mentioned with no location given.",
      "Give a location name and the tool geocodes it — ground your answer in the real numbers it returns rather than guessing.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        location_name: {
          type: "string",
          description: "Place name, e.g. 'San Francisco, CA' or 'Tokyo, Japan'.",
        },
        units: {
          type: "string",
          enum: ["metric", "imperial"],
          description:
            "Temperature/wind units. Use 'imperial' (°F, mph) for US locations or users, 'metric' (°C, km/h) otherwise, unless the user asks for a specific unit.",
        },
      },
      required: ["location_name", "units"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "bash_tool",
    description: [
      "Run a shell command in an isolated Linux sandbox (Ubuntu). USE for file/directory operations, installing packages, running builds or scripts, git, and anything a terminal command does more naturally than Python.",
      "PREFER execute_code instead when the task is really computation, data analysis, or generating a chart/file from Python — bash_tool is for shell-level operations.",
      "Before calling, say a short one-line description of what the command does — the UI shows this as the block's title while the command streams in.",
      "The sandbox persists across calls in this conversation, so installed packages and created files remain available for later bash_tool/execute_code calls.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description:
            "One short line describing what this command does (shown as the block title, e.g. 'Installing dependencies').",
        },
        command: {
          type: "string",
          description: "The bash command to run.",
        },
      },
      required: ["description", "command"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "execute_code",
    description: [
      "Run Python in an isolated sandbox and observe the output (stdout, stderr, errors).",
      "USE when you need to: perform calculations, transform or analyse data, verify logic by running it, generate charts or images, or produce any file output.",
      "ALWAYS call read_skill FIRST when the task involves file formats, charts, PDFs, or environment-specific libraries — the sandbox may have different packages than your training data.",
      "Print everything you want to observe; the return value is only what is printed.",
      "SEQUENCING: read_skill → execute_code → optionally create_file (auto-presents).",
      "Before calling, briefly describe what the code will do.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "Complete, runnable Python source. Print all outputs you need to observe.",
        },
      },
      required: ["code"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "read_skill",
    description: [
      "Read a skill document that encodes sandbox environment facts: installed libraries, file-format pipelines, rendering quirks.",
      "MANDATORY before execute_code or create_file when producing PDFs, PPTXs, charts, or any format where the environment specifics matter.",
      "Also call when you are unsure whether a library is available in the sandbox.",
      "If no matching skill exists the result lists available skills — use that to pick the closest one.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        skill_id: {
          type: "string",
          description:
            "Skill identifier or partial name (e.g. 'pdf', 'playwright', 'canvas').",
        },
      },
      required: ["skill_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "file_read",
    description: [
      "Read a text file from this conversation's workspace.",
      "USE to inspect files the user uploaded or files created in earlier tool calls.",
      "SEQUENCING: use before execute_code or create_file when you need to understand existing file content.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path within the conversation workspace.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "create_file",
    description: [
      "Create/write a single text file in this conversation's workspace.",
      "The file is automatically presented to the user as a downloadable/viewable card when writing finishes — do NOT call present_files.",
      "This is the ONLY file-creation tool — do not use bash, tags, or alternate write tools for the same deliverable.",
      "Parent directories are created automatically. Prefer a simple relative path like `outputs/short-story.md`.",
      "Do NOT retry the same file with a different tool if create_file succeeds. Only retry create_file once if it failed with a clear recoverable error.",
      "ALWAYS call read_skill first when producing PDFs, PPTXs, charts, or other format-specific output.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Relative path within the conversation workspace (e.g. outputs/report.md).",
        },
        content: {
          type: "string",
          description: "Full text content to write.",
        },
        description: {
          type: "string",
          description: "Short label shown in the work timeline (e.g. Creating a short story file).",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "present_files",
    description: [
      "DEPRECATED — do not call. create_file already presents files to the user automatically.",
      "If invoked, this is a no-op compatibility stub.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Ignored — create_file already presented these paths.",
        },
      },
      required: ["paths"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "ask_user_input_v0",
    description: [
      "Present an interactive step-by-step questionnaire card (with tappable options + 'Something else' field) so the user can answer quickly.",
      "AUTOMATICALLY USE this proactively for elicitation whenever you need the user's goals, constraints, style prefs, priorities, or tradeoffs before giving tailored advice or plans.",
      "Typical triggers: planning, recommendations, scoping, 'help me choose/decide', 'what are your preferences for X'.",
      "DO NOT use for pure factual lookup, when user already provided the info, or for direct opinion requests.",
      "Always say a short natural sentence first (e.g. 'To give the best plan, a couple quick questions:'), then call the tool.",
      "Emit 1-3 questions, each with 2-4 crisp options. The UI auto-advances and sends a clean summary back as the user's next message.",
      "After calling, STOP — wait for the user's selection to arrive.",
    ].join(" "),
    parameters: {
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
                description: "The question text shown to the user",
              },
              options: {
                type: "array",
                description: "2-4 short option labels",
                minItems: 2,
                maxItems: 4,
                items: { type: "string" },
              },
              type: {
                type: "string",
                enum: ["single_select", "multi_select", "rank_priorities"],
                default: "single_select",
              },
            },
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
    strict: true,
  },
];
