/** Shared chat title normalization for API + client fallback paths. */

export type TitleExchange = {
  userContent: string;
  assistantContent: string;
};

export function stripTitleSourceText(text: string): string {
  return text
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^[\s|>:\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isUsableChatTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;

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
        return candidate.length > 60 ? `${candidate.slice(0, 57)}…` : candidate;
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
    return shortened.length > 60 ? `${shortened.slice(0, 57)}…` : shortened;
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
    "Create a short sidebar title (3-6 words) for this chat.",
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
  const visibleText = stripTitleSourceText(raw);
  const firstLine = visibleText.split(/\r?\n/)[0] ?? "";
  const trimmed = firstLine
    .replace(/^(title|chat title)\s*:\s*/i, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*{1,3}|\*{1,3}$/g, "")
    .replace(/^_{1,3}|_{1,3}$/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

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
      return quoted.slice(0, 80);
    }
    return fallback;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const short = words.length <= 8 ? trimmed : words.slice(0, 6).join(" ");
  const title = short.slice(0, 80);

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
