"use client";

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronRight,
  Compass,
  Grid2X2,
  List,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  X,
  Zap,
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

type DirectoryTab = "all" | "featured" | "collection";
type ViewMode = "grid" | "list";
type SortOption = "featured" | "name-asc" | "name-desc";

function safeAccent(value: string | undefined): string {
  if (!value) return "#64748b";
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#64748b";
}

function PluginArtwork({
  plugin,
  size = 44,
  compact = false,
}: {
  plugin: PluginSummary;
  size?: number;
  compact?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (plugin.displayName || plugin.name || "P")
    .slice(0, 1)
    .toUpperCase();
  const dimension = compact ? 32 : size;
  const accent = safeAccent(plugin.brandColor);

  useEffect(() => setImageFailed(false), [plugin.logoUrl]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-[var(--ui-border-subtle)] text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(20,21,26,0.06)] transition-transform duration-200 group-hover:scale-105",
        compact ? "size-8 rounded-[10px]" : "size-11 rounded-[13px]",
      )}
      style={{
        width: dimension,
        height: dimension,
        backgroundColor:
          plugin.logoUrl && !imageFailed
            ? "var(--app-panel-bg)"
            : accent,
      }}
    >
      {plugin.logoUrl && !imageFailed ? (
        <Image
          src={plugin.logoUrl}
          alt=""
          width={dimension}
          height={dimension}
          sizes={`${dimension}px`}
          unoptimized
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="drop-shadow-sm">{initial}</span>
      )}
    </span>
  );
}

function PluginCard({
  plugin,
  installed,
  pending,
  saved,
  busy,
  onToggleInstall,
  onToggleCollection,
}: {
  plugin: PluginSummary;
  installed: boolean;
  pending: boolean;
  saved: boolean;
  busy: boolean;
  onToggleInstall: () => void;
  onToggleCollection: () => void;
}) {
  const href = `/plugins/${pluginRouteSegment(plugin)}`;
  const chatHref = `/new?prompt=${encodeURIComponent(`@${plugin.displayName || plugin.name} `)}`;
  const primaryCategory = plugin.categories?.[0]
    ? plugin.categories[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Tool";

  return (
    <article className="group relative flex h-full flex-col justify-between rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--ui-border)] hover:shadow-[0_10px_24px_-16px_rgba(20,21,26,0.22)] dark:hover:border-zinc-700">
      {/* Clickable body link to detail view */}
      <Link
        href={href}
        prefetch
        aria-label={`View ${plugin.displayName || plugin.name} plugin details`}
        className="absolute inset-0 z-0 rounded-[18px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-border)] focus-visible:ring-offset-2"
      />

      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <PluginArtwork plugin={plugin} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="rounded-md bg-[color-mix(in_oklab,var(--ui-fg)_5%,transparent)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--ui-fg-muted)]">
                  {primaryCategory}
                </span>
                {plugin.captureStatus === "detail-api" ? (
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    MCP
                  </span>
                ) : null}
              </div>
              <h3 className="mt-1 truncate text-[14px] font-semibold leading-snug text-[var(--ui-fg)] group-hover:text-black dark:group-hover:text-white">
                {plugin.displayName || plugin.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleCollection();
            }}
            aria-label={saved ? "Remove from collection" : "Save to collection"}
            title={saved ? "Saved in your collection" : "Add to collection"}
            className={cn(
              "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
              saved
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-transparent text-[var(--ui-fg-placeholder)] hover:border-[var(--ui-border)] hover:bg-[var(--app-frame-bg)] hover:text-[var(--ui-fg)]",
            )}
          >
            {saved ? (
              <BookmarkCheck className="size-3.5 fill-current" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
          </button>
        </div>

        <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
          {plugin.shortDescription ||
            plugin.description ||
            `Use the ${plugin.displayName || plugin.name} tool with Clauxen.`}
        </p>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-[var(--ui-border-subtle)] pt-3">
        <Link
          href={chatHref}
          prefetch
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
          title="Open in chat"
        >
          <MessageSquare className="size-3" />
          <span>Chat</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleInstall();
            }}
            disabled={busy}
            aria-label={`${installed ? "Remove" : pending ? "Sign in to" : "Add"} ${plugin.displayName || plugin.name}`}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[11.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-border)] disabled:cursor-wait disabled:opacity-60",
              installed
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-[var(--ui-border)] bg-[var(--app-panel-bg)] text-[var(--ui-fg)] hover:bg-[var(--ui-fg)] hover:text-[var(--app-panel-bg)] hover:border-[var(--ui-fg)] shadow-sm",
            )}
          >
            {busy ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : installed ? (
              <Check className="size-3" strokeWidth={2.5} />
            ) : (
              <Plus className="size-3" strokeWidth={2} />
            )}
            <span>{busy ? "Working" : installed ? "Added" : pending ? "Sign in" : "Add"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function PluginListRow({
  plugin,
  installed,
  pending,
  saved,
  busy,
  onToggleInstall,
  onToggleCollection,
}: {
  plugin: PluginSummary;
  installed: boolean;
  pending: boolean;
  saved: boolean;
  busy: boolean;
  onToggleInstall: () => void;
  onToggleCollection: () => void;
}) {
  const href = `/plugins/${pluginRouteSegment(plugin)}`;
  const chatHref = `/new?prompt=${encodeURIComponent(`@${plugin.displayName || plugin.name} `)}`;
  const primaryCategory = plugin.categories?.[0]
    ? plugin.categories[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Tool";

  return (
    <article className="group relative flex min-h-[64px] items-center justify-between gap-3 rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] px-3.5 py-2.5 transition-all duration-150 hover:border-[var(--ui-border)] hover:bg-[var(--app-frame-bg)]">
      <Link
        href={href}
        prefetch
        aria-label={`View ${plugin.displayName || plugin.name} plugin details`}
        className="absolute inset-0 z-0 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-border)] focus-visible:ring-offset-2"
      />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PluginArtwork plugin={plugin} compact />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13.5px] font-semibold text-[var(--ui-fg)] group-hover:text-black dark:group-hover:text-white">
              {plugin.displayName || plugin.name}
            </h3>
            <span className="hidden sm:inline-block rounded-md bg-[color-mix(in_oklab,var(--ui-fg)_5%,transparent)] px-1.5 py-0.2 text-[10px] font-medium text-[var(--ui-fg-muted)]">
              {primaryCategory}
            </span>
          </div>
          <p className="line-clamp-1 text-[12px] text-[var(--ui-fg-muted)]">
            {plugin.shortDescription || plugin.description || "Integrate with Clauxen"}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleCollection();
          }}
          aria-label={saved ? "Remove from collection" : "Save to collection"}
          className={cn(
            "flex size-7 items-center justify-center rounded-lg transition-colors",
            saved
              ? "text-amber-600 dark:text-amber-400"
              : "text-[var(--ui-fg-placeholder)] hover:text-[var(--ui-fg)]",
          )}
        >
          {saved ? <BookmarkCheck className="size-3.5 fill-current" /> : <Bookmark className="size-3.5" />}
        </button>

        <Link
          href={chatHref}
          prefetch
          onClick={(e) => e.stopPropagation()}
          className="hidden sm:inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
        >
          <MessageSquare className="size-3" />
          <span>Chat</span>
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleInstall();
          }}
          disabled={busy}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[11.5px] font-medium transition-all disabled:cursor-wait disabled:opacity-60",
            installed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-[var(--ui-border)] bg-[var(--app-panel-bg)] text-[var(--ui-fg)] hover:bg-[var(--ui-fg)] hover:text-[var(--app-panel-bg)] shadow-sm",
          )}
        >
          {busy ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : installed ? (
            <Check className="size-3" strokeWidth={2.5} />
          ) : (
            <Plus className="size-3" strokeWidth={2} />
          )}
          <span>{busy ? "Working" : installed ? "Added" : pending ? "Sign in" : "Add"}</span>
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
  const [data, setData] = useState<PluginDirectoryResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const installations = usePluginInstallations();

  // Keyboard shortcut: '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch when search query changes
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

  // Flatten all available plugins from data
  const allLoadedPlugins = useMemo(() => {
    if (data.plugins && data.plugins.length > 0) {
      return data.plugins;
    }
    if (data.sections && data.sections.length > 0) {
      const map = new Map<string, PluginSummary>();
      for (const sec of data.sections) {
        for (const p of sec.plugins) {
          if (!map.has(p.id)) map.set(p.id, p);
        }
      }
      return Array.from(map.values());
    }
    return [];
  }, [data]);

  // Filter and sort plugins according to active tab and sort option
  const displayedPlugins = useMemo(() => {
    let list = [...allLoadedPlugins];

    if (activeTab === "collection") {
      list = list.filter((p) => installations.isInCollection(p.id));
    } else if (activeTab === "featured") {
      list = list.filter((p) => p.categories.includes("featured") || p.categories.includes("new-and-noteworthy"));
    }

    if (sortOption === "name-asc") {
      list.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
    } else if (sortOption === "name-desc") {
      list.sort((a, b) => (b.displayName || b.name).localeCompare(a.displayName || a.name));
    }

    return list;
  }, [allLoadedPlugins, activeTab, sortOption, installations]);

  // Quick collection items for the active shelf
  const collectionPlugins = useMemo(() => {
    return allLoadedPlugins.filter((p) => installations.isInCollection(p.id));
  }, [allLoadedPlugins, installations]);

  const togglePluginInstall = (id: string) => {
    if (installations.isInstalled(id)) {
      void installations.remove(id);
    } else {
      void installations.install(id, {
        returnPath: "/plugins",
      });
    }
  };

  const toggleBookmark = (id: string) => {
    installations.toggleCollection(id);
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

  return (
    <div className={cn(appPage.surface, "bg-[var(--app-panel-bg)]")}>
      <div className="app-scrollbar flex-1 overflow-y-auto">
        {/* Sticky App Header */}
        <header className="sticky top-0 z-30 border-b border-[var(--ui-border-subtle)] bg-[color-mix(in_oklab,var(--app-panel-bg)_92%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-[var(--ui-fg)] text-[var(--app-panel-bg)] shadow-sm">
                <Compass className="size-4" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold tracking-tight text-[var(--ui-fg)]">
                  Plugins & Tools
                </h1>
              </div>
              <span className="hidden sm:inline-flex items-center rounded-full border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--ui-fg-muted)]">
                {data.total ? `${data.total.toLocaleString()} available` : "Catalog"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/new#settings/Skills"
                className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] px-2.5 text-[12px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:border-[var(--ui-border)] hover:text-[var(--ui-fg)]"
              >
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Custom Skills</span>
              </Link>
              <Link
                href="/new"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--ui-fg)] px-3 text-[12px] font-medium text-[var(--app-panel-bg)] shadow-sm transition-opacity hover:opacity-90"
              >
                <MessageSquare className="size-3.5" />
                <span>New Chat</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-24 pt-6 sm:px-8">
          {/* Hero Banner & Search Area */}
          <section className="relative overflow-hidden rounded-[24px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-2xl"
            />
            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--ui-fg-muted)] shadow-xs">
                <Zap className="size-3.5 text-amber-500" />
                <span>Verified MCP & Cloudflare Connectors</span>
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ui-fg)]">
                Extend Clauxen with live tools & data
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ui-fg-muted)]">
                Connect external APIs, code engines, productivity suites, and real-time data feeds. Mention them directly with <code className="rounded bg-[var(--ui-hover-wash)] px-1 py-0.5 text-[12px] font-mono text-[var(--ui-fg)]">@plugin</code> in any conversation.
              </p>

              {/* Search Bar */}
              <div className="relative mt-5">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ui-fg-placeholder)]"
                  strokeWidth={1.8}
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search plugins by name, developer, capability, or topics..."
                  aria-label="Search plugins"
                  className="h-11 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] pl-10 pr-20 text-[13px] text-[var(--ui-fg)] shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)] focus:ring-2 focus:ring-[var(--ui-field-focus-ring)]"
                />
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  {isLoading ? (
                    <LoaderCircle className="size-4 animate-spin text-[var(--ui-fg-placeholder)]" />
                  ) : query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="flex size-5 items-center justify-center rounded-md text-[var(--ui-fg-placeholder)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                      aria-label="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-[var(--ui-border)] bg-[var(--app-frame-bg)] px-1.5 text-[10px] font-medium text-[var(--ui-fg-placeholder)]">
                      /
                    </kbd>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Active Collection Shelf (when collection has items) */}
          {!isSearching && collectionPlugins.length > 0 ? (
            <section className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Bookmark className="size-4 text-amber-500 fill-amber-500/20" />
                  <h3 className="text-[13.5px] font-semibold text-[var(--ui-fg)]">
                    Your Collection & Installed Tools
                  </h3>
                  <span className="rounded-full bg-[var(--ui-hover-wash)] px-2 py-0.5 text-[11px] font-medium text-[var(--ui-fg-muted)]">
                    {collectionPlugins.length}
                  </span>
                </div>
                {activeTab !== "collection" ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("collection")}
                    className="text-[12px] font-medium text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)] transition-colors"
                  >
                    View all collection →
                  </button>
                ) : null}
              </div>

              <div className="app-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                {collectionPlugins.map((plugin) => (
                  <Link
                    key={plugin.id}
                    href={`/plugins/${pluginRouteSegment(plugin)}`}
                    prefetch
                    className="group flex min-w-[200px] max-w-[240px] items-center gap-2.5 rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-2.5 transition-all hover:border-[var(--ui-border)] hover:shadow-xs"
                  >
                    <PluginArtwork plugin={plugin} compact />
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-[12.5px] font-semibold text-[var(--ui-fg)] group-hover:text-black dark:group-hover:text-white">
                        {plugin.displayName || plugin.name}
                      </h4>
                      <p className="truncate text-[11px] text-[var(--ui-fg-muted)]">
                        {installations.isInstalled(plugin.id) ? "Active in chat" : "Saved"}
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 text-[var(--ui-fg-placeholder)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Directory Navigation Controls Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* View Tab Selector */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-medium transition-colors",
                  activeTab === "all"
                    ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs"
                    : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                )}
              >
                <span>All Plugins</span>
                <span className="text-[11px] opacity-70">
                  {allLoadedPlugins.length > 0 ? allLoadedPlugins.length : data.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("featured")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-medium transition-colors",
                  activeTab === "featured"
                    ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs"
                    : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                )}
              >
                <Sparkles className="size-3 text-amber-500" />
                <span>Featured</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("collection")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-medium transition-colors",
                  activeTab === "collection"
                    ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs"
                    : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                )}
              >
                <Bookmark className="size-3" />
                <span>My Collection</span>
                {installations.collectionCount > 0 ? (
                  <span className="rounded-full bg-[var(--ui-fg)] px-1.5 text-[10px] text-[var(--app-panel-bg)]">
                    {installations.collectionCount}
                  </span>
                ) : null}
              </button>
            </div>

            {/* Layout Mode and Sort controls */}
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-[var(--ui-fg-muted)]" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  aria-label="Sort plugins"
                  className="h-8 rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] px-2.5 text-[12px] font-medium text-[var(--ui-fg)] outline-none focus:border-[var(--ui-field-focus-border)]"
                >
                  <option value="featured">Popular & Featured</option>
                  <option value="name-asc">Name (A–Z)</option>
                  <option value="name-desc">Name (Z–A)</option>
                </select>
              </div>

              <div className="flex items-center rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    viewMode === "grid"
                      ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs"
                      : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                  )}
                >
                  <Grid2X2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    viewMode === "list"
                      ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs"
                      : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                  )}
                >
                  <List className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Search Result Count */}
          {isSearching ? (
            <div className="flex items-center justify-between text-[12.5px] text-[var(--ui-fg-muted)]">
              <span>
                Found <strong className="font-semibold text-[var(--ui-fg)]">{data.total}</strong> results for &ldquo;{query.trim()}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[12px] font-medium text-[var(--ui-fg)] underline hover:opacity-80"
              >
                Clear search
              </button>
            </div>
          ) : null}

          {/* Error Banner */}
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
              The plugin directory could not be loaded. Please check your connection and try again.
            </div>
          ) : null}

          {installations.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
              {installations.error}
            </div>
          ) : null}

          {/* Curated Categorized Layout (when on "Featured" tab and sections exist) */}
          {!isSearching && activeTab === "featured" && data.sections && data.sections.length > 0 ? (
            <div className="flex flex-col gap-8">
              {data.sections.map((section) => (
                <section key={section.slug} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h3 className="text-[15px] font-semibold text-[var(--ui-fg)]">
                        {section.title}
                      </h3>
                      <p className="text-[12px] text-[var(--ui-fg-muted)]">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {section.plugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        installed={installations.isInstalled(plugin.id)}
                        pending={installations.isPending(plugin.id)}
                        saved={installations.isInCollection(plugin.id)}
                        busy={installations.pendingId === plugin.id}
                        onToggleInstall={() => togglePluginInstall(plugin.id)}
                        onToggleCollection={() => toggleBookmark(plugin.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            /* Main Plugin Grid or List */
            <div>
              {displayedPlugins.length > 0 ? (
                viewMode === "grid" ? (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {displayedPlugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        installed={installations.isInstalled(plugin.id)}
                        pending={installations.isPending(plugin.id)}
                        saved={installations.isInCollection(plugin.id)}
                        busy={installations.pendingId === plugin.id}
                        onToggleInstall={() => togglePluginInstall(plugin.id)}
                        onToggleCollection={() => toggleBookmark(plugin.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {displayedPlugins.map((plugin) => (
                      <PluginListRow
                        key={plugin.id}
                        plugin={plugin}
                        installed={installations.isInstalled(plugin.id)}
                        pending={installations.isPending(plugin.id)}
                        saved={installations.isInCollection(plugin.id)}
                        busy={installations.pendingId === plugin.id}
                        onToggleInstall={() => togglePluginInstall(plugin.id)}
                        onToggleCollection={() => toggleBookmark(plugin.id)}
                      />
                    ))}
                  </div>
                )
              ) : (
                /* Empty State */
                <div className="flex min-h-64 flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--ui-border)] p-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--app-frame-bg)] text-[var(--ui-fg-muted)]">
                    {activeTab === "collection" ? (
                      <Bookmark className="size-5" />
                    ) : (
                      <Search className="size-5" />
                    )}
                  </div>
                  <h3 className="mt-3 text-[14px] font-semibold text-[var(--ui-fg)]">
                    {activeTab === "collection"
                      ? "Your collection is empty"
                      : "No plugins found"}
                  </h3>
                  <p className="mt-1 max-w-sm text-[12.5px] text-[var(--ui-fg-muted)]">
                    {activeTab === "collection"
                      ? "Save your favorite tools by clicking the bookmark icon on any plugin."
                      : `We couldn't find any plugins matching "${query.trim()}". Try searching for a different keyword or topic.`}
                  </p>
                  {activeTab === "collection" ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("all")}
                      className={cn(appBtn.secondarySm, "mt-4")}
                    >
                      Browse all plugins
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className={cn(appBtn.secondarySm, "mt-4")}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Load More Pagination */}
          {data.hasMore && !isLoading && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] px-5 text-[12.5px] font-medium text-[var(--ui-fg)] shadow-xs transition-colors hover:bg-[var(--app-frame-bg)] disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
                <span>{isLoadingMore ? "Loading more..." : "Load more plugins"}</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
