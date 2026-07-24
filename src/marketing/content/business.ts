import type { MarketingPage } from "@/marketing/lib/types";
import { definePage } from "@/marketing/lib/types";
import {
  CTA,
  bullets,
  ctaBand,
  features,
  hero,
  linkGrid,
  minimalProductPage,
} from "@/marketing/content/_helpers";

export const businessHomePage = definePage(
  "/business",
  "Business",
  "Clauxen Business — secure workspace with admin controls for teams.",
  [
    hero(
      "Clauxen for business",
      "A secure shared workspace with company context, connectors, and admin controls — so every team finishes more work.",
      {
        eyebrow: "Business",
        primaryCta: { label: "Try Business", href: "/login" },
        secondaryCta: CTA.contactSales,
      },
    ),
    features(
      [
        {
          title: "Work & Codex",
          body: "Turn goals into deliverables and ship code with company context.",
        },
        {
          title: "Connect your stack",
          body: "Drive, Slack, GitHub, Notion, and more — governed by admins.",
        },
        {
          title: "Privacy by default",
          body: "Business data excluded from training. SSO and MFA included.",
        },
      ],
      "Why teams choose Business",
    ),
    linkGrid(
      [
        {
          title: "Business plan",
          body: "What’s included",
          href: "/business/business-plan",
        },
        {
          title: "Enterprise",
          body: "Security at scale",
          href: "/business/enterprise",
        },
        {
          title: "Education",
          body: "Campus-wide AI",
          href: "/business/education",
        },
        {
          title: "Engineering",
          body: "Codex for software teams",
          href: "/business/ai-for-engineering",
        },
        {
          title: "Finance",
          body: "Analysis with guardrails",
          href: "/business/ai-for-finance",
        },
        {
          title: "Sales & marketing",
          body: "Pipeline and campaigns",
          href: "/business/ai-for-sales-marketing",
        },
      ],
      "Explore",
    ),
    ctaBand("Bring Clauxen to your team"),
  ],
);

export const businessPages: MarketingPage[] = [
  businessHomePage,
  definePage(
    "/business/business-plan",
    "Business plan",
    "Clauxen Business plan details — workspace, SSO, connectors.",
    [
      hero(
        "Business plan",
        "Shared workspace, admin console, and essential security for growing companies.",
        { primaryCta: { label: "Get started", href: "/login" } },
      ),
      bullets("Includes", [
        "Dedicated workspace and admin console",
        "SAML SSO and MFA",
        "Connectors to company tools",
        "Usage analytics and spend controls",
        "No training on business data by default",
        "Encryption in transit and at rest",
      ]),
      ctaBand("Start Business"),
    ],
  ),
  definePage(
    "/business/enterprise",
    "Enterprise",
    "Clauxen Enterprise — frontier AI with security, compliance, and support.",
    [
      hero(
        "The frontier, on every desk",
        "Put Clauxen to work across your organization. Help everyone think deeper, do more, and build securely.",
        {
          eyebrow: "Enterprise",
          primaryCta: CTA.contactSales,
          secondaryCta: { label: "See Business", href: "/business" },
        },
      ),
      features(
        [
          {
            title: "Security & compliance",
            body: "SCIM, EKM, auditability, custom retention, and data residency options.",
          },
          {
            title: "Work & Codex at scale",
            body: "Agentic workflows across docs and codebases with governance.",
          },
          {
            title: "Success partnership",
            body: "Playbooks, training, SLAs, and advisors for eligible customers.",
          },
        ],
        "Built for scale",
      ),
      ctaBand("Talk to sales", undefined, CTA.contactSales, {
        label: "View plans",
        href: "/plans",
      }),
    ],
  ),
  definePage(
    "/business/education",
    "Education",
    "Clauxen Edu for campuses — students, faculty, and research.",
    [
      hero(
        "Bring AI to campus",
        "Deploy Clauxen for students, faculty, and campus operations with admin controls and strong privacy.",
        { primaryCta: CTA.contactSales },
      ),
      features(
        [
          {
            title: "Campus-wide access",
            body: "Higher limits and tools for teaching, learning, and research.",
          },
          {
            title: "IT controls",
            body: "SSO, SCIM, and analytics for administrators.",
          },
          {
            title: "Privacy first",
            body: "No training on education data by default.",
          },
        ],
        "Clauxen Edu",
      ),
      ctaBand("Talk to education sales", undefined, CTA.contactSales),
    ],
  ),
  minimalProductPage({
    path: "/business/ai-for-engineering",
    title: "Engineering",
    description: "Clauxen for engineering teams.",
    eyebrow: "Solutions",
    headline: "Clauxen for engineering",
    subtitle:
      "Plan smarter, code efficiently, and deploy reliably — with Codex in a secure workspace.",
    points: [
      {
        title: "Codex agent",
        body: "Write, debug, and ship with review-ready changes.",
      },
      {
        title: "Connected tools",
        body: "GitHub, GitLab, Linear, Slack, and more.",
      },
      {
        title: "Protected code",
        body: "Enterprise identity and access controls.",
      },
    ],
  }),
  minimalProductPage({
    path: "/business/ai-for-finance",
    title: "Finance",
    description: "Clauxen for finance teams.",
    eyebrow: "Solutions",
    headline: "Clauxen for finance",
    subtitle:
      "Analyze statements, forecast, and report — with privacy controls for sensitive data.",
    points: [
      {
        title: "Instant analysis",
        body: "KPIs, cash flow, and filings in seconds.",
      },
      {
        title: "Connected sources",
        body: "Pull from Drive, Slack, and finance systems.",
      },
      {
        title: "Compliant by design",
        body: "SSO, roles, and no training on business data by default.",
      },
    ],
  }),
  minimalProductPage({
    path: "/business/ai-for-sales-marketing",
    title: "Sales & marketing",
    description: "Clauxen for sales and marketing teams.",
    eyebrow: "Solutions",
    headline: "Sales & marketing",
    subtitle:
      "Collaborate on campaigns, pitches, and pipeline with secure company context.",
    points: [
      {
        title: "Campaigns",
        body: "Draft and analyze with Canvas and connectors.",
      },
      {
        title: "Pipeline",
        body: "Synthesize CRM context into next steps.",
      },
      {
        title: "Brand control",
        body: "Roles for agencies and regional teams.",
      },
    ],
  }),
];
