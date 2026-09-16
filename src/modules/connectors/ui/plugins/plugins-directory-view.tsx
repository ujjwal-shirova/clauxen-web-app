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
import { chrome } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";
import {
  pluginRouteSegment,
  type PluginDirectoryResponse,
  type PluginSummary,
} from "./plugin-directory-data";
import { usePluginInstallations } from "./use-plugin-installations";
import { PluginArtwork } from "./plugin-artwork";
import { PluginPageHeader } from "./plugin-page-header";
import { PluginApiKeyDialog } from "./plugin-api-key-dialog";
import { useAppLayout } from "@/components/app-layout-context";

type DirectoryTab = "all" | "featured" | "saved";
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
  const href = `/connectors/${pluginRouteSegment(plugin)}`;
  const name = pluginLabel(plugin);
  const description =
    plugin.shortDescription ||
    plugin.description ||
    `Use ${name} in Clauxen.`;

  return (
    <article
      className={cn(
        "group relative rounded-[var(--radius-md)] border border-[var(--settings-hairline)] bg-[var(--settings-card-bg)] shadow-[var(--settings-card-shadow)]",
        layout === "list"
          ? "flex min-h-[64px] items-center gap-3 px-3 py-2.5"
          : "flex h-full flex-col p-3.5",
      )}
    >
      <Link
        href={href}
        prefetch={false}
        aria-label={`View ${name}`}
        className="absolute inset-0 z-0 rounded-[var(--radius-md)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
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
            <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
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
                "relative z-10 -mr-1 -mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--settings-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--settings-fg)] sm:size-7",
                saved && "text-[var(--settings-fg)]",
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
              "text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]",
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
            "no-hover connector-add-btn inline-flex h-8 min-w-[4.25rem] items-center justify-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium transition-opacity disabled:opacity-60 sm:h-7",
            installed && "connector-add-btn--added",
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
  options: { query?: string; category?: string | null; page?: number },
  signal?: AbortSignal,
): Promise<PluginDirectoryResponse> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    pageSize: "48",
  });
  if (options.query) params.set("q", options.query);
  if (options.category) params.set("category", options.category);
  const response = await fetch(`/api/connectors?${params.toString()}`, {
    signal,
  });
  if (!response.ok) throw new Error("Unable to load connectors");
  return response.json() as Promise<PluginDirectoryResponse>;
}

async function loadFeatured(signal?: AbortSignal): Promise<PluginSummary[]> {
  const [featured, fresh] = await Promise.all([
    loadDirectory({ category: "featured", page: 1 }, signal),
    loadDirectory({ category: "new-and-noteworthy", page: 1 }, signal),
  ]);
  const map = new Map<string, PluginSummary>();
  for (const plugin of [...featured.plugins, ...fresh.plugins]) {
    if (!map.has(plugin.id)) map.set(plugin.id, plugin);
  }
  return [...map.values()].sort((a, b) =>
    pluginLabel(a).localeCompare(pluginLabel(b)),
  );
}

async function loadSaved(
  ids: string[],
  signal?: AbortSignal,
): Promise<PluginSummary[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.slice(0, 100).join(",") });
  const response = await fetch(`/api/connectors/by-ids?${params.toString()}`, {
    signal,
  });
  if (!response.ok) throw new Error("Unable to load saved connectors");
  const payload = (await response.json()) as { plugins: PluginSummary[] };
  return payload.plugins ?? [];
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
  const [featuredPlugins, setFeaturedPlugins] = useState<PluginSummary[]>([]);
  const [savedPlugins, setSavedPlugins] = useState<PluginSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [keyPlugin, setKeyPlugin] = useState<PluginSummary | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

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

  const trimmedQuery = deferredQuery.trim();
  const isSearching = Boolean(trimmedQuery);
  const showOverview =
    activeTab === "all" && !isSearching && !categoryFilter;

  useEffect(() => {
    if (activeTab === "saved" || (activeTab === "all" && showOverview)) {
      return;
    }
    if (activeTab === "featured" && !isSearching && !categoryFilter) {
      const controller = new AbortController();
      setIsLoading(true);
      setError(false);
      loadFeatured(controller.signal)
        .then(setFeaturedPlugins)
        .catch((err: unknown) => {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            setError(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
      return () => controller.abort();
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(false);
    loadDirectory(
      {
        query: trimmedQuery || undefined,
        category: activeTab === "all" ? categoryFilter : undefined,
        page: 1,
      },
      controller.signal,
    )
      .then(setData)
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [trimmedQuery, categoryFilter, activeTab, showOverview]);

  useEffect(() => {
    if (activeTab !== "saved") return;
    const ids = [
      ...new Set([
        ...installations.bookmarkedIds,
        ...installations.connections.map(
          (connection) => connection.pluginId || connection.connectorKey,
        ),
      ]),
    ].filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      setSavedPlugins([]);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(false);
    const installedFallback = new Map<string, PluginSummary>();
    for (const connection of installations.connections) {
      if (!connection.pluginId || installedFallback.has(connection.pluginId)) {
        continue;
      }
      installedFallback.set(connection.pluginId, {
        id: connection.pluginId,
        name: connection.connectorName,
        displayName: connection.connectorName,
        description: "",
        shortDescription: "",
        logoUrl: connection.logoUrl || "",
        brandColor: "",
        categories: [],
        captureStatus: "detail-api",
      });
    }
    loadSaved(ids, controller.signal)
      .then((plugins) => {
        const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]));
        const ordered = ids
          .map((id) => byId.get(id) ?? installedFallback.get(id))
          .filter((plugin): plugin is PluginSummary => Boolean(plugin));
        setSavedPlugins(ordered);
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          const ordered = ids
            .map((id) => installedFallback.get(id))
            .filter((plugin): plugin is PluginSummary => Boolean(plugin));
          if (ordered.length > 0) {
            setSavedPlugins(ordered);
          } else {
            setError(true);
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [
    activeTab,
    installations.bookmarkedIds,
    installations.connections,
  ]);

  const displayedPlugins = useMemo(() => {
    let list: PluginSummary[];
    if (activeTab === "saved") {
      list = [...savedPlugins];
      if (trimmedQuery) {
        const q = trimmedQuery.toLocaleLowerCase();
        list = list.filter((plugin) =>
          [plugin.displayName, plugin.name, plugin.description]
            .join(" ")
            .toLocaleLowerCase()
            .includes(q),
        );
      }
    } else if (
      activeTab === "featured" &&
      !isSearching &&
      !categoryFilter
    ) {
      list = [...featuredPlugins];
    } else {
      list = [...(data.plugins ?? [])];
    }
    if (sortOption === "name-asc") {
      list.sort((a, b) => pluginLabel(a).localeCompare(pluginLabel(b)));
    } else if (sortOption === "name-desc") {
      list.sort((a, b) => pluginLabel(b).localeCompare(pluginLabel(a)));
    }
    return list;
  }, [
    activeTab,
    savedPlugins,
    featuredPlugins,
    data.plugins,
    trimmedQuery,
    isSearching,
    categoryFilter,
    sortOption,
  ]);

  const togglePluginInstall = (plugin: PluginSummary) => {
    if (installations.isInstalled(plugin.id)) {
      void installations.remove(plugin.id);
      return;
    }
    void installations
      .install(plugin.id, { returnPath: "/connectors" })
      .then((result) => {
        if (!result.ok && result.code === "plugin_api_key_required") {
          setKeyError(null);
          setKeyPlugin(plugin);
        }
      });
  };

  const submitApiKey = (apiKey: string) => {
    if (!keyPlugin) return;
    void installations
      .install(keyPlugin.id, { returnPath: "/connectors", apiKey })
      .then((result) => {
        if (result.ok) {
          setKeyPlugin(null);
          setKeyError(null);
        } else {
          setKeyError(result.message || "That key didn't work. Try again.");
        }
      });
  };

  const handleLoadMore = async () => {
    if (activeTab !== "all") return;
    setIsLoadingMore(true);
    try {
      const next = await loadDirectory({
        query: trimmedQuery || undefined,
        category: categoryFilter,
        page: data.page + 1,
      });
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
    { id: "saved", label: "Saved" },
  ];

  const categories = initialData.categories ?? [];
  const overviewSections = initialData.sections ?? [];

  return (
    <div className={chrome.page.surface}>
      <PluginPageHeader title="Connectors" />

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-3 pb-24 pt-4 sm:gap-5 sm:px-6 sm:pt-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--settings-fg-muted)]"
              strokeWidth={1.75}
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search connectors"
              aria-label="Search connectors"
              className="h-10 w-full rounded-lg border border-[var(--settings-input-border)] bg-[var(--settings-card-bg)] pl-9 pr-16 text-[14px] text-[var(--settings-fg)] outline-none placeholder:text-[var(--settings-fg-muted)] focus:border-[var(--settings-input-focus-border)] sm:h-9 sm:text-[13px]"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
              {isLoading ? (
                <LoaderCircle className="size-4 animate-spin text-[var(--settings-fg-muted)]" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex size-7 items-center justify-center rounded-md text-[var(--settings-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--settings-fg)]"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="hidden h-5 items-center rounded border border-[var(--settings-hairline)] px-1.5 text-[10px] text-[var(--settings-fg-muted)] sm:inline-flex">
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
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== "all") setCategoryFilter(null);
                  }}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-2.5 text-[13px] font-medium",
                    activeTab === tab.id
                      ? "bg-[var(--ui-hover-wash)] text-[var(--settings-fg)]"
                      : "text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]",
                  )}
                >
                  {tab.label}
                  {tab.id === "saved" && installations.collectionCount > 0
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
                aria-label="Sort connectors"
                className="h-8 rounded-lg border border-[var(--settings-input-border)] bg-[var(--settings-card-bg)] px-2 text-[12.5px] text-[var(--settings-fg)] outline-none"
              >
                <option value="featured">Featured</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
              </select>

              <div className="hidden items-center rounded-lg border border-[var(--settings-input-border)] p-0.5 sm:flex">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    viewMode === "grid"
                      ? "bg-[var(--ui-hover-wash)] text-[var(--settings-fg)]"
                      : "text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]",
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
                      ? "bg-[var(--ui-hover-wash)] text-[var(--settings-fg)]"
                      : "text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]",
                  )}
                >
                  <List className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {categories.length > 0 && activeTab === "all" ? (
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "h-7 shrink-0 rounded-full px-2.5 text-[12px]",
                  !categoryFilter
                    ? "bg-[var(--settings-fg)] text-[var(--settings-canvas-bg)]"
                    : "bg-[var(--ui-hover-wash)] text-[var(--settings-fg-muted)]",
                )}
              >
                All
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
                      ? "bg-[var(--settings-fg)] text-[var(--settings-canvas-bg)]"
                      : "bg-[var(--ui-hover-wash)] text-[var(--settings-fg-muted)]",
                  )}
                >
                  {category.title}
                </button>
              ))}
            </div>
          ) : null}

          {isSearching && activeTab !== "saved" ? (
            <p className="text-[13px] text-[var(--settings-fg-muted)]">
              {data.total} result{data.total === 1 ? "" : "s"} for “
              {query.trim()}”
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
              Couldn’t load connectors. Try again.
            </p>
          ) : null}

          {installations.error && keyPlugin === null ? (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {installations.error}
            </p>
          ) : null}

          {showOverview && overviewSections.length > 0 ? (
            <div className="flex flex-col gap-8">
              {overviewSections.map((section) => (
                <section key={section.slug} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[14px] font-medium text-[var(--settings-fg)]">
                      {section.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(section.slug)}
                      className="shrink-0 text-[12.5px] text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
                    >
                      View all
                    </button>
                  </div>
                  <div
                    className={cn(
                      cardLayout === "grid"
                        ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
                        : "flex flex-col gap-1.5",
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
                        onToggleInstall={() => togglePluginInstall(plugin)}
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
                  onToggleInstall={() => togglePluginInstall(plugin)}
                  onToggleCollection={() =>
                    installations.toggleCollection(plugin.id)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 py-12 text-center">
              <h3 className="text-[14px] font-medium text-[var(--settings-fg)]">
                {activeTab === "saved" ? "Nothing saved yet" : "No connectors found"}
              </h3>
              <p className="mt-1 max-w-sm text-[13px] text-[var(--settings-fg-muted)]">
                {activeTab === "saved"
                  ? "Save a connector to find it here later."
                  : "Try a different search or category."}
              </p>
              {activeTab === "saved" ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={cn(chrome.btn.secondarySm, "mt-4")}
                >
                  Browse connectors
                </button>
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={cn(chrome.btn.secondarySm, "mt-4")}
                >
                  Clear search
                </button>
              ) : null}
            </div>
          )}

          {activeTab === "all" && !showOverview && data.hasMore && !isLoading ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--settings-input-border)] bg-[var(--settings-card-bg)] px-4 text-[13px] text-[var(--settings-fg)] disabled:opacity-60"
              >
                {isLoadingMore ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
                {isLoadingMore ? "Loading…" : "Show more"}
              </button>
            </div>
          ) : null}
        </main>
      </div>

      <PluginApiKeyDialog
        open={keyPlugin !== null}
        pluginName={keyPlugin ? pluginLabel(keyPlugin) : ""}
        pending={keyPlugin !== null && installations.pendingId === keyPlugin.id}
        error={keyError}
        onSubmit={submitApiKey}
        onClose={() => {
          setKeyPlugin(null);
          setKeyError(null);
        }}
      />
    </div>
  );
}
