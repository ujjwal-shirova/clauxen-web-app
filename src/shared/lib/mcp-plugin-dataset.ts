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

/** Server summary passed to the client for live tool discovery. */
export type McpServerSummary = {
  name: string;
  type: string;
  url: string | null;
  command: string | null;
  args: string[] | null;
};

/**
 * Trimmed plugin payload for the info page client component. Keeps the RSC
 * payload small by dropping fields the page never renders.
 */
export type PluginInfoData = {
  name: string;
  displayName: string | null;
  description: string;
  logoUrl: string | null;
  repositoryUrl: string | null;
  publisher: {
    name: string;
    displayName: string | null;
    isVerified: boolean;
  } | null;
  mcpServers: McpServerSummary[];
  skills: McpPluginSkill[];
  commands: McpPluginCommand[];
  hooks: McpPluginHook[];
  rules: McpPluginRule[];
  subagents: McpPluginSubagent[];
};

export function toPluginInfoData(plugin: McpPlugin): PluginInfoData {
  return {
    name: plugin.name,
    displayName: plugin.displayName,
    description: plugin.description,
    logoUrl: plugin.logoUrl ?? null,
    repositoryUrl: plugin.repositoryUrl ?? plugin.gitUrl ?? null,
    publisher: plugin.publisher
      ? {
          name: plugin.publisher.name,
          displayName: plugin.publisher.displayName ?? null,
          isVerified: Boolean(plugin.publisher.isVerified),
        }
      : null,
    mcpServers: plugin.mcp.servers.map((server) => ({
      name: server.name,
      type: server.type,
      url: server.url,
      command: server.command,
      args: server.args,
    })),
    skills: plugin.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    commands: plugin.commands.map((command) => ({
      name: command.name,
      description: command.description,
      sourceUrl: command.sourceUrl ?? null,
    })),
    hooks: plugin.hooks.map((hook) => ({
      name: hook.name,
      description: hook.description,
      sourceUrl: hook.sourceUrl ?? null,
    })),
    rules: plugin.rules.map((rule) => ({
      name: rule.name,
      description: rule.description,
      sourceUrl: rule.sourceUrl ?? null,
    })),
    subagents: plugin.subagents.map((subagent) => ({
      name: subagent.name,
      description: subagent.description,
    })),
  };
}

type DatasetCache = {
  promise?: Promise<McpPluginDataset>;
};

type DatasetIndex = {
  exact: Map<string, McpPlugin>;
  normalized: Map<string, McpPlugin>;
  all: McpPlugin[];
};

const globalCache = globalThis as typeof globalThis & {
  __clauxenMcpPluginDataset?: DatasetCache;
  __clauxenMcpPluginIndex?: DatasetIndex;
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

function slugTokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function buildIndex(dataset: McpPluginDataset): DatasetIndex {
  const exact = new Map<string, McpPlugin>();
  const normalized = new Map<string, McpPlugin>();
  for (const plugin of dataset.plugins) {
    for (const key of [plugin.fullRef, plugin.name]) {
      if (!key) continue;
      if (!exact.has(key)) exact.set(key, plugin);
      const fingerprint = normalizeSlug(key);
      if (fingerprint && !normalized.has(fingerprint)) {
        normalized.set(fingerprint, plugin);
      }
    }
    if (plugin.displayName) {
      const fingerprint = normalizeSlug(plugin.displayName);
      if (fingerprint && !normalized.has(fingerprint)) {
        normalized.set(fingerprint, plugin);
      }
    }
  }
  return { exact, normalized, all: dataset.plugins };
}

/** Slug lookup index (built once per server process). */
async function loadIndex(): Promise<DatasetIndex> {
  const dataset = await loadMcpPluginDataset();
  return (globalCache.__clauxenMcpPluginIndex ??= buildIndex(dataset));
}

/**
 * Last-resort token-overlap match for catalog ids that don't line up with a
 * dataset ref, e.g. "atlassian-teamwork-graph" → "Atlassian Teamwork Graph
 * CLI". Requires ≥50% of the candidate's tokens to match so short slugs
 * never latch onto an unrelated plugin.
 */
function fuzzyMatch(plugins: McpPlugin[], slug: string): McpPlugin | null {
  const query = new Set(slugTokens(slug));
  if (query.size === 0) return null;

  let best: McpPlugin | null = null;
  let bestOverlap = 0;
  let bestPrecision = 0;

  for (const plugin of plugins) {
    const candidate = new Set(
      slugTokens(`${plugin.fullRef} ${plugin.name} ${plugin.displayName ?? ""}`),
    );
    if (candidate.size === 0) continue;

    let overlap = 0;
    for (const token of query) {
      if (candidate.has(token)) overlap += 1;
    }
    if (overlap === 0) continue;

    const precision = overlap / candidate.size;
    if (precision < 0.5) continue;

    if (
      overlap > bestOverlap ||
      (overlap === bestOverlap && precision > bestPrecision)
    ) {
      best = plugin;
      bestOverlap = overlap;
      bestPrecision = precision;
    }
  }
  return best;
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
  const index = await loadIndex();
  const needle = normalizeSlug(slug);
  if (!needle) return null;

  const direct =
    index.exact.get(slug) ??
    index.normalized.get(needle) ??
    fuzzyMatch(index.all, slug);
  return direct ?? null;
}

/** All URL-safe slug spellings of dataset plugins (for static prerendering). */
export async function listMcpPluginSlugs(): Promise<string[]> {
  const index = await loadIndex();
  const slugs = new Set<string>();
  for (const plugin of index.all) {
    for (const key of [plugin.fullRef, plugin.name]) {
      // Only single URL-safe segments — names can contain "/" or spaces.
      if (key && /^[A-Za-z0-9._~-]+$/.test(key)) slugs.add(key);
    }
  }
  return [...slugs];
}
