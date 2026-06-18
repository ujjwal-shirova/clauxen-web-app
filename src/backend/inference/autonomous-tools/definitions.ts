import type { FunctionTool } from "openai/resources/responses/responses";

/**
 * Tool definitions are the only steering mechanism in thinking mode — no system prompt.
 */
export const autonomousAgentTools: FunctionTool[] = [
  {
    type: "function",
    name: "read_skill",
    description:
      "MANDATORY before execute_code or file_write whenever you are about to produce a file or run code. Reads a skill document encoding sandbox-specific facts — installed libraries, rendering quirks, PDF/PPTX pipelines — that training knowledge cannot reliably supply. Call this first to learn the environment; do not skip even for formats you think you already know. If no matching skill exists, the result lists available skills.",
    parameters: {
      type: "object",
      properties: {
        skill_id: {
          type: "string",
          description:
            "Skill identifier, e.g. pdf, playwright, canvas, or a partial name match.",
        },
      },
      required: ["skill_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "web_search",
    description:
      "Searches the live web for current information about the world — not the user's private data. Use when the answer could depend on something that changed after your training data, when you do not recognize a named entity, product, or event (unfamiliar proper nouns are near-certain signals of post-training entities), or when you need to verify an uncertain fact. Do not use for stable timeless facts you know with confidence. Scale calls to difficulty: one fact → one query; comparisons → several distinct narrowing queries; never repeat the same phrase. Do not brute-force dozens of calls — stop when the next search would be redundant or every sub-question is covered.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A short, specific search query, 1 to 8 words, phrased the way a person would type it into a search engine.",
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
    description:
      "Fetches and returns the text content of a specific URL you already know. Use after web_search when you need the full text of a particular page (documentation, GitHub readme, official API reference) rather than search snippets alone. Prefer web_search first to discover URLs; use this to read a known URL deeply.",
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
    description:
      "Runs Python in an isolated sandbox and returns stdout, stderr, and any exception. Use for calculations, data transforms, or verifying logic by running it — not for silent reasoning. Call read_skill first when the task involves file formats or environment-specific libraries. Print anything you need to see in the result.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "Complete runnable Python source. Print outputs you want returned.",
        },
      },
      required: ["code"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "file_read",
    description:
      "Reads a text file from this conversation's scoped workspace. Use to inspect files created earlier in the thread or uploaded by the user.",
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
    description:
      "Writes a text file to this conversation's scoped workspace. Use when the user wants a downloadable artifact. Call read_skill first when producing PDF, PPTX, charts, or other format-specific output.",
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
    description:
      "Pauses and asks the user a clarifying question instead of guessing. Use only when proceeding without an answer would force a material assumption that changes the outcome.",
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "One specific question for the user.",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
    strict: true,
  },
];
