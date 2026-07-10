import type { Message } from "@/frontend/lib/types";

/** One user→assistant exchange in the login demo chat. */
export type DemoTurn = {
  id: string;
  prompt: string;
  reply: string;
};

/**
 * Daily-life scene — one English pair (replaces the old 5-language loop).
 */
export const DEMO_DAILY_TURN: DemoTurn = {
  id: "daily",
  prompt:
    "Hi, my husband and I both work full-time and our 10-year-old daughter is falling behind in reading and math. We're also trying to save for her college fund, but with rent going up every year it's really tight. Can you help us figure out a routine for her and some practical budgeting tips for us?",
  reply:
    "You know, so I can give you something really thorough and useful, let's go through this properly — money first (because stress leaks into everything), then a routine you can actually keep on weeknights.\n\n**Budgeting when rent keeps climbing**\n- Start with a **needs / wants / future** split (a flexible 50/30/20). If rent alone is over ~35% of take-home, treat that as a signal: negotiate renewal, ask about a longer lease lock, or plan a move *before* you're forced into a bad one.\n- Automate a **tiny college transfer** the day after payday — even $40–75/month into a 529 (or your country's equivalent). Consistency beats waiting for a \"good month.\"\n- Build a **$500–1,000 starter emergency buffer** before aggressive investing. One car repair shouldn't wipe out college savings.\n- Do a 20-minute **subscription + grocery audit** once a month. Cancel one unused service; switch one recurring grocery to store brand.\n\n**A catch-up routine that fits two full-time jobs**\n- **Right after school (before screens):** 20 minutes reading *she* chooses + 15 minutes math on one weak skill.\n- Ask her teacher for the **2–3 skills** she's behind on. Targeted practice beats vague \"help with math.\"\n- Use adaptive free/cheap tools: **Khan Academy** and a leveled reader list from the school librarian.\n\n**Sample weeknight (30–35 min total)**  \nSnack → 20 min reading together → 15 min math → then free time.\n\nIf you share her grade level and roughly what rent takes of income, I can tighten both the budget numbers and a printable weekday schedule for you two.",
};

/** @deprecated kept for any external imports — prefer DEMO_DAILY_TURN */
export const DEMO_CHAT_TURNS: DemoTurn[] = [DEMO_DAILY_TURN];

export function buildUserMessage(turn: DemoTurn, index: number): Message {
  return {
    id: `demo-user-${turn.id}-${index}`,
    role: "user",
    content: turn.prompt,
    createdAt: Date.now(),
  };
}

export function buildAssistantMessage(
  turn: DemoTurn,
  index: number,
  content: string,
  isStreaming: boolean,
  createdAt = Date.now(),
): Message {
  return {
    id: `demo-assistant-${turn.id}-${index}`,
    role: "assistant",
    content,
    isStreaming,
    createdAt,
  };
}
