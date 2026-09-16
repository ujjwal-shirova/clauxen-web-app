import "server-only";

import type {
  PluginCatalogItem,
  PluginDirectoryResponse,
  PluginSummary,
} from "@/connectors/catalog/types";
import {
  CLAUXEN_APPS_CATEGORY,
  getRestConnector,
  isRestConnectorId,
  listRestConnectorSummaries,
  matchRestConnectors,
  REST_CONNECTORS,
  restConnectorSummary,
} from "@/connectors/catalog/rest-directory";
import {
  getPluginByRouteSegment,
  getPluginDirectory,
  getPluginsByIds,
  getRelatedPlugins,
} from "@/connectors/server/plugins/catalog";

function withMcpKind(plugin: PluginSummary): PluginSummary {
  return { ...plugin, kind: plugin.kind ?? "mcp" };
}

function withMcpItem(plugin: PluginCatalogItem): PluginCatalogItem {
  return { ...plugin, kind: plugin.kind ?? "mcp" };
}

export async function getConnectorDirectory({
  category: requestedCategory,
  query: rawQuery = "",
  page: rawPage = 1,
  pageSize: rawPageSize = 48,
  overview = false,
}: {
  category?: string | null;
  query?: string | null;
  page?: number;
  pageSize?: number;
  overview?: boolean;
} = {}): Promise<PluginDirectoryResponse> {
  const query = (rawQuery ?? "").trim();
  const category = requestedCategory || null;
  const page = Math.max(1, Math.floor(rawPage) || 1);

  const pluginDir = await getPluginDirectory({
    category: category === "clauxen-apps" ? null : category,
    query,
    page,
    pageSize: rawPageSize,
    overview: overview && !query && !category,
  });

  const categories = [CLAUXEN_APPS_CATEGORY, ...pluginDir.categories];
  const restAll = query
    ? matchRestConnectors(query)
    : REST_CONNECTORS;
  const restFiltered = category
    ? restAll.filter((item) => item.categories.includes(category))
    : restAll;
  const restSummaries = restFiltered.map(restConnectorSummary);

  if (overview && !query && !category) {
    return {
      ...pluginDir,
      categories,
      total: pluginDir.total + REST_CONNECTORS.length,
      sections: [
        {
          ...CLAUXEN_APPS_CATEGORY,
          plugins: listRestConnectorSummaries(),
        },
        ...(pluginDir.sections ?? []).map((section) => ({
          ...section,
          plugins: section.plugins.map(withMcpKind),
        })),
      ],
    };
  }

  if (category === "clauxen-apps") {
    const pageSize = Math.min(96, Math.max(12, Math.floor(rawPageSize) || 48));
    const start = (page - 1) * pageSize;
    const plugins = restSummaries.slice(start, start + pageSize);
    return {
      categories,
      category: CLAUXEN_APPS_CATEGORY,
      query: query.toLocaleLowerCase(),
      total: restSummaries.length,
      page,
      pageSize,
      hasMore: start + plugins.length < restSummaries.length,
      plugins,
    };
  }

  const plugins = [
    ...(page === 1 ? restSummaries : []),
    ...pluginDir.plugins.map(withMcpKind),
  ];

  return {
    ...pluginDir,
    categories,
    category:
      pluginDir.category ??
      (category === CLAUXEN_APPS_CATEGORY.slug ? CLAUXEN_APPS_CATEGORY : null),
    total: pluginDir.total + restSummaries.length,
    plugins,
  };
}

export async function getConnectorByRouteSegment(segment: string) {
  const rest = getRestConnector(segment);
  if (rest) return rest;
  const plugin = await getPluginByRouteSegment(segment);
  return plugin ? withMcpItem(plugin) : null;
}

export async function getConnectorsByIds(
  ids: string[],
): Promise<PluginSummary[]> {
  if (ids.length === 0) return [];
  const restHits: PluginSummary[] = [];
  const pluginIds: string[] = [];
  for (const id of ids) {
    const rest = getRestConnector(id);
    if (rest) restHits.push(restConnectorSummary(rest));
    else pluginIds.push(id);
  }
  const plugins = (await getPluginsByIds(pluginIds)).map(withMcpKind);
  const byId = new Map(
    [...restHits, ...plugins].map((item) => [item.id, item]),
  );
  return ids
    .map((id) => byId.get(id) ?? byId.get(decodeURIComponent(id)))
    .filter((item): item is PluginSummary => Boolean(item));
}

export async function getRelatedConnectors(
  connector: PluginCatalogItem,
  limit = 6,
): Promise<PluginSummary[]> {
  if (connector.kind === "rest" || isRestConnectorId(connector.id)) {
    const others = REST_CONNECTORS.filter((item) => item.id !== connector.id)
      .map(restConnectorSummary)
      .slice(0, Math.min(3, limit));
    const relatedPlugins = await getRelatedPlugins(connector, limit);
    const combined = [...others];
    for (const plugin of relatedPlugins.map(withMcpKind)) {
      if (combined.length >= limit) break;
      if (!combined.some((item) => item.id === plugin.id)) {
        combined.push(plugin);
      }
    }
    return combined.slice(0, limit);
  }

  const related = (await getRelatedPlugins(connector, limit)).map(withMcpKind);
  const restMatches = REST_CONNECTORS.filter((item) =>
    item.categories.some((slug) => connector.categories.includes(slug)),
  )
    .map(restConnectorSummary)
    .slice(0, 2);
  return [...restMatches, ...related].slice(0, limit);
}
