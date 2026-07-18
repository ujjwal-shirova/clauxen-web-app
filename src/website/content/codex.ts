import { definePage } from "@/website/lib/types";
import {
  CTA,
  ctaBand,
  features,
  hero,
  linkGrid,
} from "@/website/content/_helpers";

export const codexPage = definePage(
  "/codex",
  "Codex",
  "Clauxen Codex — coding agents across chat, editor, and terminal.",
  [
    hero(
      "Codex in Clauxen",
      "Build, debug, and ship where you work best. The same agent in chat, your IDE, and the CLI.",
      {
        eyebrow: "Coding",
        primaryCta: CTA.tryApp,
        secondaryCta: { label: "Codex pricing", href: "/codex/pricing" },
      },
    ),
    features(
      [
        {
          title: "End-to-end tasks",
          body: "Features, refactors, migrations, and tests — from understanding to a review-ready change.",
        },
        {
          title: "Where you already code",
          body: "Stay in the editor and terminal. Preview servers, review diffs, and monitor PRs.",
        },
        {
          title: "Enterprise-ready",
          body: "Admin visibility and secure workspaces on Business and Enterprise.",
        },
      ],
      "Ship with confidence",
    ),
    linkGrid(
      [
        {
          title: "Engineering solutions",
          body: "Patterns for software teams.",
          href: "/business/ai-for-engineering",
        },
        {
          title: "Plans",
          body: "Codex usage scales with your plan.",
          href: "/plans",
        },
      ],
      "Next steps",
    ),
    ctaBand("Try Codex"),
  ],
);

export const codexPricingPage = definePage(
  "/codex/pricing",
  "Codex pricing",
  "Codex is included in Clauxen plans — usage scales by tier.",
  [
    hero(
      "Codex pricing",
      "Included from Free through Enterprise. Higher plans unlock more capacity, seats, and admin controls.",
      {
        primaryCta: CTA.viewPlans,
        secondaryCta: CTA.contactSales,
      },
    ),
    features(
      [
        {
          title: "Individuals",
          body: "Free through Pro include Codex with plan-based limits and optional credits.",
        },
        {
          title: "Business",
          body: "Org-wide seats, SSO, and connectors for engineering teams.",
        },
        {
          title: "Enterprise",
          body: "Flexible usage, compliance controls, and priority processing.",
        },
      ],
      "What’s included",
    ),
    ctaBand("Choose a plan", undefined, CTA.viewPlans, CTA.contactSales),
  ],
);
