/** sessionStorage key for “Create via chat” composer prefill. */
export const SCHEDULE_CHAT_DRAFT_KEY = "clauxen:schedule-chat-draft";

export const SCHEDULE_VIA_CHAT_PROMPT =
  "I'd like to plan a task that Clauxen can repeat for me. Explain the basics briefly, then help me decide what it should do, how often it should run, and the best time and timezone. Ask about an end date if needed, and help me save the schedule once the details are clear.";

export function consumeScheduleChatDraft(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const draft = sessionStorage.getItem(SCHEDULE_CHAT_DRAFT_KEY);
    if (!draft) return null;
    sessionStorage.removeItem(SCHEDULE_CHAT_DRAFT_KEY);
    return draft;
  } catch {
    return null;
  }
}

export function stashScheduleChatDraft(
  prompt: string = SCHEDULE_VIA_CHAT_PROMPT,
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCHEDULE_CHAT_DRAFT_KEY, prompt);
  } catch {
    // ignore quota
  }
}
