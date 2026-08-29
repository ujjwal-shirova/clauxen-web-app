"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import { cn } from "@/lib/utils";
import {
  pluginRouteSegment,
  type PluginDirectoryResponse,
  type PluginSummary,
} from "./plugin-directory-data";

const STORAGE_KEY = "clauxen_installed_directory_plugin_ids_v2";

function readInstalledPlugins() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const ids = JSON.parse(saved) as unknown;
      if (Array.isArray(ids)) {
        return new Set(
          ids.filter((item): item is string => typeof item === "string"),
        );
      }
    }
  } catch {
    // Installation toggles continue in memory when storage is unavailable.
  }
  return new Set<string>();
}

function PluginArtwork({
  plugin,
  size = 40,
}: {
  plugin: PluginSummary;
  size?: number;
}) {
  const initial = (plugin.displayName || plugin.name || "P")
    .slice(0, 1)
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border border-black/10 bg-white text-xs font-semibold text-white",
        size >= 40 ? "size-10 rounded-xl" : "size-8 rounded-[9px]",
      )}
      style={{
        backgroundColor: plugin.logoUrl
          ? "white"
          : plugin.brandColor || "#8c8c8c",
      }}
    >
      {plugin.logoUrl ? (
        <img
          src={plugin.logoUrl}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        initial
      )}
    </span>
  );
}

function PluginRow({
  plugin,
  categorySlug,
  installed,
  onToggle,
}: {
  plugin: PluginSummary;
  categorySlug: string | null;
  installed: boolean;
  onToggle: () => void;
}) {
  const href = `/plugins/${pluginRouteSegment(plugin)}${categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ""}`;
  return (
    <article className="group relative flex min-w-0 items-center rounded-2xl p-2 transition-colors duration-150 hover:bg-black/[0.035]">
      <Link
        href={href}
        aria-label={`Open ${plugin.displayName} plugin`}
        className="flex min-w-0 flex-1 items-center gap-3.5 pr-3 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-zinc-400 focus-visible:after:ring-offset-2"
      >
        <PluginArtwork plugin={plugin} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium leading-[18px] text-zinc-900">
            {plugin.displayName}
          </h3>
          <p className="mt-0.5 truncate text-[13px] leading-[18px] text-zinc-500">
            {plugin.description || "Use this plugin with Clauxen"}
          </p>
        </div>
      </Link>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${installed ? "Remove" : "Install"} ${plugin.displayName}`}
        aria-pressed={installed}
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
          installed
            ? "border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
            : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-white hover:shadow-sm",
        )}
      >
        {installed ? (
          <Check className="size-4" strokeWidth={2} />
        ) : (
          <Plus className="size-5" strokeWidth={1.6} />
        )}
      </button>
    </article>
  );
}

async function loadDirectory(
  category: string | null,
  query: string,
  page = 1,
): Promise<PluginDirectoryResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: "48" });
  if (category) params.set("category", category);
  if (query) params.set("q", query);
  const response = await fetch(`/api/plugins?${params.toString()}`);
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
  const [categorySlug, setCategorySlug] = useState(initialCategory);
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [installed, setInstalled] = useState<Set<string>>(() => new Set());

  useEffect(() => setInstalled(readInstalledPlugins()), []);
  useEffect(() => {
    const handlePopState = () => {
      setCategorySlug(
        new URLSearchParams(window.location.search).get("category"),
      );
      setQuery("");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!deferredQuery && categorySlug === initialCategory) {
      setData(initialData);
      return () => controller.abort();
    }
    setIsLoading(true);
    setError(false);
    void loadDirectory(categorySlug, deferredQuery.trim())
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [categorySlug, deferredQuery, initialCategory, initialData]);

  const activeCategory = data.category;
  const isSearch = Boolean(deferredQuery.trim());
  const togglePlugin = (id: string) =>
    setInstalled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* in-memory state remains available */
      }
      return next;
    });
  const installedItems = useMemo(() => {
    const all =
      data.sections?.flatMap((section) => section.plugins) ?? data.plugins;
    return all.filter((plugin) => installed.has(plugin.id)).slice(0, 14);
  }, [data.plugins, data.sections, installed]);
  const pageTitle = activeCategory
    ? activeCategory.title
    : isSearch
      ? `Results for “${deferredQuery.trim()}”`
      : "Plugins";
  const pageDescription = activeCategory
    ? activeCategory.description
    : isSearch
      ? `${data.total.toLocaleString()} matching plugins`
      : "Work with Clauxen across your favorite tools.";
  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const next = await loadDirectory(
        categorySlug,
        deferredQuery.trim(),
        data.page + 1,
      );
      setData((current) => ({
        ...next,
        plugins: [...current.plugins, ...next.plugins].filter(
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
    <div className={appPage.surface}>
      <div className="app-scrollbar flex-1 overflow-y-auto">
        {activeCategory ? (
          <nav className="sticky top-0 z-20 flex bg-[rgba(252,252,252,0.88)] px-4 pb-2 pt-2.5 backdrop-blur-xl">
            <Link
              href="/plugins"
              onClick={() => {
                setCategorySlug(null);
                setQuery("");
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-1.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-black/[0.04]"
            >
              <ChevronLeft className="size-5" strokeWidth={1.7} /> Plugins
            </Link>
          </nav>
        ) : (
          <nav
            aria-label="Directory type"
            className="sticky top-0 z-20 hidden justify-center bg-[rgba(252,252,252,0.88)] pb-2 pt-2.5 backdrop-blur-xl sm:flex"
          >
            <div
              role="tablist"
              className="relative grid grid-cols-2 rounded-full bg-black/[0.03] p-px"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-full border border-black/10 bg-white shadow-[0_1px_6px_rgba(0,0,0,0.05)]" />
              <span
                role="tab"
                aria-selected="true"
                className="relative z-10 flex h-9 min-w-[96px] items-center justify-center rounded-full px-6 text-[14px] font-medium text-zinc-900"
              >
                Plugins
              </span>
              <Link
                role="tab"
                aria-selected="false"
                href="/new#settings/Skills"
                className="relative z-10 flex h-9 min-w-[96px] items-center justify-center rounded-full px-6 text-[14px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
              >
                Skills
              </Link>
            </div>
          </nav>
        )}
        <main className="mobile-page-inset mx-auto flex w-full max-w-[900px] flex-col gap-7 px-4 pb-24 pt-8 sm:px-6 sm:pt-[62px]">
          <header className="flex min-h-[76px] flex-wrap items-start gap-4">
            <div className="min-w-[220px] flex-1">
              <h1 className="text-[28px] font-medium leading-9 tracking-[-0.025em] text-zinc-950">
                {pageTitle}
              </h1>
              <p className="mt-1 text-[16px] leading-6 text-zinc-600">
                {pageDescription}
              </p>
            </div>
            <form
              role="search"
              className="relative w-full sm:ml-auto sm:w-[280px]"
              onSubmit={(event) => event.preventDefault()}
            >
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
                strokeWidth={1.6}
              />
              <input
                type="search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  activeCategory?.searchPlaceholder ?? "Search all plugins"
                }
                aria-label="Search plugins"
                className="h-10 w-full rounded-full border border-black/10 bg-white py-2 pl-9 pr-9 text-[14px] leading-5 text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200/70"
              />
              {isLoading ? (
                <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-400" />
              ) : null}
            </form>
          </header>
          {!isSearch && !activeCategory && installedItems.length > 0 ? (
            <section aria-labelledby="installed-plugins-heading">
              <h2
                id="installed-plugins-heading"
                className="mb-2 text-[14px] font-medium text-zinc-900"
              >
                Installed
              </h2>
              <div className="-ml-1 flex flex-wrap gap-0.5">
                {installedItems.map((plugin) => (
                  <Link
                    key={plugin.id}
                    href={`/plugins/${pluginRouteSegment(plugin)}`}
                    title={plugin.displayName}
                    className="flex size-12 items-center justify-center rounded-[14px] transition-colors hover:bg-black/[0.04]"
                  >
                    <PluginArtwork plugin={plugin} size={32} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              The plugin directory could not be loaded. Please try again.
            </div>
          ) : null}
          {data.sections && !isSearch && !activeCategory ? (
            data.sections.map((section) => (
              <section
                key={section.slug}
                aria-labelledby={`plugin-section-${section.slug}`}
                className="[content-visibility:auto] [contain-intrinsic-size:auto_260px]"
              >
                <div className="mb-1 flex items-baseline justify-between gap-4 pb-1">
                  <h2
                    id={`plugin-section-${section.slug}`}
                    className="text-[14px] font-medium leading-5 text-zinc-900"
                  >
                    {section.title}
                  </h2>
                  <span className="text-xs text-zinc-400">
                    {section.count.toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-2">
                  {section.plugins.map((plugin) => (
                    <PluginRow
                      key={plugin.id}
                      plugin={plugin}
                      categorySlug={section.slug}
                      installed={installed.has(plugin.id)}
                      onToggle={() => togglePlugin(plugin.id)}
                    />
                  ))}
                </div>
                <Link
                  href={`/plugins?category=${encodeURIComponent(section.slug)}`}
                  onClick={() => {
                    setCategorySlug(section.slug);
                    setQuery("");
                  }}
                  className="group -ml-2 mt-2 flex min-h-12 items-center gap-3 rounded-2xl p-2 text-[14px] text-zinc-600 transition-colors hover:bg-black/[0.035] hover:text-zinc-800"
                >
                  <div className="flex shrink-0 items-center">
                    {section.plugins.slice(0, 3).map((plugin, index) => (
                      <span
                        key={plugin.id}
                        className={cn(index > 0 && "-ml-1.5")}
                      >
                        <PluginArtwork plugin={plugin} size={24} />
                      </span>
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 truncate">
                    See all {section.count.toLocaleString()}{" "}
                    {section.title.toLowerCase()} plugins
                  </span>
                  <ChevronRight className="mr-2 size-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </section>
            ))
          ) : (
            <section
              aria-label="Plugin results"
              className="grid grid-cols-1 gap-x-7 gap-y-1 sm:grid-cols-2"
            >
              {data.plugins.map((plugin) => (
                <PluginRow
                  key={plugin.id}
                  plugin={plugin}
                  categorySlug={activeCategory?.slug ?? null}
                  installed={installed.has(plugin.id)}
                  onToggle={() => togglePlugin(plugin.id)}
                />
              ))}
            </section>
          )}
          {!data.sections && data.plugins.length === 0 && !isLoading ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-black/[0.04]">
                <Search className="size-5 text-zinc-500" strokeWidth={1.6} />
              </div>
              <h2 className="mt-3 text-[15px] font-medium text-zinc-900">
                No plugins found
              </h2>
              <p className="mt-1 text-[13px] text-zinc-500">
                Try a different name or category.
              </p>
            </div>
          ) : null}
          {!data.sections && data.plugins.length > 0 && data.hasMore ? (
            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {isLoadingMore ? "Loading plugins" : "Load more"}
              </button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
