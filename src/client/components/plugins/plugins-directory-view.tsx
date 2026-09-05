"use client";

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Grid2X2,
  List,
  LoaderCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import {
  pluginRouteSegment,
  type PluginDirectoryResponse,
  type PluginSummary,
} from "./plugin-directory-data";
import { usePluginInstallations } from "./use-plugin-installations";
import { PluginArtwork } from "./plugin-artwork";
import { PluginPageHeader } from "./plugin-page-header";
import { useAppLayout } from "@/components/app-layout-context";

type DirectoryTab = "all" | "featured" | "collection";
type ViewMode = "grid" | "list";
type SortOption = "featured" | "name-asc" | "name-desc";

function pluginLabel(plugin: PluginSummary) {
  return plugin.displayName || plugin.name;
}

function PluginCard({
  plugin,
  installed,
  pending,
  saved,
  busy,
  layout,
  onToggleInstall,
  onToggleCollection,
}: {
  plugin: PluginSummary;
  installed: boolean;
  pending: boolean;
  saved: boolean;
  busy: boolean;
  layout: ViewMode;
  onToggleInstall: () => void;
  onToggleCollection: () => void;
}) {
  const href = `/plugins/${pluginRouteSegment(plugin)}`;
  const name = pluginLabel(plugin);
  const description =
    plugin.shortDescription ||
    plugin.description ||
    `Use ${name} in Clauxen.`;

  return (
    <article
      className={cn(
        "group relative rounded-xl border border-zinc-200/80 bg-[var(--app-panel-bg,#fcfcfb)]",
        layout === "list"
          ? "flex min-h-[64px] items-center gap-3 px-3 py-2.5"
          : "flex h-full flex-col p-3.5",
      )}
    >
      <Link
        href={href}
        prefetch
        aria-label={`View ${name}`}
        className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
      />

      <div
        className={cn(
          "flex min-w-0 items-start gap-3",
          layout === "list" ? "flex-1" : "",
        )}
      >
        <PluginArtwork
          name={name}
          logoUrl={plugin.logoUrl}
          brandColor={plugin.brandColor}
          size={layout === "list" ? 36 : 40}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 truncate text-[13.5px] font-medium leading-5 text-zinc-900">
              {name}
            </h3>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleCollection();
              }}
              aria-label={saved ? "Remove from saved" : "Save plugin"}
              className={cn(
                "relative z-10 -mr-1 -mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-black/[0.04] hover:text-zinc-800 sm:size-7",
                saved && "text-zinc-800",
              )}
            >
              {saved ? (
                <BookmarkCheck className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Bookmark className="size-3.5" strokeWidth={1.75} />
              )}
            </button>
          </div>
          <p
            className={cn(
              "text-[12.5px] leading-[18px] text-zinc-500",
              layout === "list" ? "line-clamp-1" : "mt-0.5 line-clamp-2",
            )}
          >
            {description}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "relative z-10 flex shrink-0 items-center",
          layout === "grid" && "mt-3 justify-end",
        )}
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleInstall();
          }}
          disabled={busy}
          aria-label={`${installed ? "Remove" : pending ? "Sign in to add" : "Add"} ${name}`}
          className={cn(
            "plugin-add-button inline-flex h-8 min-w-[4.25rem] items-center justify-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-60 sm:h-7",
            installed
              ? "bg-black/[0.05] text-zinc-700"
              : "bg-zinc-900 text-white hover:bg-zinc-800",
          )}
        >
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : installed ? (
            <Check className="size-3.5" strokeWidth={2} />
          ) : (
            <Plus className="size-3.5" strokeWidth={2} />
          )}
          <span>
            {busy ? "Working" : installed ? "Added" : pending ? "Sign in" : "Add"}
          </span>
        </button>
      </div>
    </article>
  );
}

async function loadDirectory(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<PluginDirectoryResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: "48" });
  if (query) params.set("q", query);
  const response = await fetch(`/api/plugins?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Unable to load plugins");
  return response.json() as Promise<PluginDirectoryResponse>;
}

export function PluginsDirectoryView({
  initialCategory = null,
  initialData,
}: {
  initialCategory?: string | null;
  initialData: PluginDirectoryResponse;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeTab, setActiveTab] = useState<DirectoryTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOption, setSortOption] = useState<SortOption>("featured");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    initialCategory,
  );
  const [data, setData] = useState<PluginDirectoryResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const installations = usePluginInstallations();
  const { isMobile } = useAppLayout();
  const cardLayout: ViewMode = isMobile ? "list" : viewMode;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = deferredQuery.trim();
    if (!trimmed) {
      setData(initialData);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(false);

    loadDirectory(trimmed, 1, controller.signal)
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [deferredQuery, initialData]);

  const isSearching = Boolean(deferredQuery.trim());

  const allLoadedPlugins = useMemo(() => {
    if (data.plugins && data.plugins.length > 0) {
      return data.plugins;
    }
    if (data.sections && data.sections.length > 0) {
      const map = new Map<string, PluginSummary>();
      for (const section of data.sections) {
        for (const plugin of section.plugins) {
          if (!map.has(plugin.id)) map.set(plugin.id, plugin);
        }
      }
      return Array.from(map.values());
    }
    return [];
  }, [data]);

  const displayedPlugins = useMemo(() => {
    let list = [...allLoadedPlugins];

    if (activeTab === "collection") {
      list = list.filter((plugin) => installations.isInCollection(plugin.id));
    } else if (activeTab === "featured") {
      list = list.filter(
        (plugin) =>
          plugin.categories.includes("featured") ||
          plugin.categories.includes("new-and-noteworthy"),
      );
    }

    if (categoryFilter) {
      list = list.filter((plugin) => plugin.categories.includes(categoryFilter));
    }

    if (sortOption === "name-asc") {
      list.sort((a, b) => pluginLabel(a).localeCompare(pluginLabel(b)));
    } else if (sortOption === "name-desc") {
      list.sort((a, b) => pluginLabel(b).localeCompare(pluginLabel(a)));
    }

    return list;
  }, [
    allLoadedPlugins,
    activeTab,
    sortOption,
    installations,
    categoryFilter,
  ]);

  const togglePluginInstall = (id: string) => {
    if (installations.isInstalled(id)) {
      void installations.remove(id);
    } else {
      void installations.install(id, {
        returnPath: "/plugins",
      });
    }
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const next = await loadDirectory(deferredQuery.trim(), data.page + 1);
      setData((current) => ({
        ...next,
        plugins: [...(current.plugins || []), ...next.plugins].filter(
          (plugin, index, list) =>
            list.findIndex((candidate) => candidate.id === plugin.id) === index,
        ),
      }));
    } catch {
      setError(true);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const tabs: { id: DirectoryTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "featured", label: "Featured" },
    { id: "collection", label: "Saved" },
  ];

  const categories = data.categories ?? [];

  return (
    <div className={appPage.surface}>
      <PluginPageHeader title="Plugins" />

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-3 pb-24 pt-4 sm:gap-5 sm:px-8 sm:pt-6">
          <p className="hidden text-[13px] leading-5 text-zinc-500 sm:block">
            Add tools and mention them with @name in any chat.
          </p>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              strokeWidth={1.75}
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search plugins"
              aria-label="Search plugins"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-16 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 sm:h-9 sm:text-[13px]"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
              {isLoading ? (
                <LoaderCircle className="size-4 animate-spin text-zinc-400" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-black/[0.04] hover:text-zinc-800"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="hidden h-5 items-center rounded border border-zinc-200 px-1.5 text-[10px] text-zinc-400 sm:inline-flex">
                  /
                </kbd>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto pb-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-2.5 text-[13px] font-medium",
                    activeTab === tab.id
                      ? "bg-black/[0.06] text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  {tab.label}
                  {tab.id === "collection" && installations.collectionCount > 0
                    ? ` ${installations.collectionCount}`
                    : null}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
                aria-label="Sort plugins"
                className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-700 outline-none"
              >
                <option value="featured">Featured</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
              </select>

              <div className="hidden items-center rounded-lg border border-zinc-200 p-0.5 sm:flex">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    viewMode === "grid"
                      ? "bg-black/[0.06] text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-700",
                  )}
                >
                  <Grid2X2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    viewMode === "list"
                      ? "bg-black/[0.06] text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-700",
                  )}
                >
                  <List className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {categories.length > 0 && activeTab !== "collection" ? (
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "h-7 shrink-0 rounded-full px-2.5 text-[12px]",
                  !categoryFilter
                    ? "bg-zinc-900 text-white"
                    : "bg-black/[0.04] text-zinc-600",
                )}
              >
                All categories
              </button>
              {categories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter === category.slug ? null : category.slug,
                    )
                  }
                  className={cn(
                    "h-7 shrink-0 rounded-full px-2.5 text-[12px]",
                    categoryFilter === category.slug
                      ? "bg-zinc-900 text-white"
                      : "bg-black/[0.04] text-zinc-600",
                  )}
                >
                  {category.title}
                </button>
              ))}
            </div>
          ) : null}

          {isSearching ? (
            <p className="text-[13px] text-zinc-500">
              {data.total} result{data.total === 1 ? "" : "s"} for “{query.trim()}”
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
              Couldn’t load plugins. Try again.
            </p>
          ) : null}

          {installations.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
              {installations.error}
            </p>
          ) : null}

          {!isSearching &&
          activeTab === "featured" &&
          data.sections &&
          data.sections.length > 0 &&
          !categoryFilter ? (
            <div className="flex flex-col gap-8">
              {data.sections.map((section) => (
                <section key={section.slug} className="flex flex-col gap-3">
                  <div>
                    <h2 className="text-[14px] font-medium text-zinc-900">
                      {section.title}
                    </h2>
                    {section.description ? (
                      <p className="mt-0.5 text-[12.5px] text-zinc-500">
                        {section.description}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      isMobile
                        ? "flex flex-col gap-1.5"
                        : "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3",
                    )}
                  >
                    {section.plugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        layout={cardLayout}
                        installed={installations.isInstalled(plugin.id)}
                        pending={installations.isPending(plugin.id)}
                        saved={installations.isInCollection(plugin.id)}
                        busy={installations.pendingId === plugin.id}
                        onToggleInstall={() => togglePluginInstall(plugin.id)}
                        onToggleCollection={() =>
                          installations.toggleCollection(plugin.id)
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : displayedPlugins.length > 0 ? (
            <div
              className={cn(
                cardLayout === "grid"
                  ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-1.5",
              )}
            >
              {displayedPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  layout={cardLayout}
                  installed={installations.isInstalled(plugin.id)}
                  pending={installations.isPending(plugin.id)}
                  saved={installations.isInCollection(plugin.id)}
                  busy={installations.pendingId === plugin.id}
                  onToggleInstall={() => togglePluginInstall(plugin.id)}
                  onToggleCollection={() =>
                    installations.toggleCollection(plugin.id)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 py-12 text-center">
              <h3 className="text-[14px] font-medium text-zinc-900">
                {activeTab === "collection"
                  ? "Nothing saved yet"
                  : "No plugins found"}
              </h3>
              <p className="mt-1 max-w-sm text-[13px] text-zinc-500">
                {activeTab === "collection"
                  ? "Save a plugin from the list to find it here later."
                  : "Try a different search or category."}
              </p>
              {activeTab === "collection" ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={cn(appBtn.secondarySm, "mt-4")}
                >
                  Browse plugins
                </button>
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={cn(appBtn.secondarySm, "mt-4")}
                >
                  Clear search
                </button>
              ) : null}
            </div>
          )}

          {data.hasMore && !isLoading ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-[13px] text-zinc-700 disabled:opacity-60"
              >
                {isLoadingMore ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
