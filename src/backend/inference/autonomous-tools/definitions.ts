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
      "CITATION FORMAT — MANDATORY in your FINAL answer text after using web_search results:",
      "• After any claim taken from results, append an inline citation in exactly this form: ([Title or Domain][N])",
      "• N = 1-based position of that result in the list returned by the tool (first result is 1).",
      "• At the absolute end of the whole response, output the reference block with NO other text after it:",
      "  [1]: https://url \"Title\"",
      "  [2]: https://...",
      "• This makes the copied markdown self-contained and pretty. The UI will also turn the citations into inline source chips at the right places.",
      "• Never fabricate citations or urls. Use the exact data from the tool response.",
      "Before calling, briefly tell the user what you are searching for. After results, you may emit a short note, then produce the final cited answer.",
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
    name: "execute_code",
    description: [
      "Run Python in an isolated sandbox and observe the output (stdout, stderr, errors).",
      "USE when you need to: perform calculations, transform or analyse data, verify logic by running it, generate charts or images, or produce any file output.",
      "ALWAYS call read_skill FIRST when the task involves file formats, charts, PDFs, or environment-specific libraries — the sandbox may have different packages than your training data.",
      "Print everything you want to observe; the return value is only what is printed.",
      "SEQUENCING: read_skill → execute_code → optionally file_write.",
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
      "MANDATORY before execute_code or file_write when producing PDFs, PPTXs, charts, or any format where the environment specifics matter.",
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
      "SEQUENCING: use before execute_code or file_write when you need to understand existing file content.",
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
    name: "file_write",
    description: [
      "Write a text file to this conversation's workspace so the user can download it.",
      "USE when the user wants a deliverable artifact (report, code file, CSV, etc.).",
      "ALWAYS call read_skill first when producing PDFs, PPTXs, charts, or other format-specific output.",
      "SEQUENCING: read_skill → execute_code (if needed) → file_write.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path within the conversation workspace.",
        },
        content: {
          type: "string",
          description: "Full text content to write.",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "ask_user_clarification",
    description: [
      "Pause the task and ask the user ONE specific question.",
      "USE ONLY when proceeding without an answer would force a material assumption that changes the outcome.",
      "DO NOT use for questions you can reasonably infer or research yourself.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "One specific, direct question for the user.",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
    strict: true,
  },
];
