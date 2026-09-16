import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PluginDetailView } from "@/connectors/ui/plugins/plugin-detail-view";
import {
  getConnectorByRouteSegment,
  getRelatedConnectors,
} from "@/connectors/server/directory";

type ConnectorPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ConnectorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const connector = await getConnectorByRouteSegment(slug);
  const name = connector?.displayName || connector?.name;
  return connector
    ? {
        title: `${name} - Clauxen`,
        description:
          connector.shortDescription ||
          connector.description ||
          `Add ${name} to Clauxen.`,
      }
    : { title: "Connector not found - Clauxen" };
}

export default async function ConnectorAboutPage({
  params,
  searchParams,
}: ConnectorPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const connector = await getConnectorByRouteSegment(slug);
  if (!connector) notFound();

  const rawCategory = Array.isArray(query.category)
    ? query.category[0]
    : query.category;

  const related = await getRelatedConnectors(connector, 6);

  return (
    <PluginDetailView
      plugin={connector}
      relatedPlugins={related}
      returnCategory={rawCategory ?? null}
    />
  );
}
