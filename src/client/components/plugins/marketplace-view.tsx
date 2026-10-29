"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "@/components/ui/bootstrap-icon";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { marketplaceCatalog, pluginMatches, pluginsByIds } from "./catalog";
import { PluginMark } from "./plugin-mark";
import { cardDescription, stripCursorText } from "./plugin-copy";
import { PluginDetailPage } from "./plugin-detail-page";
import { usePluginConnections } from "./use-plugin-connections";
import { PRIORITY_CONNECTORS } from "@/lib/plugin-connectors";
import type { MarketplacePlugin } from "./types";

const CONNECTOR_IDS = new Set<string>(PRIORITY_CONNECTORS.map((connector) => connector.id));

const SECTION_TITLES: Record<string, string> = {
  featured: "Featured",
  "inbox-and-collaboration": "Inbox & collaboration",
  "documents-and-files": "Documents & files",
  "data-analytics": "Data & analytics",
  "agent-orchestration": "Agent orchestration",
  "finance-and-legal": "Finance & legal",
  "customer-support": "Customer support",
  sales: "Sales & CRM",
  plugins: "Developer tools",
};

const SECTION_PREVIEW = 6;

function sectionTitle(id: string, raw: string): string {
  return SECTION_TITLES[id] ?? raw.replace(/\s+Plugins$/i, "").trim();
}

function readSelectedFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("p") || params.get("id");
}

function writeSelectedToUrl(pluginId: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("id");
  url.searchParams.delete("connection");
  if (pluginId) url.searchParams.set("p", pluginId);
  else url.searchParams.delete("p");
  window.history.pushState(null, "", `${url.pathname}${url.search}`);
}

export function MarketplaceView() {
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "connectors" | "connected">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const connections = usePluginConnections();
  const accountStatus = new Map<string, string>(connections.connections.map((account) => [account.pluginId, account.status]));
  const availableById = new Map<string, (typeof connections.availability)[number]>(connections.availability.map((item) => [item.pluginId, item]));
  const connectionBadge = (pluginId: string) => {
    const status = accountStatus.get(pluginId);
    if (status === "active") return "Connected";
    if (status === "reauthorization_required") return "Reconnect required";
    if (!CONNECTOR_IDS.has(pluginId)) return "Connector not available yet";
    const availability = availableById.get(pluginId);
    return availability ? availability.ready ? "Connect account" : "Setup pending" : "Account connector";
  };

  useEffect(() => {
    setSelectedId(readSelectedFromUrl());
    const onPop = () => setSelectedId(readSelectedFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openPlugin = (pluginId: string) => {
    setSelectedId(pluginId);
    writeSelectedToUrl(pluginId);
    document.querySelector("[data-plugins-scroll]")?.scrollTo({ top: 0 });
  };

  const closePlugin = () => {
    setSelectedId(null);
    writeSelectedToUrl(null);
  };

  const sections = useMemo(
    () =>
      marketplaceCatalog.sections
        .map((section) => ({
          id: section.id,
          title: sectionTitle(section.id, section.title),
          plugins: pluginsByIds(section.pluginIds),
        }))
        .filter((section) => section.plugins.length > 0),
    [],
  );

  const searchResults = useMemo(() => {
    const needle = query.trim();
    if (!needle && filter === "all") return null;
    const connectedIds = new Set<string>(connections.connections.map((account) => account.pluginId));
    return Object.values(marketplaceCatalog.plugins).filter((plugin) =>
      (!needle || pluginMatches(plugin, needle)) &&
      (filter !== "connectors" || CONNECTOR_IDS.has(plugin.id)) &&
      (filter !== "connected" || connectedIds.has(plugin.id)),
    );
  }, [query, filter, connections.connections]);

  return (
    <div className="plugins-page relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg,#fff)] font-sans text-zinc-900 dark:text-zinc-100">
      {isMobile ? (
        <MobilePageHeader
          title={selectedId ? "Plugin" : "Plugins"}
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
        />
      ) : null}

      <div
        className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-6 sm:px-8 sm:pt-10"
        data-scroll-region=""
        data-plugins-scroll=""
      >
        {selectedId ? (
          <PluginDetailPage pluginId={selectedId} onBack={closePlugin} connections={connections} />
        ) : (
          <div className="mx-auto w-full max-w-[960px]">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">Plugins</h1>
                <p className="mt-1.5 max-w-[520px] text-[14px] leading-[22px] text-zinc-500 dark:text-zinc-400">
                  Browse the apps and tools that extend what Clauxen can work with. Explore each
                  plugin&apos;s capabilities, skills, and example prompts.
                </p>
              </div>
              <label className="relative flex h-10 w-full items-center sm:w-[280px]">
                <Search className="pointer-events-none absolute left-3.5 text-[14px] text-zinc-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search plugins"
                  aria-label="Search plugins"
                  className="h-10 w-full rounded-full border border-black/[0.08] bg-white pl-10 pr-9 text-[13.5px] outline-none transition-colors placeholder:text-zinc-400 focus:border-black/[0.18] dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/25"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    className="absolute right-2 flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-black/[0.05] hover:text-zinc-700 dark:hover:bg-white/10"
                  >
                    <X className="text-[11px]" />
                  </button>
                ) : null}
              </label>
            </header>

            <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter plugins">
              {([ ["all", "All"], ["connectors", "Account connectors"], ["connected", "Connected"] ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`min-h-9 rounded-full border px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${filter === value ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-black/10 text-zinc-500 dark:border-white/10 dark:text-zinc-400"}`}
                >{label}</button>
              ))}
            </div>
            {connections.error ? <p role="alert" className="mt-3 text-[13px] text-zinc-500">{connections.error} <button type="button" className="underline" onClick={() => { void connections.refresh(); }}>Retry</button></p> : null}
            {filter === "connected" && connections.loading ? <p role="status" className="mt-3 text-[13px] text-zinc-500">Checking connections…</p> : null}
            {filter === "connected" && connections.unauthorized ? <a href="/login?redirectTo=%2Fplugins" className="mt-3 inline-block text-[13px] underline">Sign in to connect</a> : null}

            {searchResults ? (
              <section className="mt-7">
                <p className="mb-3 text-[13px] text-zinc-500">
                  {searchResults.length} result{searchResults.length === 1 ? "" : "s"}{query.trim() ? ` for “${query.trim()}”` : ""}
                </p>
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {searchResults.map((plugin) => (
                      <PluginCard key={plugin.id} plugin={plugin} connectionBadge={connectionBadge(plugin.id)} onOpen={() => openPlugin(plugin.id)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title={filter === "connected" ? "No connected plugins" : "No plugins found"} body={filter === "connected" ? "Connect an account from its plugin page to use it with the assistant." : "Try a different name."} />
                )}
              </section>
            ) : (
              <>
                {sections.map((section) => {
                  const isOpen = Boolean(expanded[section.id]);
                  const remaining = section.plugins.length - SECTION_PREVIEW;
                  const shown = isOpen ? section.plugins : section.plugins.slice(0, SECTION_PREVIEW);
                  return (
                    <section key={section.id} className="mt-8">
                      <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">
                        {section.title}
                      </h2>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {shown.map((plugin) => (
                          <PluginCard
                            key={`${section.id}-${plugin.id}`}
                            plugin={plugin}
                            connectionBadge={connectionBadge(plugin.id)}
                            onOpen={() => openPlugin(plugin.id)}
                          />
                        ))}
                      </div>
                      {remaining > 0 ? (
                        <div className="mt-4 flex justify-center">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((current) => ({
                                ...current,
                                [section.id]: !current[section.id],
                              }))
                            }
                            className="no-hover-overlay inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 text-[12.5px] font-medium text-zinc-600 transition-colors hover:border-black/[0.16] hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/20 dark:hover:text-zinc-100"
                          >
                            {isOpen ? "Show less" : `Show ${remaining} more`}
                            <ChevronDown
                              className={`text-[11px] transition-transform ${isOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PluginCard({
  plugin,
  connectionBadge,
  onOpen,
}: {
  plugin: MarketplacePlugin;
  connectionBadge: string;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex min-h-[132px] cursor-pointer flex-col rounded-2xl border border-black/[0.07] bg-white p-4 text-left transition-[border-color,box-shadow] duration-150 hover:border-black/[0.14] hover:shadow-[0_10px_30px_-22px_rgba(20,21,26,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-white/[0.08] dark:bg-zinc-900 dark:hover:border-white/[0.16]"
    >
      <div className="flex items-start justify-between gap-3">
        <PluginMark name={plugin.name} iconUrl={plugin.iconUrl} size={40} className="rounded-xl" />
        <span className="inline-flex h-7 max-w-[132px] items-center truncate rounded-full bg-zinc-100 px-2.5 text-[12px] font-medium text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
          {plugin.category}
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-[14px] font-semibold tracking-[-0.01em]">
          {stripCursorText(plugin.name) || plugin.name}
        </p>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-[18px] text-zinc-500 dark:text-zinc-400">
          {cardDescription(plugin.description, 100)}
        </p>
        <p className={`mt-2 text-[11px] ${connectionBadge === "Connected" ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>
          {connectionBadge}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-black/[0.1] px-6 py-14 text-center dark:border-white/10">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1.5 max-w-[360px] text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">{body}</p>
    </div>
  );
}
