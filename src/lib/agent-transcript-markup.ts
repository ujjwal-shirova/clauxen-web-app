/**
 * Small, model-authored control tags used by the agent transcript.
 *
 * The tags never reach markdown. They only classify model output as:
 * - a short live heading for a thinking phase
 * - user-visible narration that is not the final answer
 */
export const AGENT_HEADING_OPEN = "<agent_heading>";
export const AGENT_HEADING_CLOSE = "</agent_heading>";
export const AGENT_NARRATION_OPEN = "<agent_narration>";
export const AGENT_NARRATION_CLOSE = "</agent_narration>";

const OPEN_TAGS = [AGENT_HEADING_OPEN, AGENT_NARRATION_OPEN] as const;

function trailingTagPrefixLength(value: string, tag: string): number {
  const max = Math.min(value.length, tag.length - 1);
  for (let length = max; length > 0; length -= 1) {
    if (value.endsWith(tag.slice(0, length))) return length;
  }
  return 0;
}

function firstPartialOpenTagIndex(value: string): number {
  for (let index = Math.max(0, value.length - AGENT_NARRATION_OPEN.length); index < value.length; index += 1) {
    const suffix = value.slice(index);
    if (OPEN_TAGS.some((tag) => tag.startsWith(suffix))) return index;
  }
  return -1;
}

export function normalizeAgentHeading(value: string): string {
  return value
    .replace(/<\/?agent_(?:heading|narration)>/gi, "")
    .replace(/^[#>*\-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export type ParsedThinkingMarkup = {
  heading?: string;
  body: string;
  hasHeadingTag: boolean;
};

/**
 * Parse a growing thinking block without ever leaking a partial control tag.
 * `body` is monotonic when the heading tag appears at the start, which lets the
 * server safely emit only newly appended reasoning text.
 */
export function parseThinkingMarkup(input: string): ParsedThinkingMarkup {
  const openIndex = input.indexOf(AGENT_HEADING_OPEN);
  if (openIndex < 0) {
    const partialIndex = firstPartialOpenTagIndex(input);
    return {
      body: partialIndex >= 0 ? input.slice(0, partialIndex) : input,
      hasHeadingTag: false,
    };
  }

  const headingStart = openIndex + AGENT_HEADING_OPEN.length;
  const closeIndex = input.indexOf(AGENT_HEADING_CLOSE, headingStart);
  if (closeIndex < 0) {
    const rawHeading = input.slice(headingStart);
    const heldClosePrefix = trailingTagPrefixLength(
      rawHeading,
      AGENT_HEADING_CLOSE,
    );
    return {
      heading: normalizeAgentHeading(
        heldClosePrefix > 0
          ? rawHeading.slice(0, -heldClosePrefix)
          : rawHeading,
      ),
      body: input.slice(0, openIndex),
      hasHeadingTag: true,
    };
  }

  return {
    heading: normalizeAgentHeading(input.slice(headingStart, closeIndex)),
    body:
      input.slice(0, openIndex) +
      input.slice(closeIndex + AGENT_HEADING_CLOSE.length),
    hasHeadingTag: true,
  };
}

export type ParsedAgentTextMarkup = {
  heading?: string;
  narration: string;
  visibleText: string;
  hasNarrationTag: boolean;
  hasControlMarkup: boolean;
};

/**
 * Parse model text while it is still streaming. Text outside the control tags
 * remains candidate final-answer text; narration is returned separately.
 */
export function parseAgentTextMarkup(input: string): ParsedAgentTextMarkup {
  let mode: "plain" | "heading" | "narration" = "plain";
  let index = 0;
  let visibleText = "";
  let currentHeading = "";
  let heading: string | undefined;
  let currentNarration = "";
  const narrationParts: string[] = [];
  let hasNarrationTag = false;
  let hasControlMarkup = false;

  while (index < input.length) {
    if (mode === "plain") {
      if (input.startsWith(AGENT_HEADING_OPEN, index)) {
        mode = "heading";
        hasControlMarkup = true;
        index += AGENT_HEADING_OPEN.length;
        continue;
      }
      if (input.startsWith(AGENT_NARRATION_OPEN, index)) {
        mode = "narration";
        hasNarrationTag = true;
        hasControlMarkup = true;
        index += AGENT_NARRATION_OPEN.length;
        continue;
      }
      if (input.startsWith(AGENT_HEADING_CLOSE, index)) {
        hasControlMarkup = true;
        index += AGENT_HEADING_CLOSE.length;
        continue;
      }
      if (input.startsWith(AGENT_NARRATION_CLOSE, index)) {
        hasControlMarkup = true;
        index += AGENT_NARRATION_CLOSE.length;
        continue;
      }
      if (input[index] === "<") {
        const remainder = input.slice(index);
        if (OPEN_TAGS.some((tag) => tag.startsWith(remainder))) break;
      }
      visibleText += input[index];
      index += 1;
      continue;
    }

    const closeTag =
      mode === "heading" ? AGENT_HEADING_CLOSE : AGENT_NARRATION_CLOSE;
    const closeIndex = input.indexOf(closeTag, index);
    if (closeIndex >= 0) {
      const content = input.slice(index, closeIndex);
      if (mode === "heading") {
        currentHeading += content;
        heading = normalizeAgentHeading(currentHeading) || heading;
        currentHeading = "";
      } else {
        currentNarration += content;
        if (currentNarration.trim()) narrationParts.push(currentNarration);
        currentNarration = "";
      }
      index = closeIndex + closeTag.length;
      mode = "plain";
      continue;
    }

    const remainder = input.slice(index);
    const heldClosePrefix = trailingTagPrefixLength(remainder, closeTag);
    const content =
      heldClosePrefix > 0
        ? remainder.slice(0, -heldClosePrefix)
        : remainder;
    if (mode === "heading") {
      currentHeading += content;
      heading = normalizeAgentHeading(currentHeading) || heading;
    } else {
      currentNarration += content;
    }
    break;
  }

  if (currentNarration.trim()) narrationParts.push(currentNarration);

  return {
    heading,
    narration: narrationParts.join("\n\n"),
    visibleText,
    hasNarrationTag,
    hasControlMarkup,
  };
}

export function stripAgentTranscriptMarkup(input: string): string {
  const parsed = parseAgentTextMarkup(input);
  return [parsed.visibleText.trim(), parsed.narration.trim()]
    .filter(Boolean)
    .join("\n\n");
}
