import type { AutomationFrequency } from "@/lib/api/automations";

export type AutomationIcon =
  | "sun"
  | "chip"
  | "droplet"
  | "eye"
  | "mail"
  | "review"
  | "tasks"
  | "calendar"
  | "stocks"
  | "earnings"
  | "scan"
  | "paper"
  | "book"
  | "workout"
  | "meal"
  | "language";

export type AutomationPreset = {
  id: string;
  category: "News" | "Productivity" | "Finance" | "Research" | "Lifestyle";
  name: string;
  description: string;
  instructions: string;
  icon: AutomationIcon;
  frequency: AutomationFrequency;
  timeLocal: string;
  dayOfWeek?: number;
};

export const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    id: "morning-brief",
    category: "News",
    name: "Morning Brief",
    description:
      "Start the day with headlines, market moves, and your weather.",
    icon: "sun",
    frequency: "daily",
    timeLocal: "07:30",
    instructions:
      "Put together my morning brief: the top world, business, and tech headlines from the last 24 hours with one-line summaries, any major overnight market moves, and today’s weather for my location. End with one story worth reading in depth and why. Keep the whole thing scannable.",
  },
  {
    id: "ai-news",
    category: "News",
    name: "AI News Digest",
    description: "Model releases, research, and funding that actually matter.",
    icon: "chip",
    frequency: "daily",
    timeLocal: "08:00",
    instructions:
      "Summarize the most important AI news from the last 24 hours: model releases, notable research papers, funding rounds, and policy changes. For each item add one sentence on why it matters. Skip minor product updates and rumors.",
  },
  {
    id: "x-trends",
    category: "News",
    name: "X Trends Digest",
    description: "The five most interesting conversations on X right now.",
    icon: "droplet",
    frequency: "daily",
    timeLocal: "12:00",
    instructions:
      "Find the five most interesting and consequential conversations trending on X right now. Summarize each in two sentences, identify the key voices involved, link to representative posts, and separate genuine developments from speculation or engagement bait.",
  },
  {
    id: "competitor-watch",
    category: "News",
    name: "Competitor Watch",
    description: "Weekly digest of competitor launches, pricing, and hires.",
    icon: "eye",
    frequency: "weekly",
    timeLocal: "09:00",
    dayOfWeek: 1,
    instructions:
      "Create a weekly competitor intelligence digest covering product launches, pricing changes, partnerships, funding, executive hires, and notable customer wins. Explain the likely impact on our market and end with three recommended actions.",
  },
  {
    id: "email-responder",
    category: "Productivity",
    name: "Email Auto-Responder",
    description:
      "Draft concise replies for important email threads each morning.",
    icon: "mail",
    frequency: "daily",
    timeLocal: "09:00",
    instructions:
      "Review important email threads from the last 24 hours. Draft concise, context-aware replies for messages that need a response, prioritize urgent decisions and blockers, and leave anything sensitive or ambiguous for my review without sending automatically.",
  },
  {
    id: "weekly-review",
    category: "Productivity",
    name: "Weekly Review",
    description:
      "Wrap the week: what you did, loose ends, and next priorities.",
    icon: "review",
    frequency: "weekly",
    timeLocal: "16:00",
    dayOfWeek: 5,
    instructions:
      "Prepare my weekly review. Summarize completed work, meaningful progress, decisions, unresolved threads, and overdue items. Identify lessons from the week and propose a short prioritized plan for next week.",
  },
  {
    id: "task-extractor",
    category: "Productivity",
    name: "Task Extractor",
    description:
      "Extract action items from recent messages and summarize next steps.",
    icon: "tasks",
    frequency: "daily",
    timeLocal: "17:00",
    instructions:
      "Review my recent messages and conversations. Extract explicit and implied action items, merge duplicates, assign a likely owner and deadline when the context supports it, and return a prioritized checklist with source context.",
  },
  {
    id: "daily-planner",
    category: "Productivity",
    name: "Daily Planner",
    description: "A realistic plan for today with focus blocks and quick wins.",
    icon: "calendar",
    frequency: "daily",
    timeLocal: "08:30",
    instructions:
      "Build a realistic plan for today from my calendar, active tasks, and recent commitments. Protect two focus blocks, group shallow work, flag conflicts, and identify the three outcomes that would make the day successful.",
  },
  {
    id: "stock-tracker",
    category: "Finance",
    name: "Daily Stock Tracker",
    description:
      "Prices, sentiment, and catalysts for your watchlist every day.",
    icon: "stocks",
    frequency: "daily",
    timeLocal: "14:00",
    instructions:
      "Track my stock watchlist. Report price moves, volume, market sentiment, analyst changes, and material catalysts since the previous close. Highlight unusual movement and explain it without giving personalized financial advice.",
  },
  {
    id: "earnings-calendar",
    category: "Finance",
    name: "Earnings Calendar",
    description: "Who reports this week, expectations, and what to watch.",
    icon: "earnings",
    frequency: "weekly",
    timeLocal: "08:00",
    dayOfWeek: 1,
    instructions:
      "Prepare this week’s earnings calendar for companies on my watchlist and major market movers. Include report dates, consensus expectations, the most important operating metrics, and what could surprise the market.",
  },
  {
    id: "portfolio-news",
    category: "Finance",
    name: "Portfolio News Scan",
    description:
      "Only material news for your holdings — earnings, ratings, lawsuits.",
    icon: "scan",
    frequency: "daily",
    timeLocal: "16:30",
    instructions:
      "Scan for material news affecting my holdings: earnings, guidance, ratings, regulatory action, lawsuits, leadership changes, and major contracts. Exclude routine coverage and summarize why each item could matter.",
  },
  {
    id: "paper-watch",
    category: "Research",
    name: "Paper Watch",
    description:
      "The week’s most interesting research, explained in plain language.",
    icon: "paper",
    frequency: "weekly",
    timeLocal: "09:00",
    dayOfWeek: 3,
    instructions:
      "Find the most interesting credible research papers published this week in the topics I follow. Explain the question, method, findings, limitations, and practical significance in plain language, with links to the original papers.",
  },
  {
    id: "weekend-deep-dive",
    category: "Research",
    name: "Weekend Deep Dive",
    description: "One briefing memo each week on a topic you’re following.",
    icon: "book",
    frequency: "weekly",
    timeLocal: "10:00",
    dayOfWeek: 6,
    instructions:
      "Write one rigorous briefing memo on a topic I’m following. Synthesize primary and high-quality secondary sources, show competing views, identify what remains uncertain, and end with implications and questions worth exploring next.",
  },
  {
    id: "workout-coach",
    category: "Lifestyle",
    name: "Workout Coach",
    description: "A daily 45-minute session that rotates through the week.",
    icon: "workout",
    frequency: "daily",
    timeLocal: "06:30",
    instructions:
      "Create today’s 45-minute workout using a balanced weekly rotation of strength, cardio, mobility, and recovery. Include warm-up, sets or intervals, technique cues, and an easier alternative. Account for any constraints I have shared.",
  },
  {
    id: "meal-planner",
    category: "Lifestyle",
    name: "Meal Planner",
    description: "Seven weeknight dinners plus one consolidated grocery list.",
    icon: "meal",
    frequency: "weekly",
    timeLocal: "17:00",
    dayOfWeek: 0,
    instructions:
      "Plan seven practical weeknight dinners based on my preferences and dietary constraints. Reuse ingredients intelligently, include concise recipes and prep notes, and finish with one consolidated grocery list grouped by aisle.",
  },
  {
    id: "language-practice",
    category: "Lifestyle",
    name: "Language Practice",
    description:
      "A short daily lesson: vocabulary, one grammar point, translation.",
    icon: "language",
    frequency: "daily",
    timeLocal: "19:00",
    instructions:
      "Create a short daily language lesson at my level with useful vocabulary, one focused grammar point, a short translation exercise, and a mini conversation. Revisit recent mistakes using spaced repetition.",
  },
];
