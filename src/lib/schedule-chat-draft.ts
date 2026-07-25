/** sessionStorage key for “Create via chat” composer prefill. */
export const SCHEDULE_CHAT_DRAFT_KEY = "clauxen:schedule-chat-draft";

export const SCHEDULE_VIA_CHAT_PROMPT = [
  "Help me create a scheduled task for Clauxen.",
  "",
  "Please gather (or confirm) these details, then call the `create_scheduled_task` tool:",
  "1. Task name (short)",
  "2. What Clauxen should do each run (the requirement / prompt)",
  "3. Frequency: once, daily, weekly, or monthly",
  "4. Local time (HH:MM, 24h) and my timezone if known",
  "5. For weekly: which weekday; for monthly: which day of month; for once: which date",
  "6. Expiration date (YYYY-MM-DD) if I want one",
  "",
  "Ask me briefly for anything missing, then create the task with the tool.",
].join("\n");

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

export function stashScheduleChatDraft(prompt: string = SCHEDULE_VIA_CHAT_PROMPT) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCHEDULE_CHAT_DRAFT_KEY, prompt);
  } catch {
    // ignore quota
  }
}
