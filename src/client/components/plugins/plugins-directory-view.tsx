"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
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
    const ids = saved ? (JSON.parse(saved) as unknown) : [];
    return new Set(
      Array.isArray(ids)
        ? ids.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function PluginArtwork({
  plugin,
  compact = false,
}: {
  plugin: PluginSummary;
  compact?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (plugin.displayName || plugin.name || "P")
    .slice(0, 1)
    .toUpperCase();
  const size = compact ? 30 : 40;

  useEffect(() => setImageFailed(false), [plugin.logoUrl]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-[var(--ui-border)] text-[12px] font-semibold shadow-[0_1px_3px_rgba(20,21,26,0.05)]",
        compact ? "size-[30px] rounded-[9px]" : "size-10 rounded-xl",
      )}
      style={{
        backgroundColor:
          plugin.logoUrl && !imageFailed
            ? "var(--app-panel-bg)"
            : plugin.brandColor || "#737373",
        color: "white",
      }}
    >
      {plugin.logoUrl && !imageFailed ? (
        <Image
          src={plugin.logoUrl}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          unoptimized
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

function PluginCard({
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
    <article className="group relative flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-3 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-[var(--ui-border)] hover:shadow-[0_8px_24px_-18px_rgba(20,21,26,0.28)]">
      <Link
        href={href}
        prefetch
        aria-label={`Open ${plugin.displayName} plugin`}
        className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel-bg)]"
      />
      <PluginArtwork plugin={plugin} />
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="truncate text-[13.5px] font-semibold leading-[18px] text-[var(--ui-fg)]">
          {plugin.displayName}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[17px] text-[var(--ui-fg-muted)]">
          {plugin.description || "Use this plugin with Clauxen"}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${installed ? "Remove" : "Install"} ${plugin.displayName}`}
        aria-pressed={installed}
        className={cn(
          "relative z-10 flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-border)]",
          installed
            ? "border-[var(--ui-border)] bg-[var(--settings-nav-active-bg)] text-[var(--ui-fg)]"
            : "border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] text-[var(--ui-fg-muted)] hover:border-[var(--ui-border)] hover:text-[var(--ui-fg)]",
        )}
      >
        {installed ? (
          <Check className="size-3" strokeWidth={2.2} />
        ) : (
          <Plus className="size-3" strokeWidth={2} />
        )}
        {installed ? "Added" : "Add"}
      </button>
    </article>
  );
}

async function loadDirectory(
  category: string | null,
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<PluginDirectoryResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: "48" });
  if (category) params.set("category", category);
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
  const [categorySlug, setCategorySlug] = useState(initialCategory);
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [installed, setInstalled] = useState<Set<string>>(() => new Set());

  useEffect(() => setInstalled(readInstalledPlugins()), []);
  useEffect(() => {
    const handlePopState = () => {
      setCategorySlug(new URLSearchParams(window.location.search).get("category"));
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
    void loadDirectory(
      categorySlug,
      deferredQuery.trim(),
      1,
      controller.signal,
    )
      .then((result) => setData(result))
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [categorySlug, deferredQuery, initialCategory, initialData]);

  const requestedCategory = useMemo(
    () => data.categories.find((item) => item.slug === categorySlug) ?? null,
    [categorySlug, data.categories],
  );
  const isSearch = Boolean(deferredQuery.trim());
  const togglePlugin = (id: string) =>
    setInstalled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // The in-memory selection remains usable.
      }
      return next;
    });
  const allVisiblePlugins =
    data.sections?.flatMap((section) => section.plugins) ?? data.plugins;
  const installedItems = allVisiblePlugins
    .filter((plugin) => installed.has(plugin.id))
    .slice(0, 12);
  const pageTitle = requestedCategory
    ? requestedCategory.title
    : isSearch
      ? "Search results"
      : "Plugin gallery";
  const pageDescription = requestedCategory
    ? requestedCategory.description
    : isSearch
      ? `${data.total.toLocaleString()} tools match “${deferredQuery.trim()}”`
      : "Bring specialist tools into your Clauxen workspace.";

  const selectCategory = (
    event: MouseEvent<HTMLAnchorElement>,
    nextCategory: string | null,
  ) => {
    event.preventDefault();
    const url = nextCategory
      ? `/plugins?category=${encodeURIComponent(nextCategory)}`
      : "/plugins";
    window.history.pushState(window.history.state, "", url);
    setCategorySlug(nextCategory);
    setQuery("");
  };

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
    <div className={cn(appPage.surface, "bg-[var(--app-panel-bg)]")}>
      <div className="app-scrollbar flex-1 overflow-y-auto bg-[var(--app-panel-bg)]">
        <nav className="sticky top-0 z-20 border-b border-[var(--ui-border-subtle)] bg-[color-mix(in_oklab,var(--app-panel-bg)_94%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between px-4 sm:px-7">
            {requestedCategory ? (
              <Link
                href="/plugins"
                onClick={(event) => selectCategory(event, null)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)]"
              >
                <ChevronLeft className="size-4" /> All plugins
              </Link>
            ) : (
              <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ui-fg-placeholder)]">
                <Sparkles className="size-3.5" /> Tool gallery
              </div>
            )}
            <div className="flex items-center rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-0.5">
              <span className="flex h-7 items-center rounded-[9px] bg-[var(--app-panel-bg)] px-3 text-[12.5px] font-medium text-[var(--ui-fg)] shadow-sm">
                Plugins
              </span>
              <Link
                href="/new#settings/Skills"
                className="flex h-7 items-center rounded-[9px] px-3 text-[12.5px] font-medium text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]"
              >
                Skills
              </Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-24 pt-5 sm:px-7 sm:pt-7">
          <header className="grid gap-5 rounded-[24px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-5 sm:p-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ui-fg-placeholder)]">
                {requestedCategory ? "Collection" : "Clauxen tools"}
              </p>
              <h1 className="mt-1.5 text-[24px] font-semibold leading-8 tracking-[-0.025em] text-[var(--ui-fg)]">
                {pageTitle}
              </h1>
              <p className="mt-1 max-w-[620px] text-[13.5px] leading-5 text-[var(--ui-fg-muted)]">
                {pageDescription}
              </p>
            </div>
            <form
              role="search"
              className="relative w-full"
              onSubmit={(event) => event.preventDefault()}
            >
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ui-fg-placeholder)]"
                strokeWidth={1.7}
              />
              <input
                type="search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={requestedCategory?.searchPlaceholder ?? "Find a plugin or capability"}
                aria-label="Search plugins"
                className="h-11 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] py-2 pl-10 pr-10 text-[13px] text-[var(--ui-fg)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)] focus:ring-2 focus:ring-[var(--ui-field-focus-ring)]"
              />
              {isLoading ? (
                <LoaderCircle className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--ui-fg-placeholder)]" />
              ) : null}
            </form>
          </header>

          {!isSearch ? (
            <div className="app-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Plugin categories">
              <Link
                href="/plugins"
                onClick={(event) => selectCategory(event, null)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  !categorySlug
                    ? "border-[var(--ui-fg)] bg-[var(--ui-fg)] text-[var(--app-panel-bg)]"
                    : "border-[var(--ui-border-subtle)] text-[var(--ui-fg-muted)] hover:border-[var(--ui-border)] hover:text-[var(--ui-fg)]",
                )}
              >
                Overview
              </Link>
              {data.categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/plugins?category=${encodeURIComponent(category.slug)}`}
                  onClick={(event) => selectCategory(event, category.slug)}
                  className={cn(
                    "shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                    categorySlug === category.slug
                      ? "border-[var(--ui-fg)] bg-[var(--ui-fg)] text-[var(--app-panel-bg)]"
                      : "border-[var(--ui-border-subtle)] text-[var(--ui-fg-muted)] hover:border-[var(--ui-border)] hover:text-[var(--ui-fg)]",
                  )}
                >
                  {category.title}
                </Link>
              ))}
            </div>
          ) : null}

          {!isSearch && !requestedCategory && installedItems.length > 0 ? (
            <section className="flex items-center gap-3 rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] px-4 py-3">
              <span className="shrink-0 text-[12px] font-semibold text-[var(--ui-fg)]">Your tools</span>
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                {installedItems.map((plugin) => (
                  <Link
                    key={plugin.id}
                    href={`/plugins/${pluginRouteSegment(plugin)}`}
                    prefetch
                    title={plugin.displayName}
                    className="rounded-[10px] p-1 transition-colors hover:bg-[var(--ui-hover-wash)]"
                  >
                    <PluginArtwork plugin={plugin} compact />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              The plugin directory could not be loaded. Please try again.
            </div>
          ) : null}

          {data.sections && !isSearch && !requestedCategory ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.sections.map((section) => (
                <section
                  key={section.slug}
                  aria-labelledby={`plugin-section-${section.slug}`}
                  className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-3 [content-visibility:auto] [contain-intrinsic-size:auto_390px]"
                >
                  <div className="flex items-center justify-between gap-4 px-1 pb-2 pt-0.5">
                    <div>
                      <h2 id={`plugin-section-${section.slug}`} className="text-[13px] font-semibold text-[var(--ui-fg)]">
                        {section.title}
                      </h2>
                      <p className="text-[11.5px] text-[var(--ui-fg-placeholder)]">
                        {section.count.toLocaleString()} available
                      </p>
                    </div>
                    <Link
                      href={`/plugins?category=${encodeURIComponent(section.slug)}`}
                      onClick={(event) => selectCategory(event, section.slug)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      View all <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {section.plugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        categorySlug={section.slug}
                        installed={installed.has(plugin.id)}
                        onToggle={() => togglePlugin(plugin.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section aria-label="Plugin results" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {data.plugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  categorySlug={requestedCategory?.slug ?? null}
                  installed={installed.has(plugin.id)}
                  onToggle={() => togglePlugin(plugin.id)}
                />
              ))}
            </section>
          )}

          {!data.sections && data.plugins.length === 0 && !isLoading ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ui-border)] text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--app-frame-bg)]">
                <Search className="size-4 text-[var(--ui-fg-muted)]" />
              </div>
              <h2 className="mt-3 text-[13px] font-semibold text-[var(--ui-fg)]">No plugins found</h2>
              <p className="mt-1 text-[12px] text-[var(--ui-fg-muted)]">Try a different name or collection.</p>
            </div>
          ) : null}

          {!data.sections && data.plugins.length > 0 && data.hasMore ? (
            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] px-4 text-[12.5px] font-medium text-[var(--ui-fg)] hover:bg-[var(--app-frame-bg)] disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                {isLoadingMore ? "Loading" : "Load more"}
              </button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
