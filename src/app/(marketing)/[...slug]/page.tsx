import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPageView } from "@/website/components/marketing-page-view";
import {
  allMarketingPaths,
  getMarketingPage,
  metadataForPage,
} from "@/website/content";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return allMarketingPaths().map((path) => ({
    slug: path.replace(/^\//, "").split("/"),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return metadataForPage("/" + slug.join("/"));
}

export default async function MarketingCatchAllPage({ params }: Props) {
  const { slug } = await params;
  const page = getMarketingPage("/" + slug.join("/"));
  if (!page) notFound();
  return <MarketingPageView page={page} />;
}
