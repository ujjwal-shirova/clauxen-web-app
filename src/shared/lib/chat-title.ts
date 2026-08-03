/** Shared chat title normalization for API + client fallback paths. */

export const MAX_CHAT_TITLE_LENGTH = 25;
/** Sidebar title typewriter speed after the first assistant reply. */
export const CHAT_TITLE_STREAM_CHAR_MS = 8;
export const CHAT_TITLE_STREAM_CHUNK = 2;

export type TitleExchange = {
  userContent: string;
  assistantContent: string;
};

export function stripMarkdownFromTitle(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function limitChatTitleLength(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_CHAT_TITLE_LENGTH) return trimmed;
  const slice = trimmed.slice(0, MAX_CHAT_TITLE_LENGTH);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > MAX_CHAT_TITLE_LENGTH * 0.55) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

export function finalizeChatTitle(title: string): string {
  return limitChatTitleLength(stripMarkdownFromTitle(title));
}

export function stripTitleSourceText(text: string): string {
  return stripChatTitleTags(
    text
      .replace(/<think[\s\S]*?<\/think>/gi, "")
      .replace(/<\/?think>/gi, "")
      .replace(/^[\s|>:\-–—]+/, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function containsChatTitleMarkup(text: string): boolean {
  return /<chat_title[\s>]/i.test(text) || /<\/chat_title>/i.test(text);
}

export function isUsableChatTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (containsChatTitleMarkup(trimmed)) return false;

  const alnum = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  if (alnum.length < 2) return false;

  if (/^[\s|>v\-–—.,;:!?#*`~^&%$@\\\/\[\]{}()<>]+$/i.test(trimmed)) {
    return false;
  }

  return true;
}

export function isNearCopyOfUserMessage(
  title: string,
  userContent: string,
): boolean {
  const user = stripTitleSourceText(userContent).toLowerCase();
  const candidate = stripTitleSourceText(title).toLowerCase();
  if (!user || !candidate) return false;
  if (candidate === user) return true;
  if (user.length < 12) return false;
  if (user.startsWith(candidate) && candidate.length >= user.length * 0.55)
    return true;
  if (candidate.startsWith(user.slice(0, Math.min(user.length, 48))))
    return true;
  return false;
}

/** Heuristic title from the first exchange when the LLM call fails or returns junk. */
export function deriveTitleFromExchange(
  userContent: string,
  assistantContent: string,
): string {
  const user = stripTitleSourceText(userContent);
  const assistant = stripTitleSourceText(assistantContent);

  const assistantLead = assistant
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .find((part) => part.length >= 12);

  if (assistantLead) {
    const words = assistantLead
      .split(/\s+/)
      .filter((word) => word.length > 1)
      .slice(0, 6);
    if (words.length >= 2) {
      const candidate = words.join(" ");
      if (
        isUsableChatTitle(candidate) &&
        !isNearCopyOfUserMessage(candidate, user)
      ) {
        return finalizeChatTitle(candidate);
      }
    }
  }

  const topic = user
    .replace(
      /^(please|can you|could you|how do i|how to|what is|what are|help me|i need to|tell me)\s+/i,
      "",
    )
    .trim();
  const shortened = topic.split(/\s+/).slice(0, 5).join(" ");
  if (isUsableChatTitle(shortened) && shortened.length >= 3) {
    return finalizeChatTitle(shortened);
  }

  return "New chat";
}

export function buildTitlePromptPayload(exchange: TitleExchange): string {
  const user = stripTitleSourceText(exchange.userContent).slice(0, 600);
  const assistant = stripTitleSourceText(exchange.assistantContent).slice(
    0,
    600,
  );
  return [
    `Create a short sidebar title (max ${MAX_CHAT_TITLE_LENGTH} characters) for this chat.`,
    "Focus on the topic, not the full question. Do not copy the user message verbatim.",
    "",
    `User: ${user || "(empty)"}`,
    `Assistant: ${assistant || "(empty)"}`,
  ].join("\n");
}

export function normalizeChatTitle(
  raw: string,
  exchange: TitleExchange,
): string {
  const fallback = deriveTitleFromExchange(
    exchange.userContent,
    exchange.assistantContent,
  );
  const inlineTitle = extractChatTitleFromText(raw);
  if (inlineTitle) {
    const normalizedInline = normalizeInlineChatTitle(
      inlineTitle,
      exchange.userContent,
    );
    if (isUsableChatTitle(normalizedInline)) {
      return normalizedInline;
    }
  }
  const visibleText = stripTitleSourceText(raw);
  const firstLine = visibleText.split(/\r?\n/)[0] ?? "";
  const trimmed = finalizeChatTitle(
    firstLine
      .replace(/^(title|chat title)\s*:\s*/i, "")
      .replace(/^#{1,6}\s+/, "")
      .replace(/^["'`]+|["'`]+$/g, ""),
  );

  if (!isUsableChatTitle(trimmed)) {
    return fallback;
  }

  const looksLikeReasoning =
    /generate a short chat title/i.test(trimmed) ||
    /^the user (just )?(said|asked|wants)/i.test(trimmed) ||
    /^i (need to|should|will) /i.test(trimmed) ||
    /^let me /i.test(trimmed);

  if (looksLikeReasoning) {
    const quoted = trimmed.match(/"([^"]{1,60})"/)?.[1]?.trim();
    if (
      quoted &&
      isUsableChatTitle(quoted) &&
      !isNearCopyOfUserMessage(quoted, exchange.userContent)
    ) {
      return finalizeChatTitle(quoted);
    }
    return fallback;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const short = words.length <= 6 ? trimmed : words.slice(0, 5).join(" ");
  const title = finalizeChatTitle(short);

  if (
    !isUsableChatTitle(title) ||
    isNearCopyOfUserMessage(title, exchange.userContent)
  ) {
    return fallback;
  }

  return title;
}

/** @deprecated Prefer deriveTitleFromExchange — kept for narrow legacy call sites. */
export function deriveChatTitleFromUserMessage(userContent: string): string {
  return deriveTitleFromExchange(userContent, "");
}

export const CHAT_TITLE_OPEN_TAG = "<chat_title>";
export const CHAT_TITLE_CLOSE_TAG = "</chat_title>";

/** System instruction appended only for the first message in a new chat. */
export function buildInlineChatTitleSystemInstruction(): string {
  return [
    "This is the first message in a new conversation.",
    "Begin your reply with a short sidebar title (3-6 words, topic summary — do not copy the user's message verbatim) wrapped exactly in",
    `${CHAT_TITLE_OPEN_TAG} and ${CHAT_TITLE_CLOSE_TAG} tags, then continue with your main answer.`,
    `Example: ${CHAT_TITLE_OPEN_TAG}React useEffect loop fix${CHAT_TITLE_CLOSE_TAG}`,
  ].join(" ");
}

export function isFirstChatExchange(
  messages: Array<{ role: string; content: string }>,
): boolean {
  const turns = messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  return (
    turns.length === 1 &&
    turns[0]?.role === "user" &&
    turns[0].content.trim().length > 0
  );
}

export function resolveGenerateChatTitle(
  messages: Array<{ role: string; content: string }>,
  explicit?: boolean,
): boolean {
  if (explicit === false) return false;
  if (explicit === true) return true;
  return isFirstChatExchange(messages);
}

export function stripChatTitleTags(text: string): string {
  return text
    .replace(
      new RegExp(
        `${CHAT_TITLE_OPEN_TAG}[\\s\\S]*?${CHAT_TITLE_CLOSE_TAG}`,
        "gi",
      ),
      "",
    )
    .replace(/^\s+/, "");
}

/** Final pass after streaming — also drops a trailing unclosed `<chat_title>` block. */
export function finalizeChatTitleStrippedAnswer(text: string): string {
  return stripChatTitleTags(text)
    .replace(new RegExp(`${CHAT_TITLE_OPEN_TAG}[\\s\\S]*$`, "i"), "")
    .replace(/^\s+/, "");
}

export type ChatTitleAnswerAccumulator = {
  raw: string;
  visible: string;
};

export function createChatTitleAnswerAccumulator(): ChatTitleAnswerAccumulator {
  return { raw: "", visible: "" };
}

/** Append a stream delta; returns newly visible answer text (complete tags only). */
export function appendChatTitleAnswerDelta(
  acc: ChatTitleAnswerAccumulator,
  delta: string,
): string {
  if (!delta) return "";
  acc.raw += delta;
  const nextVisible = stripChatTitleTags(acc.raw);
  const incremental = nextVisible.slice(acc.visible.length);
  acc.visible = nextVisible;
  return incremental;
}

/**
 * Seed/replace the title accumulator from a wholesale text event
 * (`answer_finalize` or a recovered message.content). Prefer this over
 * empty `raw` when the agent loop promotes via answer_finalize instead of
 * legacy answer_delta chunks.
 */
export function seedChatTitleAnswerAccumulator(
  acc: ChatTitleAnswerAccumulator,
  text: string,
): void {
  acc.raw = text;
  acc.visible = stripChatTitleTags(text);
}

/**
 * Prefer the loop-promoted answer (completedAnswer / message.content) over an
 * unused title accumulator. Never let an empty or narration-polluted
 * accumulator wipe a good answer_finalize payload.
 */
export function resolveFinalStreamedAnswer(options: {
  completedAnswer?: string | null;
  accumulatorRaw?: string | null;
  messageContent?: string | null;
}): string {
  const fromCompleted = options.completedAnswer?.trim()
    ? finalizeChatTitleStrippedAnswer(options.completedAnswer)
    : "";
  if (fromCompleted) return fromCompleted;
  const fromMsg = finalizeChatTitleStrippedAnswer(options.messageContent ?? "");
  if (fromMsg) return fromMsg;
  return options.accumulatorRaw?.trim()
    ? finalizeChatTitleStrippedAnswer(options.accumulatorRaw)
    : "";
}

export function resolveDisplayChatTitle(
  chatTitle?: string,
  isStreaming = false,
): string {
  const raw = chatTitle?.trim() ?? "";
  if (!raw) return "New Chat";

  const fromTag = extractChatTitleFromText(raw);
  if (fromTag) {
    const cleanedTag = finalizeChatTitle(fromTag);
    if (isStreaming || isUsableChatTitle(cleanedTag)) {
      return cleanedTag;
    }
  }

  const stripped = finalizeChatTitle(stripChatTitleTags(raw));
  if (stripped && (isStreaming || isUsableChatTitle(stripped))) {
    return stripped;
  }

  return "New Chat";
}

export function extractChatTitleFromText(text: string): string | null {
  const match = text.match(
    new RegExp(
      `${CHAT_TITLE_OPEN_TAG}([\\s\\S]*?)${CHAT_TITLE_CLOSE_TAG}`,
      "i",
    ),
  );
  const raw = match?.[1]?.trim();
  return raw || null;
}

export function normalizeInlineChatTitle(
  raw: string,
  userContent: string,
): string {
  return normalizeChatTitle(raw, {
    userContent,
    assistantContent: "",
  });
}

function trailingPartialTag(text: string, tag: string): string {
  for (let length = Math.min(text.length, tag.length - 1); length > 0; length--) {
    const suffix = text.slice(-length);
    if (tag.startsWith(suffix)) {
      return suffix;
    }
  }
  return "";
}

/** Strips `<chat_title>...</chat_title>` from streamed answer text and emits the title once. */
export class ChatTitleStreamFilter {
  private state: "seek_open" | "in_title" | "done" = "seek_open";
  private openBuffer = "";
  private titleBuffer = "";
  private titleEmitted = false;

  constructor(private readonly onTitle: (title: string) => void) {}

  push(delta: string): string {
    if (this.state === "done" || !delta) {
      return this.state === "done" ? delta : "";
    }

    let remaining = delta;
    let visible = "";

    while (remaining.length > 0) {
      if (this.state === "done") {
        visible += remaining;
        remaining = "";
        break;
      }
      if (this.state === "seek_open") {
        const combined = this.openBuffer + remaining;
        const openIndex = combined.indexOf(CHAT_TITLE_OPEN_TAG);
        if (openIndex === -1) {
          const partial = trailingPartialTag(combined, CHAT_TITLE_OPEN_TAG);
          if (partial) {
            visible += combined.slice(0, combined.length - partial.length);
            this.openBuffer = partial;
            remaining = "";
          } else {
            visible += combined;
            this.openBuffer = "";
            remaining = "";
          }
          continue;
        }

        visible += combined.slice(0, openIndex);
        remaining = combined.slice(openIndex + CHAT_TITLE_OPEN_TAG.length);
        this.openBuffer = "";
        this.state = "in_title";
        continue;
      }

      const closeIndex = remaining.indexOf(CHAT_TITLE_CLOSE_TAG);
      if (closeIndex === -1) {
        const partial = trailingPartialTag(remaining, CHAT_TITLE_CLOSE_TAG);
        if (partial) {
          this.titleBuffer += remaining.slice(0, remaining.length - partial.length);
          remaining = "";
        } else {
          this.titleBuffer += remaining;
          remaining = "";
        }
        continue;
      }

      this.titleBuffer += remaining.slice(0, closeIndex);
      const title = this.titleBuffer.trim();
      if (title && !this.titleEmitted) {
        this.titleEmitted = true;
        this.onTitle(title);
      }
      this.state = "done";
      remaining = remaining
        .slice(closeIndex + CHAT_TITLE_CLOSE_TAG.length)
        .replace(/^\s+/, "");
      this.titleBuffer = "";
    }

    return visible;
  }

  flush(): string {
    if (this.state === "in_title") {
      const title = this.titleBuffer.trim();
      if (title && !this.titleEmitted) {
        this.titleEmitted = true;
        this.onTitle(title);
      }
      this.titleBuffer = "";
      this.state = "done";
      return "";
    }
    if (this.state === "seek_open" && this.openBuffer) {
      const tail = this.openBuffer;
      this.openBuffer = "";
      return tail;
    }
    return "";
  }
}

/** Flush buffered non-title text at the end of a backend stream. */
export function flushChatTitleFilterTail(
  filter: ChatTitleStreamFilter | null,
): string {
  return filter?.flush() ?? "";
}

