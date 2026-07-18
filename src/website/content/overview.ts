import { definePage } from "@/website/lib/types";
import {
  CTA,
  ctaBand,
  features,
  hero,
  linkGrid,
} from "@/website/content/_helpers";

/** /overview — Claude product/overview pattern: thinking partner + how you use it. */
export const overviewPage = definePage(
  "/overview",
  "Overview",
  "Clauxen is your AI workspace for chat, work, and code — by Shirova AI.",
  [
    hero(
      "Meet your thinking partner",
      "Tackle big, bold work with Clauxen. Chat, ship code, and finish deliverables in one workspace.",
      {
        eyebrow: "Clauxen",
        primaryCta: CTA.tryApp,
        secondaryCta: CTA.download,
      },
    ),
    features(
      [
        {
          title: "Break problems down together",
          body: "Clauxen builds on your ideas, expands your logic, and simplifies complexity one step at a time.",
        },
        {
          title: "Tackle your toughest work",
          body: "Expert-level help on coding, analysis, writing, and research — without leaving the thread.",
        },
        {
          title: "Explore what’s next",
          body: "Collaborate like an expert in your pocket. Expand what you can ship alone or with a team.",
        },
      ],
      "Built for problem solvers",
    ),
    features(
      [
        {
          title: "Write",
          body: "Draft, edit, and find a voice for messaging, docs, and creative work.",
        },
        {
          title: "Learn",
          body: "Explain hard topics simply, prep for interviews, and make sense of messy notes.",
        },
        {
          title: "Code",
          body: "Explain concepts, review diffs, and vibe-code with Codex beside chat.",
        },
        {
          title: "Research",
          body: "Search the web, dig through files, and turn findings into finished work.",
        },
      ],
      "How you can use Clauxen",
    ),
    linkGrid(
      [
        {
          title: "Work",
          body: "Hand off goals. Come back to polished deliverables.",
          href: "/work",
        },
        {
          title: "Codex",
          body: "Coding agents across chat, editor, and terminal.",
          href: "/codex",
        },
        {
          title: "Plans",
          body: "Free through Enterprise.",
          href: "/plans",
        },
        {
          title: "Business",
          body: "Shared workspace with admin controls.",
          href: "/business",
        },
      ],
      "Go further",
    ),
    ctaBand("Try Clauxen today", "Sign in and start a conversation in seconds."),
  ],
);
