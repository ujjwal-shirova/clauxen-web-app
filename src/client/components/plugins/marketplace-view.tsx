"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  ExternalLink,
  Layers,
  Loader2,
  Plug,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import {
  marketplaceCatalog,
  pluginMatches,
  pluginsByIds,
} from "./catalog";
import { PluginCard } from "./plugin-card";
import { PluginDetailDialog } from "./plugin-detail-dialog";
import { PluginMark } from "./plugin-mark";
import { stripCursorText } from "./plugin-copy";
import {
  startPluginAuthorization,
  usePluginConnections,
  type PluginConnection,
} from "./use-plugin-connections";
import type { MarketplacePlugin } from "./types";

type ViewTab = "marketplace" | "installed";

type CategoryFilter =
  | "all"
  | "featured"
  | "infrastructure"
  | "productivity"
  | "data"
  | "orchestration"
  | "communication"
  | "finance";

const CATEGORIES: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "All plugins" },
  { id: "featured", label: "Featured" },
  { id: "infrastructure", label: "Infrastructure & Dev" },
  { id: "productivity", label: "Productivity" },
  { id: "data", label: "Data & Analytics" },
  { id: "orchestration", label: "Agent Orchestration" },
  { id: "communication", label: "Communication" },
  { id: "finance", label: "Finance & Payments" },
];

const INITIAL_DISPLAY_COUNT = 36;
const PAGE_SIZE = 36;

export function MarketplaceView() {
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ViewTab>("marketplace");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Pop-up container state: the selected plugin detail modal.
  const [detailPlugin, setDetailPlugin] = useState<MarketplacePlugin | null>(null);
  const [startingPluginId, setStartingPluginId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const {
    connections,
    loading: connectionsLoading,
    refresh: refreshConnections,
    revoke,
  } = usePluginConnections();

  // Listen for OAuth completion
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        pluginId?: string;
        pluginName?: string;
      } | null;
      if (data?.type === "clauxen:plugin-connected") {
        void refreshConnections();
        setDetailPlugin(null);
        toast({
          title: "Plugin connected",
          description: `${data.pluginName || "Integration"} has been added to Clauxen.`,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshConnections, toast]);

  const connectedIds = useMemo(
    () => new Set(connections.map((c) => c.pluginId)),
    [connections],
  );

  const allPlugins = useMemo<MarketplacePlugin[]>(
    () => Object.values(marketplaceCatalog.plugins),
    [],
  );

  const featuredPluginIds = useMemo(
    () =>
      marketplaceCatalog.sections.find((s) => s.id === "featured")?.pluginIds ??
      [],
    [],
  );

  const featuredPlugins = useMemo(
    () => pluginsByIds(featuredPluginIds),
    [featuredPluginIds],
  );

  // Filtered plugins based on search & category
  const filteredPlugins = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return allPlugins.filter((plugin) => {
      // Search filter
      if (needle && !pluginMatches(plugin, needle)) {
        return false;
      }

      // Category filter
      if (selectedCategory === "all") return true;
      if (selectedCategory === "featured") {
        return (
          featuredPluginIds.includes(plugin.id) ||
          plugin.category === "Featured"
        );
      }
      if (selectedCategory === "infrastructure") {
        return /infrastructure/i.test(plugin.category);
      }
      if (selectedCategory === "productivity") {
        return /productivity|scheduling|canvas|documents/i.test(plugin.category);
      }
      if (selectedCategory === "data") {
        return /data|analytics|research/i.test(plugin.category);
      }
      if (selectedCategory === "orchestration") {
        return /orchestration/i.test(plugin.category);
      }
      if (selectedCategory === "communication") {
        return /inbox|collaboration|support|sales/i.test(plugin.category);
      }
      if (selectedCategory === "finance") {
        return /payments|finance/i.test(plugin.category);
      }

      return true;
    });
  }, [allPlugins, featuredPluginIds, query, selectedCategory]);

  // Reset display count on filter change
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [query, selectedCategory]);

  const visiblePlugins = useMemo(
    () => filteredPlugins.slice(0, displayCount),
    [displayCount, filteredPlugins],
  );

  const openPlugin = useCallback((plugin: MarketplacePlugin) => {
    setAddError(null);
    setDetailPlugin(plugin);
  }, []);

  const handleAuthorize = useCallback(
    async (plugin: MarketplacePlugin) => {
      const authTab = window.open("about:blank", "_blank");
      setStartingPluginId(plugin.id);
      setAddError(null);

      try {
        const result = await startPluginAuthorization(plugin.id);
        if (result.ok && result.authorizeUrl) {
          if (authTab) {
            authTab.location.href = result.authorizeUrl;
          } else {
            window.open(result.authorizeUrl, "_blank", "noopener,noreferrer");
          }
        } else {
          if (authTab) authTab.close();
          const msg = result.ok
            ? "Could not start authorization."
            : result.message;
          setAddError(msg);
          toast({
            variant: "destructive",
            title: "Authorization failed",
            description: msg,
          });
        }
      } catch {
        if (authTab) authTab.close();
        const msg = "Unable to connect to authorization service.";
        setAddError(msg);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: msg,
        });
      } finally {
        setStartingPluginId(null);
      }
    },
    [toast],
  );

  const handleRemoveConnection = useCallback(
    async (connection: PluginConnection) => {
      try {
        await revoke(connection.id);
        toast({
          title: "Plugin disconnected",
          description: `${connection.pluginName || "Plugin"} was removed.`,
        });
      } catch {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: "Could not remove this plugin.",
        });
      }
    },
    [revoke, toast],
  );

  const handleRemoveByPluginId = useCallback(
    async (pluginId: string) => {
      const target = connections.find((c) => c.pluginId === pluginId);
      if (target) {
        await handleRemoveConnection(target);
        setDetailPlugin(null);
      }
    },
    [connections, handleRemoveConnection],
  );

  // Search filtered installed connections
  const filteredConnections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return connections;
    return connections.filter((c) =>
      `${c.pluginName} ${c.pluginId}`.toLowerCase().includes(needle),
    );
  }, [connections, query]);

  return (
    <div className="plugin-marketplace relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans select-none">
      {isMobile ? (
        <MobilePageHeader
          title="Plugins"
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
        />
      ) : null}

      {/* Main Container */}
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-1 flex-col px-4 pt-4 sm:px-8 sm:pt-7">
        {/* Header */}
        <header className="shrink-0 space-y-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--ui-fg)] sm:text-[24px]">
                Plugins & Integrations
              </h1>
              <p className="mt-0.5 text-[13px] leading-5 text-[var(--ui-fg-muted)]">
                Connect your workspace with third-party APIs, platforms, and
                tools.
              </p>
            </div>

            {/* Top View Switcher: Marketplace vs Connected */}
            <div className="flex items-center rounded-lg border border-[var(--ui-border)] bg-[var(--ui-muted-surface)] p-0.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("marketplace")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors outline-none",
                  activeTab === "marketplace"
                    ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs"
                    : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                )}
              >
                <Layers className="size-3.5" />
                <span>Marketplace</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("installed")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors outline-none",
                  activeTab === "installed"
                    ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs"
                    : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                )}
              >
                <Plug className="size-3.5" />
                <span>Installed</span>
                {connections.length > 0 ? (
                  <span className="ml-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {connections.length}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Search Bar & Categories (Only in Marketplace tab) */}
          {activeTab === "marketplace" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="relative flex h-8 min-w-[200px] max-w-[320px] flex-1 items-center">
                  <Search
                    className="pointer-events-none absolute left-2.5 size-3.5 text-[var(--ui-fg-placeholder)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search 380+ plugins, platforms, or tools…"
                    aria-label="Search plugins"
                    className="h-8 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-field-bg)] pl-8 pr-7 text-[12.5px] text-[var(--ui-fg)] placeholder:text-[var(--ui-fg-placeholder)] outline-none transition-colors focus:border-[var(--ui-field-focus-border)]"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-1.5 size-5 grid place-items-center rounded-md text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </label>

                {query ? (
                  <span className="text-[12px] text-[var(--ui-fg-placeholder)] tabular-nums">
                    {filteredPlugins.length} {filteredPlugins.length === 1 ? "result" : "results"}
                  </span>
                ) : null}
              </div>

              {/* Category Pills */}
              <div
                className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-hide border-b border-[var(--ui-border-subtle)] pb-2.5"
                role="tablist"
                aria-label="Plugin categories"
              >
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "h-7 shrink-0 rounded-md px-2.5 text-[12px] font-medium transition-colors outline-none",
                      selectedCategory === cat.id
                        ? "bg-[var(--ui-fg)] text-[var(--app-panel-bg)] shadow-sm"
                        : "text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Installed Tab Search */
            <div className="flex items-center gap-2 border-b border-[var(--ui-border-subtle)] pb-2.5">
              <label className="relative flex h-8 min-w-[200px] max-w-[320px] flex-1 items-center">
                <Search
                  className="pointer-events-none absolute left-2.5 size-3.5 text-[var(--ui-fg-placeholder)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter installed plugins…"
                  aria-label="Filter installed plugins"
                  className="h-8 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-field-bg)] pl-8 pr-7 text-[12.5px] text-[var(--ui-fg)] placeholder:text-[var(--ui-fg-placeholder)] outline-none transition-colors focus:border-[var(--ui-field-focus-border)]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 size-5 grid place-items-center rounded-md text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </label>
              <span className="text-[12px] text-[var(--ui-fg-placeholder)]">
                {connections.length} connected
              </span>
            </div>
          )}
        </header>

        {/* Scrollable Main Area */}
        <div
          className="app-scrollbar min-h-0 flex-1 overflow-y-auto pb-24"
          data-scroll-region=""
        >
          {activeTab === "installed" ? (
            /* =================== Installed / Connected View =================== */
            <div className="py-2">
              {filteredConnections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="grid size-12 place-items-center rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)] shadow-xs">
                    <Plug className="size-5" strokeWidth={1.75} />
                  </div>
                  <h2 className="mt-3.5 text-[15px] font-medium tracking-tight text-[var(--ui-fg)]">
                    {query ? "No matching connected plugins" : "No plugins installed yet"}
                  </h2>
                  <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--ui-fg-muted)]">
                    {query
                      ? `No connected plugin matches “${query}”.`
                      : "Explore the marketplace to connect tools like Google Drive, Slack, GitHub, or Notion to your workspace."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActiveTab("marketplace");
                    }}
                    className={cn(appBtn.secondarySm, "mt-4 h-8 px-3.5 gap-1.5")}
                  >
                    <Layers className="size-3.5" />
                    <span>Browse marketplace</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {filteredConnections.map((conn) => {
                    const plugin = marketplaceCatalog.plugins[conn.pluginId];
                    const name = conn.pluginName || conn.pluginId;

                    return (
                      <div
                        key={conn.id}
                        className="flex flex-col justify-between rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] p-4 transition-all hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)]"
                      >
                        <div className="flex items-start gap-3">
                          <PluginMark
                            name={name}
                            iconUrl={conn.pluginIconUrl ?? plugin?.iconUrl}
                            size={40}
                            className="rounded-lg border border-[var(--ui-border-subtle)] shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--ui-fg)]">
                              {name}
                            </h3>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active on workspace</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-[var(--ui-border-subtle)] pt-3">
                          <button
                            type="button"
                            onClick={() =>
                              openPlugin(
                                plugin ?? {
                                  id: conn.pluginId,
                                  name,
                                  description: "",
                                  author: "",
                                  iconUrl: conn.pluginIconUrl ?? "",
                                  category: "Plugin",
                                  installed: true,
                                },
                              )
                            }
                            className="text-[12px] font-medium text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)] transition-colors"
                          >
                            Details
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleAuthorize(
                                  plugin ?? {
                                    id: conn.pluginId,
                                    name,
                                    description: "",
                                    author: "",
                                    iconUrl: conn.pluginIconUrl ?? "",
                                    category: "Plugin",
                                    installed: true,
                                  },
                                )
                              }
                              className={cn(appBtn.secondarySm, "h-7 px-2.5 text-[11.5px]")}
                            >
                              Reconnect
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveConnection(conn)}
                              aria-label={`Disconnect ${name}`}
                              className="size-7 grid place-items-center rounded-lg text-[var(--ui-fg-muted)] hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* =================== Marketplace View =================== */
            <div className="space-y-6 pt-1">
              {/* Featured Highlight Section (only when on 'All' and not searching) */}
              {!query && selectedCategory === "all" ? (
                <section aria-labelledby="featured-plugins-heading" className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-[var(--ui-fg)]">
                    <Sparkles className="size-3.5 text-amber-500" />
                    <h2 id="featured-plugins-heading">Popular & Verified Integrations</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {featuredPlugins.map((plugin) => (
                      <PluginCard
                        key={`featured-${plugin.id}`}
                        plugin={plugin}
                        connected={connectedIds.has(plugin.id)}
                        isStarting={startingPluginId === plugin.id}
                        onOpen={openPlugin}
                        onAdd={handleAuthorize}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* All / Category Grid */}
              <section aria-labelledby="marketplace-grid-heading" className="space-y-2.5">
                {!query && selectedCategory === "all" ? (
                  <div className="flex items-center justify-between pt-2">
                    <h2
                      id="marketplace-grid-heading"
                      className="text-[13px] font-semibold tracking-tight text-[var(--ui-fg)]"
                    >
                      All Integrations
                    </h2>
                    <span className="text-[11.5px] tabular-nums text-[var(--ui-fg-placeholder)]">
                      {filteredPlugins.length} available
                    </span>
                  </div>
                ) : null}

                {filteredPlugins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="grid size-12 place-items-center rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)] shadow-xs">
                      <Search className="size-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="mt-3.5 text-[15px] font-medium tracking-tight text-[var(--ui-fg)]">
                      No matching plugins
                    </h3>
                    <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--ui-fg-muted)]">
                      {query
                        ? `Nothing found matching “${query}”. Try adjusting your search or category.`
                        : "No plugins available in this category."}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setSelectedCategory("all");
                      }}
                      className={cn(appBtn.secondarySm, "mt-4 h-8 px-3 text-[12px]")}
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {visiblePlugins.map((plugin) => (
                        <PluginCard
                          key={plugin.id}
                          plugin={plugin}
                          connected={connectedIds.has(plugin.id)}
                          isStarting={startingPluginId === plugin.id}
                          onOpen={openPlugin}
                          onAdd={handleAuthorize}
                        />
                      ))}
                    </div>

                    {/* Load More Button */}
                    {displayCount < filteredPlugins.length ? (
                      <div className="flex justify-center pt-6 pb-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDisplayCount((prev) => prev + PAGE_SIZE)
                          }
                          className={cn(
                            appBtn.secondarySm,
                            "h-8 px-4 text-[12.5px] font-medium shadow-none hover:bg-[var(--ui-hover-wash)]",
                          )}
                        >
                          Show more integrations ({filteredPlugins.length - displayCount} remaining)
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up Container Dialog */}
      <PluginDetailDialog
        plugin={detailPlugin}
        connected={detailPlugin ? connectedIds.has(detailPlugin.id) : false}
        starting={startingPluginId === detailPlugin?.id}
        error={detailPlugin?.id === startingPluginId ? addError : null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailPlugin(null);
            setAddError(null);
          }
        }}
        onAdd={handleAuthorize}
        onRemove={handleRemoveByPluginId}
      />
    </div>
  );
}
