import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../../_components/marketing-placeholder";

const FEATURES: Record<string, { title: string; description: string }> = {
  "deep-research": {
    title: "Deep Research",
    description:
      "Run multi-step research that reads, cross-checks, and cites sources for you.",
  },
  dots: {
    title: "Dots",
    description: "Connect ideas and see how your thinking fits together.",
  },
  images: {
    title: "Images",
    description:
      "Create images from a prompt, explore visual directions, or generate designs.",
  },
  plugins: {
    title: "Plugins",
    description:
      "Extend Clauxen with connected apps and tools you already use.",
  },
  remote: {
    title: "Remote",
    description: "Work with Clauxen from anywhere, on any device.",
  },
  shopping: {
    title: "Shopping",
    description: "Compare options and find what fits your needs and budget.",
  },
  sites: {
    title: "Sites",
    description: "Research and reason across the live web.",
  },
  space: {
    title: "Space",
    description: "A shared workspace for files, context, and ongoing projects.",
  },
  "study-mode": {
    title: "Study Mode",
    description: "Learn step by step with guided explanations and practice.",
  },
  voice: {
    title: "Voice",
    description: "Talk with Clauxen in real time when speaking is easier than typing.",
  },
  "voice-with-video": {
    title: "Voice with Video",
    description: "Talk face to face and share what you see in real time.",
  },
  "chat-with-pdfs": {
    title: "Chat with PDFs",
    description: "Ask questions about any PDF and get answers with citations.",
  },
  "chatgpt-in-slack-and-teams": {
    title: "Clauxen in Slack and Teams",
    description: "Bring your assistant into the chat tools your team already uses.",
  },
};

export function generateStaticParams() {
  return Object.keys(FEATURES).map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Features - Clauxen",
  description: "Explore what Clauxen can do.",
};

type FeaturePageProps = { params: Promise<{ slug: string }> };

export default async function FeaturePage({ params }: FeaturePageProps) {
  const { slug } = await params;
  const feature = FEATURES[slug];
  if (!feature) notFound();

  return (
    <MarketingPlaceholder
      eyebrow="Features"
      title={feature.title}
      description={feature.description}
    />
  );
}
