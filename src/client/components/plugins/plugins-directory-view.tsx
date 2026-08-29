"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import { cn } from "@/lib/utils";
import {
  INITIAL_INSTALLED_PLUGINS,
  PLUGIN_SECTIONS,
  getPluginCategory,
  pluginCategorySlugForTitle,
  pluginIconPath,
  pluginSlug,
  type DirectoryPlugin,
} from "./plugin-directory-data";

const STORAGE_KEY = "clauxen_installed_directory_plugins_v1";

function PluginArtwork({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-black/10 bg-white",
        size === 40 ? "size-10 rounded-xl" : "size-8 rounded-[9px]",
      )}
    >
      <Image
        src={pluginIconPath(name)}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="size-full object-cover"
      />
    </span>
  );
}

function PluginRow({
  plugin,
  categorySlug,
  installed,
  onToggle,
}: {
  plugin: DirectoryPlugin;
  categorySlug: string;
  installed: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="group relative flex min-w-0 items-center rounded-2xl p-2 transition-colors duration-150 hover:bg-black/[0.035]">
      <Link
        href={`/plugins/${pluginSlug(plugin.name)}?category=${encodeURIComponent(categorySlug)}`}
        aria-label={`Open ${plugin.name} plugin`}
        className="flex min-w-0 flex-1 items-center gap-3.5 pr-3 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-zinc-400 focus-visible:after:ring-offset-2"
      >
        <PluginArtwork name={plugin.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium leading-[18px] text-zinc-900">
            {plugin.name}
          </h3>
          <p className="mt-0.5 truncate text-[13px] leading-[18px] text-zinc-500">
            {plugin.description}
          </p>
        </div>
      </Link>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${installed ? "Remove" : "Add"} ${plugin.name}`}
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

export function PluginsDirectoryView({
  initialCategory = null,
}: {
  initialCategory?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [activeCategorySlug, setActiveCategorySlug] = useState(initialCategory);
  const [showAllInstalled, setShowAllInstalled] = useState(false);
  const [installed, setInstalled] = useState<Set<string>>(
    () => new Set(INITIAL_INSTALLED_PLUGINS),
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const names = JSON.parse(saved) as unknown;
        if (Array.isArray(names)) {
          setInstalled(
            new Set(names.filter((item) => typeof item === "string")),
          );
        }
      }
    } catch {
      // Keep the Builder-provided installed set when local storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const syncCategoryFromUrl = () => {
      const category = new URLSearchParams(window.location.search).get(
        "category",
      );
      setActiveCategorySlug(getPluginCategory(category)?.slug ?? null);
      setQuery("");
    };

    window.addEventListener("popstate", syncCategoryFromUrl);
    return () => window.removeEventListener("popstate", syncCategoryFromUrl);
  }, []);

  const togglePlugin = (name: string) => {
    setInstalled((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // The in-memory interaction still works in private/restricted contexts.
      }
      return next;
    });
  };

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return PLUGIN_SECTIONS;
    return PLUGIN_SECTIONS.map((section) => ({
      ...section,
      plugins: section.plugins.filter((plugin) =>
        `${plugin.name} ${plugin.description} ${section.title}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    })).filter((section) => section.plugins.length > 0);
  }, [normalizedQuery]);
  const activeCategory = getPluginCategory(activeCategorySlug);
  const visibleCategoryPlugins = useMemo(() => {
    if (!activeCategory) return [];
    if (!normalizedQuery) return activeCategory.plugins;
    return activeCategory.plugins.filter((plugin) =>
      `${plugin.name} ${plugin.description}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [activeCategory, normalizedQuery]);

  const installedNames = [...installed];
  const visibleInstalled = showAllInstalled
    ? installedNames
    : installedNames.slice(0, 14);
  const hiddenInstalledCount = Math.max(0, installedNames.length - 14);

  if (activeCategory) {
    return (
      <div className={appPage.surface}>
        <div className="app-scrollbar flex-1 overflow-y-auto">
          <nav className="sticky top-0 z-20 flex bg-[rgba(252,252,252,0.88)] px-4 pb-2 pt-2.5 backdrop-blur-xl">
            <Link
              href="/plugins"
              onClick={() => {
                setActiveCategorySlug(null);
                setQuery("");
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-1.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-black/[0.04]"
            >
              <ChevronLeft className="size-5" strokeWidth={1.7} />
              Plugins
            </Link>
          </nav>

          <main className="mobile-page-inset mx-auto w-full max-w-[832px] px-4 pb-24 pt-8 sm:px-4 sm:pt-10">
            <header className="flex flex-wrap items-start gap-5">
              <div className="min-w-[240px] flex-1">
                <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.025em] text-zinc-950">
                  {activeCategory.title}
                </h1>
                <p className="mt-1 text-[15px] leading-6 text-zinc-600">
                  {activeCategory.description}
                </p>
              </div>
              <form
                role="search"
                className="relative w-full sm:ml-auto sm:w-[270px]"
                onSubmit={(event) => event.preventDefault()}
              >
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-zinc-400"
                  strokeWidth={1.6}
                />
                <input
                  type="search"
                  name="category-plugin-search"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={activeCategory.searchPlaceholder}
                  aria-label={activeCategory.searchPlaceholder}
                  className="h-10 w-full rounded-full border border-black/10 bg-white py-2 pl-9 pr-3 text-[14px] leading-5 text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200/70"
                />
              </form>
            </header>

            {visibleCategoryPlugins.length > 0 ? (
              <section
                aria-label={`${activeCategory.title} plugins`}
                className="mt-12 grid grid-cols-1 gap-x-7 gap-y-1 sm:grid-cols-2"
              >
                {visibleCategoryPlugins.map((plugin) => (
                  <PluginRow
                    key={plugin.name}
                    plugin={plugin}
                    categorySlug={activeCategory.slug}
                    installed={installed.has(plugin.name)}
                    onToggle={() => togglePlugin(plugin.name)}
                  />
                ))}
              </section>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-black/[0.04]">
                  <Search className="size-5 text-zinc-500" strokeWidth={1.6} />
                </div>
                <h2 className="mt-3 text-[15px] font-medium text-zinc-900">
                  No plugins found
                </h2>
                <p className="mt-1 text-[13px] text-zinc-500">
                  Try a different plugin name.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={appPage.surface}>
      <div className="app-scrollbar flex-1 overflow-y-auto">
        <nav
          aria-label="Directory type"
          className="sticky top-0 z-20 hidden justify-center bg-[rgba(252,252,252,0.88)] pb-2 pt-2.5 backdrop-blur-xl sm:flex"
        >
          <div
            role="tablist"
            aria-label="Directory type"
            className="relative grid grid-cols-2 rounded-full bg-black/[0.03] p-px"
          >
            <span className="pointer-events-none absolute bottom-0 left-0 top-0 w-1/2 rounded-full border border-black/10 bg-white shadow-[0_1px_6px_rgba(0,0,0,0.05)]" />
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

        <main className="mobile-page-inset mx-auto flex w-full max-w-[832px] flex-col gap-6 px-4 pb-24 pt-5 sm:px-4 sm:pt-[62px]">
          <header className="flex min-h-[76px] flex-wrap items-start gap-4">
            <div className="min-w-[220px] flex-1">
              <h1 className="text-[28px] font-medium leading-9 tracking-[-0.025em] text-zinc-950">
                Plugins
              </h1>
              <p className="mt-1 text-[16px] leading-6 text-zinc-600">
                Work with Clauxen across your favorite tools.
              </p>
            </div>
            <form
              role="search"
              className="relative w-full sm:ml-auto sm:w-60"
              onSubmit={(event) => event.preventDefault()}
            >
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
                strokeWidth={1.6}
              />
              <input
                type="search"
                name="plugin-search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search plugins"
                aria-label="Search plugins"
                className="h-9 w-full rounded-full border border-black/10 bg-white py-2 pl-9 pr-3 text-[14px] leading-5 text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200/70"
              />
            </form>
          </header>

          {!normalizedQuery && installedNames.length > 0 ? (
            <section aria-labelledby="installed-plugins-heading">
              <button
                type="button"
                onClick={() => setShowAllInstalled((value) => !value)}
                className="group mb-2 inline-flex items-center gap-0.5 text-[14px] font-medium leading-5 text-zinc-900"
              >
                <span id="installed-plugins-heading">Installed</span>
                <ChevronRight
                  className={cn(
                    "size-4 text-zinc-400 transition-transform duration-200 group-hover:text-zinc-700",
                    showAllInstalled && "rotate-90",
                  )}
                  strokeWidth={1.7}
                />
              </button>
              <div className="-ml-1 flex flex-wrap gap-0.5">
                {visibleInstalled.map((name) => (
                  <Link
                    key={name}
                    href={`/plugins/${pluginSlug(name)}`}
                    title={name}
                    aria-label={`Open ${name} plugin`}
                    className="flex size-12 items-center justify-center rounded-[14px] transition-colors hover:bg-black/[0.04]"
                  >
                    <PluginArtwork name={name} size={32} />
                  </Link>
                ))}
                {!showAllInstalled && hiddenInstalledCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllInstalled(true)}
                    className="flex h-12 min-w-12 items-center justify-center rounded-[14px] px-2 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-800"
                  >
                    +{hiddenInstalledCount}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {visibleSections.length > 0 ? (
            visibleSections.map((section) => (
              <section
                key={section.title}
                aria-labelledby={`plugin-section-${section.title}`}
                className="[content-visibility:auto] [contain-intrinsic-size:auto_260px]"
              >
                <div className="mb-1 flex items-center justify-between gap-4 pb-1">
                  <h2
                    id={`plugin-section-${section.title}`}
                    className="text-[14px] font-medium leading-5 text-zinc-900"
                  >
                    {section.title}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-2">
                  {section.plugins.map((plugin) => (
                    <PluginRow
                      key={plugin.name}
                      plugin={plugin}
                      categorySlug={pluginCategorySlugForTitle(section.title)}
                      installed={installed.has(plugin.name)}
                      onToggle={() => togglePlugin(plugin.name)}
                    />
                  ))}
                </div>
                {!normalizedQuery ? (
                  <Link
                    href={`/plugins?category=${pluginCategorySlugForTitle(section.title)}`}
                    onClick={() => {
                      setActiveCategorySlug(
                        pluginCategorySlugForTitle(section.title),
                      );
                      setQuery("");
                    }}
                    className="group -ml-2 mt-2 flex min-h-12 items-center gap-3 rounded-2xl p-2 text-[14px] text-zinc-600 transition-colors hover:bg-black/[0.035] hover:text-zinc-800"
                  >
                    <div className="flex shrink-0 items-center pl-1 pr-1">
                      {(section.more.length > 0
                        ? section.more
                        : section.plugins
                            .slice(0, 2)
                            .map((plugin) => plugin.name)
                      ).map((name, index) => (
                        <span key={name} className={cn(index > 0 && "-ml-1.5")}>
                          <PluginArtwork name={name} size={24} />
                        </span>
                      ))}
                    </div>
                    <span className="min-w-0 flex-1 truncate">
                      See{" "}
                      {(section.more.length > 0
                        ? section.more
                        : section.plugins.map((plugin) => plugin.name)
                      )
                        .slice(0, 2)
                        .join(", ")}
                      , and more
                    </span>
                    <ChevronRight className="mr-2 size-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ) : null}
              </section>
            ))
          ) : (
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
          )}
        </main>
      </div>
    </div>
  );
}
