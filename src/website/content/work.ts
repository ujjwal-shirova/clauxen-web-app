import { definePage } from "@/website/lib/types";
import {
  CTA,
  ctaBand,
  features,
  hero,
  linkGrid,
} from "@/website/content/_helpers";

/** /work — Claude Cowork pattern: goal → polished deliverable. */
export const workPage = definePage(
  "/work",
  "Work",
  "Clauxen Work completes tasks you steer from anywhere — goals to polished deliverables.",
  [
    hero(
      "The work behind your best work",
      "Give Clauxen a goal. It works across your files and tools. You come back to polished work for review.",
      {
        eyebrow: "Clauxen Work",
        primaryCta: CTA.tryApp,
        secondaryCta: CTA.contactSales,
        note: "Available on paid plans. Rolling out on web and desktop.",
      },
    ),
    features(
      [
        {
          title: "Takes on your tasks",
          body: "Works in the folders and tools you choose, end-to-end — no copy-paste out of chat.",
        },
        {
          title: "Say what, not how",
          body: "Describe the outcome. Clauxen plans the steps. You’re always in control.",
        },
        {
          title: "See the work as it happens",
          body: "Follow each step: files opened, tools used, choices made. Redirect anytime.",
        },
        {
          title: "Your work follows you",
          body: "Start at your desk, continue on your phone. Same Clauxen wherever you are.",
        },
        {
          title: "Works when you don’t",
          body: "Schedule recurring tasks. Come back to a deck, spreadsheet, or brief ready for review.",
        },
        {
          title: "More than one thing at a time",
          body: "Big projects split into parallel chunks — research, draft, and organize together.",
        },
      ],
      "Core capabilities",
    ),
    linkGrid(
      [
        {
          title: "Marketing",
          body: "Campaigns, briefs, and on-brand drafts.",
          href: "/business/ai-for-sales-marketing",
        },
        {
          title: "Sales",
          body: "Account plans and pipeline next steps.",
          href: "/business/ai-for-sales-marketing",
        },
        {
          title: "Finance",
          body: "Forecasts and leadership-ready summaries.",
          href: "/business/ai-for-finance",
        },
        {
          title: "Engineering",
          body: "Specs, reviews, and Codex handoffs.",
          href: "/business/ai-for-engineering",
        },
      ],
      "Built for every team",
    ),
    ctaBand("Try Clauxen Work", "Upgrade to a plan that includes Work."),
  ],
);
