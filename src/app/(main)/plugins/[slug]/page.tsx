import type { Metadata } from "next";
import { findMcpPluginBySlug } from "@/lib/mcp-plugin-dataset";
import {
  PluginInfoNotFound,
  PluginInfoPage,
} from "@/components/plugins/plugin-info-page";
import { stripCursorText } from "@/components/plugins/plugin-copy";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const plugin = await findMcpPluginBySlug(slug).catch(() => null);
  if (!plugin) return { title: "Plugin not found" };
  const name =
    stripCursorText(plugin.displayName || plugin.name) || plugin.name;
  return {
    title: name,
    description: plugin.description,
  };
}

export default async function PluginInfoRoutePage({ params }: PageProps) {
  const { slug } = await params;
  const plugin = await findMcpPluginBySlug(slug).catch(() => null);

  // Graceful fallback for catalog ids that predate the scraped dataset.
  if (!plugin) return <PluginInfoNotFound slug={slug} />;

  return <PluginInfoPage slug={slug} plugin={plugin} />;
}
