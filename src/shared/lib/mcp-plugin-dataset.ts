/**
 * Loader for the scraped plugin/MCP dataset (public/data/mcp-plugins.json).
 *
 * The dataset is produced by `scripts/cursor-marketplace/fetch_marketplace.py`
 * and committed to the repo, so pages that use it can read it from disk at
 * build/request time on the server — no runtime API dependency.
 *
 * Server-side only: imports `node:fs`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export type McpPluginPublisher = {
  name: string;
  displayName?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  isVerified?: boolean;
  pageUrl?: string | null;
};

export type McpPluginSkill = {
  name: string;
  description: string;
};

export type McpPluginCommand = {
  name: string;
  description: string;
  sourceUrl?: string | null;
};

export type McpPluginHook = {
  name: string;
  description: string;
  sourceUrl?: string | null;
};

export type McpPluginRule = {
  name: string;
  description: string;
  sourcePath?: string | null;
  sourceUrl?: string | null;
};

export type McpPluginSubagent = {
  name: string;
  description: string;
};

export type McpServerEntry = {
  name: string;
  type: string;
  url: string | null;
  command: string | null;
  args: string[] | null;
  envVarNames: string[] | null;
};

export type McpPlugin = {
  id: string;
  name: string;
  displayName: string | null;
  description: string;
  detailPageUrl?: string | null;
  installUrl?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  tags?: string[];
  curatedCategories?: string[];
  isDeprecated?: boolean;
  deprecationMessage?: string | null;
  repositoryUrl?: string | null;
  gitUrl?: string | null;
  fullRef: string;
  publisher?: McpPluginPublisher | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  skills: McpPluginSkill[];
  commands: McpPluginCommand[];
  hooks: McpPluginHook[];
  rules: McpPluginRule[];
  subagents: McpPluginSubagent[];
  declaredMcpServers?: Array<{ name: string; description?: string | null }> | null;
  mcp: {
    configSourceUrl?: string | null;
    configFetchError?: string | null;
    pinnedRefMissing?: boolean;
    servers: McpServerEntry[];
    endpoints: { http: number; stdio: number; urls: string[] };
  };
};

export type McpPluginDataset = {
  source: string;
  generatedAt: string;
  plugins: McpPlugin[];
};

type DatasetCache = {
  promise?: Promise<McpPluginDataset>;
};

const globalCache = globalThis as typeof globalThis & {
  __clauxenMcpPluginDataset?: DatasetCache;
};

async function readDataset(): Promise<McpPluginDataset> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "mcp-plugins.json",
  );
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as McpPluginDataset;
}

/** Full scraped dataset (cached for the lifetime of the server process). */
export function loadMcpPluginDataset(): Promise<McpPluginDataset> {
  const cache = (globalCache.__clauxenMcpPluginDataset ??= {});
  cache.promise ??= readDataset().catch((error) => {
    cache.promise = undefined;
    throw error;
  });
  return cache.promise;
}

/** Lowercase alphanumeric fingerprint used for slug matching. */
function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a URL slug (usually the marketplace catalog id) to a dataset
 * record. Matches fullRef, name, or displayName ignoring separators, e.g.
 * "neon-postgres" → fullRef "neon-postgres", "appwrite" → displayName
 * "Appwrite" (fullRef "appwrite-plugin").
 */
export async function findMcpPluginBySlug(
  slug: string,
): Promise<McpPlugin | null> {
  const dataset = await loadMcpPluginDataset();
  const needle = normalizeSlug(slug);
  if (!needle) return null;

  for (const plugin of dataset.plugins) {
    if (plugin.fullRef === slug || plugin.name === slug) return plugin;
  }
  for (const plugin of dataset.plugins) {
    if (normalizeSlug(plugin.fullRef) === needle) return plugin;
    if (normalizeSlug(plugin.name) === needle) return plugin;
    if (plugin.displayName && normalizeSlug(plugin.displayName) === needle) {
      return plugin;
    }
  }
  return null;
}
