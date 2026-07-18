/**
 * Live spinner verbs — ported from vendor/clauxen-code-agent/constants/spinnerVerbs.ts
 * plus Anthropic-style "Cogitating" for extended thinking.
 */
export const SPINNER_VERBS = [
  "Aligning",
  "Analyzing",
  "Assembling",
  "Building",
  "Checking",
  "Cogitating",
  "Compiling",
  "Composing",
  "Computing",
  "Connecting",
  "Crafting",
  "Decoding",
  "Drafting",
  "Examining",
  "Executing",
  "Exploring",
  "Fetching",
  "Focusing",
  "Forging",
  "Gathering",
  "Generating",
  "Indexing",
  "Inferring",
  "Inspecting",
  "Mapping",
  "Merging",
  "Optimizing",
  "Parsing",
  "Planning",
  "Polishing",
  "Preparing",
  "Processing",
  "Querying",
  "Reading",
  "Refining",
  "Resolving",
  "Reviewing",
  "Scanning",
  "Shaping",
  "Solving",
  "Sorting",
  "Structuring",
  "Synthesizing",
  "Tracing",
  "Transforming",
  "Updating",
  "Validating",
  "Wiring",
  "Writing",
] as const;

export const COGITATING_LABEL = "Cogitating";

/** Stable live verb for a turn — prefers Cogitating while extended thinking streams. */
export function resolveLiveSpinnerVerb(input: {
  isThinkingStreaming?: boolean;
  seed?: number;
}): string {
  if (input.isThinkingStreaming) return COGITATING_LABEL;
  const seed = input.seed ?? Date.now();
  return SPINNER_VERBS[Math.abs(seed) % SPINNER_VERBS.length] ?? "Working";
}
