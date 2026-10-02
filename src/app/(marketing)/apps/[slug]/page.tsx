import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../../_components/marketing-placeholder";

const APPS: Record<string, { title: string; description: string }> = {
  canva: {
    title: "Canva",
    description: "Design presentations, social posts, and more without leaving the chat.",
  },
  spotify: {
    title: "Spotify",
    description: "Find music, build playlists, and explore what to listen to next.",
  },
  powerpoint: {
    title: "PowerPoint",
    description: "Turn ideas and documents into polished slide decks.",
  },
};

export function generateStaticParams() {
  return Object.keys(APPS).map((slug) => ({ slug }));
}

export const metadata: Metadata = marketingPlaceholderMetadata(
  "Apps",
  "Connect Clauxen to the apps you already use.",
);

type AppPageProps = { params: Promise<{ slug: string }> };

export default async function AppPage({ params }: AppPageProps) {
  const { slug } = await params;
  const app = APPS[slug];
  if (!app) notFound();

  return (
    <MarketingPlaceholder
      eyebrow="Apps"
      title={`${app.title} in Clauxen`}
      description={app.description}
    />
  );
}
