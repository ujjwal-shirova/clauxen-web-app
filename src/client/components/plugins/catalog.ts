import catalogJson from "./marketplace-catalog.json";
import type {
  MarketplaceCatalog,
  MarketplacePlugin,
  MarketplaceSection,
} from "./types";

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

export function defaultInstalledIds(): string[] {
  return Object.values(marketplaceCatalog.plugins)
    .filter((plugin) => plugin.installed)
    .map((plugin) => plugin.id);
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

export function filteredSections(
  query: string,
  onlyIds?: Set<string>,
): Array<MarketplaceSection & { plugins: MarketplacePlugin[] }> {
  return marketplaceCatalog.sections
    .map((section) => ({
      ...section,
      plugins: pluginsByIds(section.pluginIds).filter(
        (plugin) =>
          pluginMatches(plugin, query) &&
          (onlyIds ? onlyIds.has(plugin.id) : true),
      ),
    }))
    .filter((section) => section.plugins.length > 0);
}
