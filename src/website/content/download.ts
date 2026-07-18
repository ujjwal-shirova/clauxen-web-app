import { definePage } from "@/website/lib/types";
import {
  CTA,
  ctaBand,
  faq,
  features,
  hero,
} from "@/website/content/_helpers";

/** /download — Claude download pattern: desktop + mobile + FAQ. */
export const downloadPage = definePage(
  "/download",
  "Download",
  "Download Clauxen for desktop and mobile — chat, Work, and Codex in one place.",
  [
    hero(
      "Download Clauxen",
      "Chat, Work, and Codex — all in one place. Pair with the web app you already use.",
      {
        primaryCta: CTA.openWeb,
        secondaryCta: CTA.viewPlans,
        note: "Desktop and mobile builds roll out by platform. Start on the web today.",
      },
    ),
    features(
      [
        {
          title: "Desktop",
          body: "Always available from your dock. Work with local files, screenshots, and deeper agent workflows.",
        },
        {
          title: "Mobile",
          body: "Continue chats on the go. Hand tasks to desktop Work when you need more power.",
        },
        {
          title: "Web",
          body: "Full Clauxen in the browser — no install required. Same account everywhere.",
        },
      ],
      "Get started",
    ),
    faq([
      {
        q: "Do I need a paid plan for desktop or mobile?",
        a: "Apps are available across plan types. Some agent features require Plus or higher.",
      },
      {
        q: "What’s different about the desktop app?",
        a: "Quick access from the dock, local files, and extensions that connect Clauxen to tools on your machine.",
      },
      {
        q: "Can I use one account everywhere?",
        a: "Yes. Sign in once — chats, projects, and preferences sync across web, desktop, and mobile.",
      },
    ]),
    ctaBand("Open Clauxen on the web", undefined, CTA.openWeb, CTA.download),
  ],
);
