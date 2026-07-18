import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPageView } from "@/website/components/marketing-page-view";
import {
  allMarketingPaths,
  getMarketingPage,
  metadataForPage,
} from "@/website/content/pages";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return allMarketingPaths().map((path) => ({
    slug: path.replace(/^\//, "").split("/"),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = "/" + slug.join("/");
  return metadataForPage(path);
}

export default async function MarketingCatchAllPage({ params }: Props) {
  const { slug } = await params;
  const path = "/" + slug.join("/");
  const page = getMarketingPage(path);
  if (!page) notFound();
  return <MarketingPageView page={page} />;
}
