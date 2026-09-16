import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PluginDetailView } from "@/connectors/ui/plugins/plugin-detail-view";
import {
  getPluginByRouteSegment,
  getRelatedPlugins,
} from "@/connectors/server/plugins/catalog";

type PluginPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: PluginPageProps): Promise<Metadata> {
  const { slug } = await params;
  const plugin = await getPluginByRouteSegment(slug);
  return plugin
    ? {
        title: `${plugin.displayName || plugin.name} Plugin - Clauxen`,
        description:
          plugin.shortDescription ||
          plugin.description ||
          `Use the ${plugin.displayName} plugin with Clauxen.`,
      }
    : { title: "Plugin not found - Clauxen" };
}

export default async function PluginPage({
  params,
  searchParams,
}: PluginPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const plugin = await getPluginByRouteSegment(slug);
  if (!plugin) notFound();

  const rawCategory = Array.isArray(query.category)
    ? query.category[0]
    : query.category;

  const related = await getRelatedPlugins(plugin, 6);

  return (
    <PluginDetailView
      plugin={plugin}
      relatedPlugins={related}
      returnCategory={rawCategory ?? null}
    />
  );
}
