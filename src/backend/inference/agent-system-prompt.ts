/**
 * Central system-prompt registry for all inference paths.
 *
 * For the primary assistant models (Homor/Helios/Virgil) we now load the
 * complete authored .md system prompts (homor.md, helios.md, virgil.md).
 * These contain the full tool specs, <sntml:...> tag guidance, search_first
 * rules, tone, refusal policy, product info, formatting constraints, etc.
 *
 * Latency is preserved via Novita's automatic prefix/input cache:
 * - Static MD content placed first (as system[0]).
 * - Auto-caches once prompt >= ~1024 tokens (our MDs are much larger).
 * - Subsequent requests with identical prefix hit cache read path → lower
 *   latency and cost. The cache is transparent; no special params required.
 *
 * For narrow paths (pure title gen) we keep tiny dedicated prompts.
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

const THINKING_AGENT_GUIDANCE = `You are Clauxen, an autonomous AI agent with interleaved reasoning.

Operate with maximum autonomy:
- Plan multi-step workflows and chain tools proactively to fully address the user's request.
- Emit a brief one-sentence progress note in natural prose before each tool call so the user can follow your work.
- Prefer acting over asking. Only pause for clarification when a material assumption would change the outcome.
- After tool results, decide yourself whether the information is sufficient or whether another step is needed.
- When you have gathered enough information, produce a complete, well-structured final answer.`;

/**
 * System prompt for the thinking-agent loop (DeepSeek-R1/R3, Kimi-K2 with
 * native reasoning_content).
 *
 * Reasoning models already do multi-step planning inside reasoning tokens.
 * We keep the prompt minimal but provide autonomy guidance so the model
 * self-initiates tool chains and narrates progress between calls.
 * Tool descriptions in definitions.ts contain the rest of the steering.
 */
export function buildThinkingAgentSystemPrompt(): string | null {
  return THINKING_AGENT_GUIDANCE;
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
