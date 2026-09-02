export type PluginCatalogItem = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  shortDescription: string;
  longDescription: string;
  version: string;
  developer: string;
  category: string;
  capabilities: string[];
  websiteUrl: string;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  defaultPrompts: string[];
  keywords: string[];
  logoUrl: string;
  brandColor: string;
  requiresLocalExecutor: boolean;
  sourceUrl: string;
  categories: string[];
  directoryDescription: string;
  captureStatus: "detail-api" | "index-only";
  detailFetchError?: string;
  mcpUrl: string;
};

export type PluginSummary = Pick<
  PluginCatalogItem,
  | "id"
  | "name"
  | "displayName"
  | "description"
  | "shortDescription"
  | "logoUrl"
  | "brandColor"
  | "categories"
  | "captureStatus"
>;

export type PluginCategory = {
  slug: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  count: number;
};

export type PluginDirectoryResponse = {
  categories: PluginCategory[];
  category: PluginCategory | null;
  query: string;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  plugins: PluginSummary[];
  sections?: Array<PluginCategory & { plugins: PluginSummary[] }>;
};

export function pluginRouteSegment(plugin: Pick<PluginCatalogItem, "id">) {
  return encodeURIComponent(plugin.id);
}
