import type { Metadata } from "next";
import {
  findMcpPluginBySlug,
  listMcpPluginSlugs,
  toPluginInfoData,
} from "@/lib/mcp-plugin-dataset";
import marketplaceCatalogJson from "@/components/plugins/marketplace-catalog.json";
import {
  PluginInfoNotFound,
  PluginInfoPage,
} from "@/components/plugins/plugin-info-page";
import { stripCursorText } from "@/components/plugins/plugin-copy";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const marketplaceIds = marketplaceCatalogJson as {
  discover: string[];
  sections: Array<{ pluginIds: string[] }>;
};

/**
 * Prerender every plugin detail page at build time. The catalog is scraped
 * into the repo (public/data/mcp-plugins.json), so each page is served as a
 * static RSC payload instead of a per-navigation server round-trip.
 */
export async function generateStaticParams() {
  const slugs = new Set<string>();
  for (const id of marketplaceIds.discover) slugs.add(id);
  for (const section of marketplaceIds.sections) {
    for (const id of section.pluginIds) slugs.add(id);
  }
  for (const slug of await listMcpPluginSlugs()) slugs.add(slug);
  return [...slugs].map((slug) => ({ slug }));
}

// Slugs outside the catalog still render on demand (plugin not found).
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const plugin = await findMcpPluginBySlug(slug).catch(() => null);
  if (!plugin) return { title: "Plugin not found" };
  const name =
    stripCursorText(plugin.displayName || plugin.name) ||
    plugin.name ||
    "Plugin";
  return {
    title: name,
    description: plugin.description ?? undefined,
  };
}

export default async function PluginInfoRoutePage({ params }: PageProps) {
  const { slug } = await params;
  const plugin = await findMcpPluginBySlug(slug).catch(() => null);

  // Graceful fallback for catalog ids that predate the scraped dataset.
  if (!plugin) return <PluginInfoNotFound slug={slug} />;

  return <PluginInfoPage slug={slug} plugin={toPluginInfoData(plugin)} />;
}
