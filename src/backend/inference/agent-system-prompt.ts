/**
 * Central system-prompt registry for all inference paths.
 *
 * Philosophy:
 * ─────────────────────────────────────────────────────────
 * Strong language models (DeepSeek-R3, Kimi-K2, etc.) with interleaved
 * reasoning (thinking tokens) are best directed through:
 *   1.  Well-designed TOOL DESCRIPTIONS  (when / why / what each does)
 *   2.  A very short, stable identity anchor
 *   3.  Nothing else in the system prompt
 *
 * Verbose system prompts that repeat tool behaviour, list rules, or describe
 * every possible scenario actively HURT performance:
 *   • They push the real conversation prefix off the prompt cache
 *   • They increase time-to-first-token on reasoning models
 *   • They override the model's own (better) judgment
 *
 * All per-file constants ("CLAUXEN_SYSTEM", "AGENT_SYSTEM_BASE", …) have been
 * replaced with calls to the functions below.
 */

import { buildInlineChatTitleSystemInstruction } from "@/lib/chat-title";

// ─── Identity ───────────────────────────────────────────────────────────────

/**
 * The one stable identity line shared by every path.
 * Kept minimal on purpose: the model's capability + tool descriptions do the rest.
 */
export const CLAUXEN_IDENTITY = "You are Clauxen, a helpful AI assistant.";

// ─── Chat (plain, no tools) ──────────────────────────────────────────────────

/**
 * System prompt for non-agent, non-thinking chat paths.
 * No tool guidance — there are no tools.
 */
export function buildChatSystemPrompt(opts: {
  generateChatTitle?: boolean;
} = {}): string {
  const parts: string[] = [CLAUXEN_IDENTITY];
  if (opts.generateChatTitle) {
    parts.push(buildInlineChatTitleSystemInstruction());
  }
  return parts.join("\n\n");
}

// ─── Tool-capable / agent paths ──────────────────────────────────────────────

/**
 * Minimal system prompt for tool-capable (non-thinking) agent paths.
 *
 * Autonomy is achieved through tool descriptions, NOT through verbose rules
 * here.  The only thing we add is the identity anchor + an optional title hook.
 */
export function buildAgentSystemPrompt(opts: {
  generateChatTitle?: boolean;
} = {}): string {
  const parts: string[] = [CLAUXEN_IDENTITY];
  if (opts.generateChatTitle) {
    parts.push(buildInlineChatTitleSystemInstruction());
  }
  return parts.join("\n\n");
}

// ─── Thinking / interleaved-reasoning agent path ────────────────────────────

/**
 * System prompt for the thinking-agent loop (DeepSeek-R1/R3, Kimi-K2 with
 * native reasoning_content).
 *
 * Key insight from research: reasoning models with interleaved thinking already
 * do multi-step planning inside <think> tokens.  Adding extra instructions to
 * "be autonomous" or "emit progress text" only delays the first real token
 * because the model has to think through all those instructions first.
 *
 * Instead:
 *   • Keep the system prompt to an absolute minimum (or empty).
 *   • Put all behavioural guidance inside tool *descriptions* (see definitions.ts).
 *   • Let the model's own reasoning decide sequencing and progress narration.
 *
 * The model will naturally emit conversational progress text between tool calls
 * (like the image the user provided) because that is what its training taught it
 * to do — we just get out of the way.
 */
export function buildThinkingAgentSystemPrompt(): string | null {
  // Return null to signal "do not inject a system message at all".
  // Tool descriptions in definitions.ts contain all the steering needed.
  return null;
}

// ─── Title-only generation ──────────────────────────────────────────────────

/**
 * Tiny system prompt for non-interactive title generation.
 * Completely separate concern from chat / agent prompts.
 */
export function buildTitleGenerationSystemPrompt(): string {
  return [
    "You write short conversation titles for a chat sidebar.",
    "Output ONLY the title (3-6 words). No quotes or labels.",
  ].join("\n");
}
