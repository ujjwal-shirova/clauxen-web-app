import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PluginDetailView } from "@/components/plugins/plugin-detail-view";
import { getPluginByRouteSegment } from "@/server/plugins/catalog";

type PluginPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PluginPageProps): Promise<Metadata> {
  const { slug } = await params;
  const plugin = await getPluginByRouteSegment(slug);
  return plugin
    ? {
        title: `${plugin.name} plugin - Clauxen`,
        description: plugin.description,
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

  return (
    <PluginDetailView plugin={plugin} returnCategory={rawCategory ?? null} />
  );
}
