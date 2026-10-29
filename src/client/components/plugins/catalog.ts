import catalogJson from "./marketplace-catalog.json";
import type { MarketplaceCatalog, MarketplacePlugin } from "./types";

export const marketplaceCatalog = catalogJson as MarketplaceCatalog;

export function pluginById(id: string): MarketplacePlugin | undefined {
  return marketplaceCatalog.plugins[id];
}

export function pluginsByIds(ids: string[]): MarketplacePlugin[] {
  return ids.flatMap((id) => {
    const plugin = marketplaceCatalog.plugins[id];
    return plugin ? [plugin] : [];
  });
}

export function pluginMatches(plugin: MarketplacePlugin, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    plugin.name.toLowerCase().includes(needle) ||
    plugin.description.toLowerCase().includes(needle) ||
    plugin.author.toLowerCase().includes(needle) ||
    plugin.category.toLowerCase().includes(needle)
  );
}
