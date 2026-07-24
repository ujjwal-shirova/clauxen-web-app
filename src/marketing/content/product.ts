import type { MarketingPage } from "@/marketing/lib/types";
import { definePage } from "@/marketing/lib/types";
import {
  ctaBand,
  features,
  hero,
  linkGrid,
  minimalProductPage,
} from "@/marketing/content/_helpers";

export const productOverviewPage = definePage(
  "/product/overview",
  "Product overview",
  "Clauxen product surface — chat, Work, Codex, Canvas, and more.",
  [
    hero(
      "One workspace for thinking work",
      "Chat when you need a partner. Work when you need finished artifacts. Codex when you need to ship code.",
      { eyebrow: "Product" },
    ),
    features(
      [
        {
          title: "Chat",
          body: "Everyday questions, deep research, writing, and analysis with memory across conversations.",
        },
        {
          title: "Work",
          body: "Goal-driven tasks across files and tools — polished deliverables for your review.",
        },
        {
          title: "Codex",
          body: "Coding agents in chat, IDE, and terminal with enterprise controls when you need them.",
        },
      ],
      "The Clauxen suite",
    ),
    linkGrid(
      [
        { title: "Work", body: "Agentic deliverables", href: "/product/cowork" },
        { title: "Design", body: "On-brand creative work", href: "/product/design" },
        { title: "Tag", body: "Knowledge across teams", href: "/product/tag" },
        { title: "Security", body: "Controls and hardening", href: "/product/clauxen-security" },
        { title: "Science", body: "Research workflows", href: "/product/clauxen-science" },
        { title: "Features", body: "Full capability list", href: "/features" },
      ],
      "Explore products",
    ),
    ctaBand("Open Clauxen"),
  ],
);

export const productPages: MarketingPage[] = [
  productOverviewPage,
  minimalProductPage({
    path: "/product/cowork",
    title: "Work",
    description: "Clauxen Work — goals to polished deliverables.",
    eyebrow: "Product",
    headline: "Clauxen Work",
    subtitle:
      "Hand off a task. Clauxen works across your tools and returns finished work for review.",
    points: [
      {
        title: "Steer from anywhere",
        body: "Start on desktop, check in from mobile, redirect mid-flight.",
      },
      {
        title: "Files and tools",
        body: "Operate in the folders and connectors you approve.",
      },
      {
        title: "Review, don’t retype",
        body: "Decks, docs, and sheets ready for sign-off.",
      },
    ],
  }),
  minimalProductPage({
    path: "/product/design",
    title: "Design",
    description: "Stay on brand for everyday creative work in Clauxen.",
    eyebrow: "Product",
    headline: "Clauxen Design",
    subtitle: "Create visuals and layouts that stay on brand for daily work.",
    points: [
      {
        title: "On-brand by default",
        body: "Guidelines and examples keep outputs consistent.",
      },
      {
        title: "Iterate in Canvas",
        body: "Refine designs beside the conversation.",
      },
      {
        title: "Ship to the team",
        body: "Export or hand off into Work deliverables.",
      },
    ],
  }),
  minimalProductPage({
    path: "/product/tag",
    title: "Tag",
    description: "Organize and retrieve knowledge across Clauxen workspaces.",
    eyebrow: "Product",
    headline: "Clauxen Tag",
    subtitle: "Structure knowledge so teams find the right context fast.",
    points: [
      {
        title: "Organize once",
        body: "Tag projects, chats, and files with shared vocabulary.",
      },
      {
        title: "Retrieve with chat",
        body: "Ask in natural language; grounded answers follow.",
      },
      {
        title: "Admin ready",
        body: "Works with Business workspace controls.",
      },
    ],
  }),
  minimalProductPage({
    path: "/product/clauxen-security",
    title: "Security",
    description: "Security capabilities and controls for Clauxen.",
    eyebrow: "Product",
    headline: "Clauxen Security",
    subtitle: "Protect conversations, code, and company data with layered controls.",
    points: [
      {
        title: "Identity",
        body: "SSO, MFA, and role-based access on Business and Enterprise.",
      },
      {
        title: "Data posture",
        body: "Encryption in transit and at rest; no training on business data by default.",
      },
      {
        title: "Visibility",
        body: "Auditability and admin analytics as you scale.",
      },
    ],
  }),
  minimalProductPage({
    path: "/product/clauxen-science",
    title: "Science",
    description: "Scientific research workflows in Clauxen.",
    eyebrow: "Product",
    headline: "Clauxen Science",
    subtitle: "An AI workbench for literature, analysis, and research notes.",
    points: [
      {
        title: "Literature",
        body: "Survey papers and summarize methods with sources.",
      },
      {
        title: "Analysis",
        body: "Work through data and code in one thread.",
      },
      {
        title: "Lab notes",
        body: "Keep projects organized for collaborators.",
      },
    ],
  }),
];
