import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  PluginCatalogItem,
  PluginCategory,
  PluginDirectoryResponse,
  PluginSummary,
} from "@/lib/plugins/types";

type RawCatalog = {
  categories: string[];
  plugins: PluginCatalogItem[];
};

const catalogPath = path.join(
  process.cwd(),
  "scripts/chatgpt-plugins/plugins.json",
);

const categoryCopy: Record<string, Omit<PluginCategory, "slug" | "count">> = {
  featured: {
    title: "Popular",
    description: "A curated selection of useful and noteworthy plugins.",
    searchPlaceholder: "Search popular plugins",
  },
  "new-and-noteworthy": {
    title: "New & Noteworthy",
    description: "Recently listed plugins worth trying.",
    searchPlaceholder: "Search new plugins",
  },
  productivity: {
    title: "Productivity",
    description: "Organize your work, automate tasks, and get more done.",
    searchPlaceholder: "Search productivity plugins",
  },
  creativity: {
    title: "Creativity",
    description: "Create with writing, design, images, audio, and more.",
    searchPlaceholder: "Search creativity plugins",
  },
  "developer-tools": {
    title: "Developer Tools",
    description: "Build, test, ship, and maintain software.",
    searchPlaceholder: "Search developer tools plugins",
  },
  "business-and-operations": {
    title: "Business & Operations",
    description: "Manage sales, marketing, support, and operations.",
    searchPlaceholder: "Search business plugins",
  },
  "data-and-analytics": {
    title: "Data & Analytics",
    description: "Explore data, uncover insights, and find clear answers.",
    searchPlaceholder: "Search data plugins",
  },
  communication: {
    title: "Communication",
    description: "Connect through email, messaging, meetings, and more.",
    searchPlaceholder: "Search communication plugins",
  },
  "education-and-research": {
    title: "Education & Research",
    description: "Learn, teach, and explore new ideas in depth.",
    searchPlaceholder: "Search research plugins",
  },
  "scientific-research": {
    title: "Scientific Research",
    description:
      "Explore scientific literature, data, methods, and discoveries.",
    searchPlaceholder: "Search scientific plugins",
  },
  security: {
    title: "Security",
    description: "Protect systems, manage access, and reduce risk.",
    searchPlaceholder: "Search security plugins",
  },
  finance: {
    title: "Finance",
    description: "Manage banking, payments, accounting, and investments.",
    searchPlaceholder: "Search finance plugins",
  },
  healthcare: {
    title: "Healthcare",
    description: "Support healthcare work, clinical needs, and wellness.",
    searchPlaceholder: "Search healthcare plugins",
  },
  travel: {
    title: "Travel",
    description: "Plan, book, and manage every part of your trip.",
    searchPlaceholder: "Search travel plugins",
  },
  entertainment: {
    title: "Entertainment",
    description: "Discover games, music, movies, and more.",
    searchPlaceholder: "Search entertainment plugins",
  },
  other: {
    title: "Other",
    description: "Explore useful plugins across a range of interests.",
    searchPlaceholder: "Search other plugins",
  },
};

let catalogPromise: Promise<RawCatalog> | null = null;

async function getCatalog(): Promise<RawCatalog> {
  catalogPromise ??= readFile(catalogPath, "utf8").then((value) => {
    const parsed = JSON.parse(value) as RawCatalog;
    const plugins = (parsed.plugins || []).filter(
      (plugin) => typeof plugin.mcpUrl === "string" && plugin.mcpUrl.length > 0,
    );
    const categories = (parsed.categories || []).filter((slug) =>
      plugins.some((plugin) => plugin.categories.includes(slug)),
    );
    return { categories, plugins };
  });
  return catalogPromise;
}

function makeSummary(plugin: PluginCatalogItem): PluginSummary {
  return {
    id: plugin.id,
    name: plugin.name || plugin.displayName,
    displayName: plugin.displayName || plugin.name,
    description:
      plugin.shortDescription ||
      plugin.description ||
      plugin.directoryDescription ||
      "",
    shortDescription: plugin.shortDescription || plugin.description || "",
    logoUrl: plugin.logoUrl || "",
    brandColor: plugin.brandColor || "",
    categories: plugin.categories || [],
    captureStatus: plugin.captureStatus,
  };
}

function categoryList(catalog: RawCatalog): PluginCategory[] {
  return catalog.categories
    .map((slug) => {
      const copy = categoryCopy[slug] ?? {
        title: slug.replace(/-/g, " "),
        description: "Explore available plugins.",
        searchPlaceholder: "Search plugins",
      };
      return {
        slug,
        ...copy,
        count: catalog.plugins.filter((plugin) =>
          plugin.categories.includes(slug),
        ).length,
      };
    })
    .filter((category) => category.count > 0);
}

function matches(plugin: PluginCatalogItem, query: string) {
  if (!query) return true;
  const haystack = [
    plugin.displayName,
    plugin.name,
    plugin.description,
    plugin.shortDescription,
    plugin.directoryDescription,
    plugin.developer,
    ...(plugin.keywords || []),
    ...(plugin.categories || []),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(query);
}

function sortPlugins(plugins: PluginCatalogItem[]) {
  return [...plugins].sort((left, right) =>
    (left.displayName || left.name).localeCompare(
      right.displayName || right.name,
    ),
  );
}

export async function getPluginDirectory({
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
  const catalog = await getCatalog();
  const categories = categoryList(catalog);
  const category =
    categories.find((item) => item.slug === requestedCategory) ?? null;
  const query = (rawQuery ?? "").trim().toLocaleLowerCase().slice(0, 180);
  const page = Math.max(1, Math.floor(rawPage) || 1);
  const pageSize = Math.min(96, Math.max(12, Math.floor(rawPageSize) || 48));

  if (overview && !query && !category) {
    return {
      categories,
      category: null,
      query,
      total: catalog.plugins.length,
      page: 1,
      pageSize: 6,
      hasMore: false,
      plugins: [],
      sections: categories.map((item) => ({
        ...item,
        plugins: sortPlugins(
          catalog.plugins.filter((plugin) =>
            plugin.categories.includes(item.slug),
          ),
        )
          .slice(0, 6)
          .map(makeSummary),
      })),
    };
  }

  const candidates = sortPlugins(
    catalog.plugins.filter(
      (plugin) =>
        (!category || plugin.categories.includes(category.slug)) &&
        matches(plugin, query),
    ),
  );
  const start = (page - 1) * pageSize;
  const plugins = candidates.slice(start, start + pageSize).map(makeSummary);

  return {
    categories,
    category,
    query,
    total: candidates.length,
    page,
    pageSize,
    hasMore: start + plugins.length < candidates.length,
    plugins,
  };
}

export async function getPluginByRouteSegment(segment: string) {
  const catalog = await getCatalog();
  const decoded = decodeURIComponent(segment);
  return (
    catalog.plugins.find((plugin) => plugin.id === decoded) ??
    catalog.plugins.find(
      (plugin) => plugin.id.toLowerCase() === decoded.toLowerCase(),
    ) ??
    null
  );
}

export async function getPluginById(pluginId: string) {
  return getPluginByRouteSegment(pluginId);
}

export async function getRelatedPlugins(
  plugin: PluginCatalogItem,
  limit = 6,
): Promise<PluginSummary[]> {
  const catalog = await getCatalog();
  const primaryCategories = new Set(plugin.categories || []);
  const primaryKeywords = new Set((plugin.keywords || []).map((k) => k.toLowerCase()));

  const scored = catalog.plugins
    .filter((candidate) => candidate.id !== plugin.id)
    .map((candidate) => {
      let score = 0;
      for (const cat of candidate.categories || []) {
        if (primaryCategories.has(cat)) score += 3;
      }
      for (const kw of candidate.keywords || []) {
        if (primaryKeywords.has(kw.toLowerCase())) score += 1;
      }
      if (candidate.developer && plugin.developer && candidate.developer.toLowerCase() === plugin.developer.toLowerCase()) {
        score += 2;
      }
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || (a.candidate.displayName || "").localeCompare(b.candidate.displayName || ""))
    .slice(0, limit)
    .map(({ candidate }) => makeSummary(candidate));

  return scored;
}
