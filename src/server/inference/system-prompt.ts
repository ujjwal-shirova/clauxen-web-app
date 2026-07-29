/**
 * System prompts for Clauxen inference.
 *
 * The agent base prompt lives in src/prompts/clauxen.md and is loaded through
 * buildModelSystemPrompt(). Keep the static content first for prompt caching.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import type { ConfiguredModelId } from "@/lib/model-config";

// ─── Paths ───────────────────────────────────────────────────────────────────

function resolveModelPromptsDir(): string {
  const fromModule = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "prompts",
  );
  const fromCwd = path.join(process.cwd(), "src", "prompts");
  for (const candidate of [fromModule, fromCwd]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return fromCwd;
}

export const MODEL_SYSTEM_PROMPTS_DIR = resolveModelPromptsDir();

const AGENT_PROMPT_FILENAME = "clauxen.md";

// ─── Exa web search ──────────────────────────────────────────────────────────

export const EXA_SEARCH_SYSTEM_PROMPT = [
  "You are a high-quality, safety-aware web research system.",
  "Prefer primary sources, official sources, reputable journalism, and recently published pages when the query is current.",
  "Avoid duplicate URLs, low-quality SEO pages, and unsupported claims.",
  "Return transparent source metadata and relevant excerpts; do not fabricate citations.",
].join(" ");

// ─── Title-only generation ───────────────────────────────────────────────────

export function buildTitleGenerationSystemPrompt(): string {
  return [
    "You write short conversation titles for a chat sidebar.",
    "Output ONLY the title (3-6 words). No quotes or labels.",
  ].join("\n");
}

// ─── Agent base prompt (src/prompts/clauxen.md) ─────────────────────────────

let cachedAgentPrompt: string | null = null;

function stripSystemPrefix(raw: string): string {
  return raw.replace(/^\s*System:\s*\n+/i, "").trimStart();
}

/** Load the agent system prompt. Memoized for the process lifetime. */
export function getModelSystemPrompt(
   
  _model: ConfiguredModelId | string = "clauxen",
): string {
  if (cachedAgentPrompt) return cachedAgentPrompt;
  const fullPath = path.join(MODEL_SYSTEM_PROMPTS_DIR, AGENT_PROMPT_FILENAME);
  const raw = fs.readFileSync(fullPath, "utf8");
  cachedAgentPrompt = stripSystemPrefix(raw);
  return cachedAgentPrompt;
}

/**
 * Primary system prompt for chat/agent inference.
 * Order: agent .md base → optional dynamic suffix (title instruction, etc.).
 * Keeps the large static prefix stable for prompt caching.
 */
export function buildModelSystemPrompt(opts: {
  model?: ConfiguredModelId | string;
  append?: string;
} = {}): string {
  const parts: string[] = [getModelSystemPrompt(opts.model ?? "clauxen")];

  if (opts.append?.trim()) {
    parts.push(opts.append.trim());
  }

  return parts.join("\n\n");
}

// ─── Project-scoped assembly (instructions + RAG) ──────────────────────────

export function assembleSystemPrompt(
  projectInstructions: string | null | undefined,
  ragContext: string,
): string | undefined {
  const parts: string[] = [];

  if (projectInstructions?.trim()) {
    parts.push(projectInstructions.trim());
  }

  if (ragContext.trim()) {
    if (parts.length) parts.push("");
    parts.push(ragContext.trim());
    parts.push("");
    parts.push(
      "Always ground your answers in the provided project knowledge. If information is not found in the provided context, say so clearly.",
    );
  }

  return parts.length ? parts.join("\n") : undefined;
}
