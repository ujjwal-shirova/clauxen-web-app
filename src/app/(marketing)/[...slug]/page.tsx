import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingPageView } from "@/marketing/components/marketing-page-view";
import {
  allMarketingPaths,
  getMarketingPage,
  metadataForPage,
} from "@/marketing/content";

type Props = { params: Promise<{ slug: string[] }> };

/** In-app catalog lives at `/connectors`. Never prerender it as marketing. */
function isAppCatalogPath(path: string) {
  return (
    path === "/connectors" ||
    path.startsWith("/connectors/") ||
    path === "/plugins" ||
    path.startsWith("/plugins/")
  );
}

/** Only listed marketing URLs — so `/connectors` cannot be claimed at runtime. */
export const dynamicParams = false;

export function generateStaticParams() {
  return allMarketingPaths()
    .filter((path) => !isAppCatalogPath(path))
    .map((path) => ({
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
