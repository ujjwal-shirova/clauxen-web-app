import { definePage } from "@/marketing/lib/types";
import {
  CTA,
  ctaBand,
  features,
  hero,
  linkGrid,
} from "@/marketing/content/_helpers";

export const featuresPage = definePage(
  "/features",
  "Features",
  "Clauxen features — models, memory, projects, connectors, canvas, and agents.",
  [
    hero(
      "Built for real work",
      "From everyday chat to multi-step agents — with privacy controls for individuals and teams.",
    ),
    features(
      [
        {
          title: "Advanced models",
          body: "Frontier reasoning for chat, analysis, coding, and creative work.",
        },
        {
          title: "Projects & memory",
          body: "Organize threads and files; keep useful context across conversations.",
        },
        {
          title: "Connectors & skills",
          body: "Plug into Drive, Slack, GitHub, and more — or package workflows as skills.",
        },
        {
          title: "Canvas",
          body: "Collaborate on documents and code in a dedicated side panel.",
        },
        {
          title: "Deep research",
          body: "Multi-step research with sources for reports and decisions.",
        },
        {
          title: "Image generation",
          body: "Create and iterate on visuals alongside chat.",
        },
      ],
      "Capabilities",
    ),
    linkGrid(
      [
        {
          title: "Work agent",
          body: "Goals to finished deliverables",
          href: "/features/agent",
        },
        { title: "Codex", body: "Coding agents", href: "/codex" },
        { title: "Canvas", body: "Docs and code side-by-side", href: "/canvas" },
        { title: "Download", body: "Desktop and mobile", href: "/download" },
      ],
      "Deep dives",
    ),
    ctaBand("Explore in the product"),
  ],
);

export const featuresAgentPage = definePage(
  "/features/agent",
  "Work agent",
  "Clauxen Work — an agent that gathers context and produces polished deliverables.",
  [
    hero(
      "Introducing Clauxen Work",
      "Work brings together your apps, files, and browser context to create polished docs, decks, and more — while you stay in control.",
      { eyebrow: "Agent", primaryCta: CTA.tryApp },
    ),
    features(
      [
        {
          title: "From goals to finished work",
          body: "Give Work an outcome. It gathers context, plans, and checks in when judgment matters.",
        },
        {
          title: "Work from anywhere",
          body: "Steer on web and mobile; use desktop for local files and deeper workflows.",
        },
        {
          title: "Schedule and watch",
          body: "Recurring work so projects keep moving without constant prompting.",
        },
      ],
      "How it works",
    ),
    ctaBand("Try Work in Clauxen", "Available on supported plans."),
  ],
);

export const canvasPage = definePage(
  "/canvas",
  "Canvas",
  "Clauxen Canvas — collaborate on documents and code beside chat.",
  [
    hero(
      "Canvas",
      "Open a side panel to draft, edit, and refine documents or code — without losing the chat thread.",
    ),
    features(
      [
        {
          title: "Targeted edits",
          body: "Select passages or functions and ask Clauxen to revise in place.",
        },
        {
          title: "Version as you go",
          body: "Iterate safely and compare changes as the draft evolves.",
        },
        {
          title: "Run code",
          body: "Execute and inspect results alongside the conversation.",
        },
      ],
      "Why Canvas",
    ),
    ctaBand("Open Canvas in chat"),
  ],
);

export const atlasPage = definePage(
  "/atlas",
  "Atlas",
  "Clauxen Atlas — browse with Clauxen built in.",
  [
    hero(
      "Clauxen Atlas",
      "Browse with Clauxen beside you — understand the page you’re on and complete tasks without copy-paste.",
      { eyebrow: "Browser" },
    ),
    features(
      [
        {
          title: "In-page assistance",
          body: "Ask about what you see in a side panel.",
        },
        {
          title: "Agent mode",
          body: "Approve multi-step actions across the web when you want help.",
        },
        {
          title: "Memory",
          body: "Carry relevant chat context into browsing when enabled.",
        },
      ],
      "What’s coming",
    ),
    ctaBand("Learn more", "Rolling out on supported platforms."),
  ],
);
