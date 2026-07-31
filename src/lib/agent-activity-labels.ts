/**
 * Derives compact work-group headers from the agent's narration prose.
 *
 * The model writes natural progress sentences ("Let me check the latest
 * pricing for that."). The UI turns them into Claude-style step headers:
 * shimmering gerund while the group runs ("Checking latest pricing…"),
 * past tense once it completes ("Checked latest pricing").
 *
 * Pure string heuristics — no model round-trips, no custom tags.
 */

const LEAD_FILLER_RE =
  /^(?:okay|ok|sure|alright|great|now|next|then|so|first|after that|finally|let me|i'll|i will|i’m going to|i'm going to|i am going to|going to|let's|let us|allow me to|i need to|i should|i can|i’ll now|i will now|time to)[\s,]+/i;

const TRAILING_FILLER_RE = /[.!…\s]+$/;

/** Common irregular past-tense verbs the agent uses all the time. */
const IRREGULAR_PAST: Record<string, string> = {
  run: "Ran",
  running: "Ran",
  write: "Wrote",
  writing: "Wrote",
  read: "Read",
  reading: "Read",
  build: "Built",
  building: "Built",
  make: "Made",
  making: "Made",
  find: "Found",
  finding: "Found",
  fetch: "Fetched",
  fetching: "Fetched",
  search: "Searched",
  searching: "Searched",
  check: "Checked",
  checking: "Checked",
  look: "Looked",
  looking: "Looked",
  create: "Created",
  creating: "Created",
  generate: "Generated",
  generating: "Generated",
  compute: "Computed",
  computing: "Computed",
  calculate: "Calculated",
  calculating: "Calculated",
  install: "Installed",
  installing: "Installed",
  download: "Downloaded",
  downloading: "Downloaded",
  open: "Opened",
  opening: "Opened",
  load: "Loaded",
  loading: "Loaded",
  parse: "Parsed",
  parsing: "Parsed",
  analyze: "Analyzed",
  analyzing: "Analyzed",
  analyse: "Analysed",
  analysing: "Analysed",
  review: "Reviewed",
  reviewing: "Reviewed",
  verify: "Verified",
  verifying: "Verified",
  test: "Tested",
  testing: "Tested",
  fix: "Fixed",
  fixing: "Fixed",
  update: "Updated",
  updating: "Updated",
  compare: "Compared",
  comparing: "Compared",
  gather: "Gathered",
  gathering: "Gathered",
  collect: "Collected",
  collecting: "Collected",
  pull: "Pulled",
  pulling: "Pulled",
  get: "Got",
  getting: "Got",
  set: "Set",
  setting: "Set",
  think: "Thought",
  thinking: "Thought",
  plan: "Planned",
  planning: "Planned",
  draft: "Drafted",
  drafting: "Drafted",
  render: "Rendered",
  rendering: "Rendered",
  plot: "Plotted",
  plotting: "Plotted",
  execute: "Executed",
  executing: "Executed",
  start: "Started",
  starting: "Started",
  finish: "Finished",
  finishing: "Finished",
  ask: "Asked",
  asking: "Asked",
  try: "Tried",
  trying: "Tried",
  use: "Used",
  using: "Used",
  do: "Did",
  doing: "Did",
  go: "Went",
  going: "Went",
  take: "Took",
  taking: "Took",
  give: "Gave",
  giving: "Gave",
  see: "Saw",
  seeing: "Saw",
  dig: "Dug",
  digging: "Dug",
  put: "Put",
  putting: "Put",
};

/** First sentence of a prose blob, trimmed of filler punctuation. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?\n]{2,120}(?:[.!?]|$)/);
  return (match ? match[0] : trimmed.slice(0, 120)).trim();
}

/** Strip conversational lead-ins so the verb surfaces first. */
export function stripNarrationFiller(sentence: string): string {
  let out = sentence.trim().replace(TRAILING_FILLER_RE, "");
  for (let i = 0; i < 4; i += 1) {
    const next = out.replace(LEAD_FILLER_RE, "");
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

/** English gerund for a base-form verb ("check" → "checking"). */
export function toGerund(verb: string): string {
  const lower = verb.toLowerCase();
  if (lower.endsWith("ing")) return lower;
  if (lower.endsWith("ie")) return `${lower.slice(0, -2)}ying`;
  if (lower.endsWith("e") && !lower.endsWith("ee") && !lower.endsWith("ye")) {
    return `${lower.slice(0, -1)}ing`;
  }
  // CVC doubling: run → running, stop → stopping (skip w/x/y endings)
  if (lower.length >= 3 && /[^aeiou][aeiou][^aeiouwxys]$/.test(lower)) {
    return `${lower}${lower.slice(-1)}ing`;
  }
  return `${lower}ing`;
}

/** Past tense for a verb, irregular-aware ("check" → "checked"). */
export function toPastTense(verb: string): string {
  const lower = verb.toLowerCase();
  const irregular = IRREGULAR_PAST[lower];
  if (irregular) return irregular.toLowerCase();
  if (lower.endsWith("ing")) {
    const base = lower.slice(0, -3);
    const fromBase = IRREGULAR_PAST[base];
    if (fromBase) return fromBase.toLowerCase();
    // running → ran handled above; default: strip doubling + ed
    const undoubled =
      base.length >= 2 && base.endsWith(base.slice(-1))
        ? base.slice(0, -1)
        : base;
    return `${undoubled}ed`;
  }
  if (lower.endsWith("e")) return `${lower}d`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ied`;
  if (lower.length >= 3 && /[^aeiou][aeiou][^aeiouwxys]$/.test(lower)) {
    return `${lower}${lower.slice(-1)}ed`;
  }
  return `${lower}ed`;
}

function capitalize(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

/** Pronouns/articles/nouns that open declaratives — never step verbs. */
const NON_VERB_OPENERS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "here",
  "there",
  "i",
  "we",
  "you",
  "he",
  "she",
  "they",
  "my",
  "our",
  "your",
  "done",
  "yes",
  "no",
  "ok",
  "okay",
  "all",
  "both",
  "everything",
  "something",
  "nothing",
  "results",
  "result",
  "summary",
  "note",
]);

const MAX_LABEL_WORDS = 8;

function trimToWordBudget(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_LABEL_WORDS) return text;
  return `${words.slice(0, MAX_LABEL_WORDS).join(" ")}…`;
}

/**
 * Build a step header from narration prose.
 *  - active: "Checking the latest pricing…" (shimmered by the caller)
 *  - done:   "Checked the latest pricing"
 * Returns undefined when no usable verb phrase exists.
 */
export function deriveActivityLabel(
  narrationText: string,
  state: "active" | "done",
): string | undefined {
  const sentence = firstSentence(narrationText);
  if (!sentence) return undefined;
  const core = stripNarrationFiller(sentence);
  if (!core) return undefined;

  const [firstWord, ...rest] = core.split(/\s+/);
  if (!firstWord || !/^[a-zA-Z][a-zA-Z'-]*$/.test(firstWord)) return undefined;
  // Declaratives ("The results are in…", "Results look good…") don't
  // gerund-ize into steps — they render as standalone prose rows.
  const firstLower = firstWord.toLowerCase();
  if (NON_VERB_OPENERS.has(firstLower)) return undefined;
  if (/s$/.test(firstLower) && !/ing$/.test(firstLower)) {
    return undefined;
  }

  const remainder = rest.join(" ");
  if (state === "active") {
    const verb = toGerund(firstWord);
    return trimToWordBudget(
      capitalize(remainder ? `${verb} ${remainder}…` : `${verb}…`),
    );
  }
  const verb = toPastTense(firstWord);
  return trimToWordBudget(
    capitalize(remainder ? `${verb} ${remainder}` : verb),
  );
}
