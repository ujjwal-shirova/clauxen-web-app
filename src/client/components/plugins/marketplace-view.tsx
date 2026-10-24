"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  marketplaceCatalog,
  pluginMatches,
  pluginsByIds,
} from "./catalog";
import { PluginDetailDialog } from "./plugin-detail-dialog";
import { AddPluginDialog } from "./add-plugin-dialog";
import { PluginDetailPage } from "./plugin-detail-page";
import { PluginMark } from "./plugin-mark";
import { stripCursorText } from "./plugin-copy";
import {
  startPluginAuthorization,
  usePluginConnections,
  type PluginConnection,
} from "./use-plugin-connections";
import type { MarketplacePlugin } from "./types";

type TopTab = "plugins" | "skills";
type ViewMode = "marketplace" | "installed" | "detail";
type FilterScope = "public" | "personal";

interface InstalledItemDefinition {
  id: string;
  name: string;
  iconUrl: string;
}

const DEFAULT_INSTALLED_ROW_ICONS: InstalledItemDefinition[] = [
  { id: "1password", name: "1Password", iconUrl: "https://cdn.clauxen.com/plugins/icons/1password.png" },
  { id: "hugging-face", name: "Hugging Face", iconUrl: "https://cdn.clauxen.com/plugins/icons/hugging-face.png" },
  { id: "linear", name: "Linear", iconUrl: "https://cdn.clauxen.com/plugins/icons/linear.png" },
  { id: "vercel", name: "Vercel", iconUrl: "https://cdn.clauxen.com/plugins/icons/vercel.png" },
  { id: "supabase", name: "Supabase", iconUrl: "https://cdn.clauxen.com/plugins/icons/supabase.png" },
  { id: "notion", name: "Notion", iconUrl: "https://cdn.clauxen.com/plugins/icons/notion.png" },
  { id: "github", name: "GitHub", iconUrl: "https://cdn.clauxen.com/plugins/icons/github.png" },
  { id: "mixpanel", name: "Mixpanel", iconUrl: "https://cdn.clauxen.com/plugins/icons/mixpanel.png" },
  { id: "health", name: "Health", iconUrl: "https://cdn.clauxen.com/plugins/icons/health.png" },
  { id: "gmail", name: "Gmail", iconUrl: "https://cdn.clauxen.com/plugins/icons/gmail.png" },
];

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "featured", label: "Popular" },
  { id: "productivity", label: "Productivity" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "data-analytics", label: "Data & Analytics" },
  { id: "inbox-and-collaboration", label: "Inbox" },
  { id: "agent-orchestration", label: "Agent Orchestration" },
  { id: "payments", label: "Payments" },
  { id: "sales", label: "Sales" },
  { id: "design", label: "Design" },
  { id: "plugins", label: "Developer Tools" },
] as const;

function getDisplayTitle(id: string, rawTitle: string): string {
  if (id === "featured") return "Popular";
  if (id === "inbox-and-collaboration") return "Inbox & Collaboration";
  if (id === "documents-and-files") return "Documents & Files";
  if (id === "sales") return "Sales & CRM";
  if (id === "plugins") return "Developer Tools & Extensions";
  return rawTitle.replace(/\s+Plugins$/i, "").trim();
}

export function MarketplaceView() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const { toast } = useToast();

  const [topTab, setTopTab] = useState<TopTab>("plugins");
  const [viewMode, setViewMode] = useState<ViewMode>("marketplace");
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<FilterScope>("public");
  const [query, setQuery] = useState("");

  // Sync URL query (?p=... or ?id=...) on mount & popstate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p =
        new URLSearchParams(window.location.search).get("p") ||
        new URLSearchParams(window.location.search).get("id");
      if (p) {
        setSelectedPluginId(p);
        setViewMode("detail");
      }
    }

    const onPopState = () => {
      const p =
        new URLSearchParams(window.location.search).get("p") ||
        new URLSearchParams(window.location.search).get("id");
      if (p) {
        setSelectedPluginId(p);
        setViewMode("detail");
      } else {
        setSelectedPluginId(null);
        setViewMode("marketplace");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [detailPlugin, setDetailPlugin] = useState<MarketplacePlugin | null>(null);
  const [customAddPlugin, setCustomAddPlugin] = useState<MarketplacePlugin | null>(null);
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

  // Search filtered plugins across catalog
  const filteredSearchPlugins = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return allPlugins.filter((plugin) => pluginMatches(plugin, needle));
  }, [allPlugins, query]);

  // User added custom plugins
  const [customPlugins, setCustomPlugins] = useState<MarketplacePlugin[]>([]);

  // Personal/custom plugins: only custom ones created/added by user
  const personalPlugins = useMemo(() => {
    return customPlugins;
  }, [customPlugins]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const sectionsData = useMemo(() => {
    return marketplaceCatalog.sections
      .map((section) => {
        const plugins = pluginsByIds(section.pluginIds);
        return {
          id: section.id,
          rawTitle: section.title,
          displayTitle: getDisplayTitle(section.id, section.title),
          plugins,
        };
      })
      .filter((s) => s.plugins.length > 0);
  }, []);

  const displayedSections = useMemo(() => {
    if (selectedCategory === "all") {
      return sectionsData;
    }
    return sectionsData.filter((s) => s.id === selectedCategory);
  }, [sectionsData, selectedCategory]);

  const openPluginById = useCallback(
    (pluginId: string, fallbackName?: string, fallbackDescription?: string) => {
      setAddError(null);
      setSelectedPluginId(pluginId);
      setViewMode("detail");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("p", pluginId);
        window.history.pushState(null, "", url.toString());
      }
    },
    [],
  );

  const handleBackToMarketplace = useCallback(() => {
    setSelectedPluginId(null);
    setViewMode("marketplace");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("p");
      url.searchParams.delete("id");
      window.history.pushState(null, "", url.pathname);
    }
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

  // Installed view list
  const installedList = useMemo(() => {
    if (connections.length > 0) {
      return connections.map((conn) => {
        const catalogItem = marketplaceCatalog.plugins[conn.pluginId];
        return {
          id: conn.pluginId,
          name: conn.pluginName || conn.pluginId,
          description: catalogItem?.description || "Connected to your workspace.",
          iconUrl: conn.pluginIconUrl ?? catalogItem?.iconUrl ?? "",
          conn,
        };
      });
    }
    // Fallback display list for empty state
    return DEFAULT_INSTALLED_ROW_ICONS.slice(0, 6).map((item) => {
      const catalogItem = marketplaceCatalog.plugins[item.id];
      return {
        id: item.id,
        name: item.name,
        description: catalogItem?.description || "Ready to connect to your workspace.",
        iconUrl: item.iconUrl || catalogItem?.iconUrl || "",
        conn: null,
      };
    });
  }, [connections]);

  return (
    <div className="plugin-marketplace relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg,#ffffff)] text-neutral-900 dark:text-neutral-100 font-sans select-none">
      {isMobile ? (
        <MobilePageHeader
          title={
            viewMode === "detail"
              ? "Plugin Details"
              : viewMode === "installed"
                ? "Installed Plugins"
                : "Plugins"
          }
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
        />
      ) : null}

      {/* Main Inner Container */}
      <div
        className="app-scrollbar flex-1 min-h-0 overflow-y-auto px-5 sm:px-10 pt-5 pb-20"
        data-scroll-region=""
      >
        {viewMode === "detail" && selectedPluginId ? (
          <PluginDetailPage
            pluginId={selectedPluginId}
            onBack={handleBackToMarketplace}
            connected={connectedIds.has(selectedPluginId)}
            isStarting={startingPluginId === selectedPluginId}
            onConnect={handleAuthorize}
            onDisconnect={handleRemoveByPluginId}
          />
        ) : (
          <div className="mx-auto w-full max-w-[860px]">
            {/* Top Bar Header */}
          <div className="flex items-center justify-between pb-6">
            {/* Top Switcher: Plugins | Skills */}
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setTopTab("plugins");
                  setViewMode("marketplace");
                }}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none",
                  topTab === "plugins"
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-none"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                )}
              >
                Plugins
              </button>

              <button
                type="button"
                onClick={() => {
                  setTopTab("skills");
                  router.push("/customize/skills");
                }}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors outline-none",
                  topTab === "skills"
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-none"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                )}
              >
                Skills
              </button>
            </div>

            {/* Top Right Controls: Settings & Add Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/settings")}
                aria-label="Settings"
                className="grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                <Settings className="size-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 px-3.5 py-1.5 text-xs font-semibold shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors outline-none"
                  >
                    <span>Add</span>
                    <ChevronDown className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1 shadow-lg text-xs"
                >
                  <DropdownMenuItem
                    onClick={() => {
                      setCustomAddPlugin({
                        id: "custom-mcp",
                        name: "Custom MCP Plugin",
                        description: "Connect to a custom Model Context Protocol server via remote endpoint.",
                        author: "Custom Endpoint",
                        iconUrl: "",
                        category: "Developer Tools",
                        installed: false,
                      });
                    }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Plus className="size-3.5" />
                    <span>Add MCP Server</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/customize/skills")}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Wrench className="size-3.5" />
                    <span>Create Custom Skill</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Installed Drill-Down View */}
          {viewMode === "installed" ? (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("marketplace")}
                    aria-label="Back to plugins"
                    className="grid size-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 transition-colors"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                      Installed Plugins
                    </h1>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {connections.length}{" "}
                      {connections.length === 1 ? "plugin" : "plugins"} active on your workspace
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {installedList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3.5 px-1 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-xl flex items-center justify-center shrink-0 border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1.5 shadow-xs overflow-hidden">
                        <PluginMark name={item.name} iconUrl={item.iconUrl} size={28} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {item.name}
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active</span>
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPluginById(item.id, item.name, item.description)}
                        className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        Details
                      </button>
                      {item.conn ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveConnection(item.conn)}
                          aria-label={`Disconnect ${item.name}`}
                          className="grid size-7 place-items-center rounded-lg text-neutral-400 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Main Marketplace Screen */
            <div className="space-y-6">
              {/* Title & Subtitle */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  Plugins
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Connect plugins to let Clauxen work across your tools
                </p>
              </div>

              {/* Rounded-full Search Bar */}
              <div className="relative flex items-center w-full rounded-full border border-neutral-200/90 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:border-neutral-400 dark:focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-200/50 dark:focus-within:ring-neutral-800 transition-all">
                <Search className="size-4 text-neutral-400 shrink-0 mr-2.5" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search plugins"
                  aria-label="Search plugins"
                  className="w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="grid size-5 place-items-center rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Search Active View */}
              {query.trim() ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500">
                      Search results ({filteredSearchPlugins.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                    >
                      Clear search
                    </button>
                  </div>

                  {filteredSearchPlugins.length === 0 ? (
                    <div className="py-16 text-center text-neutral-500 text-sm">
                      No plugins found matching &ldquo;{query}&rdquo;.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3.5">
                      {filteredSearchPlugins.map((plugin) => (
                        <div
                          key={plugin.id}
                          onClick={() => openPluginById(plugin.id, plugin.name, plugin.description)}
                          className="flex items-center justify-between py-2 px-1 cursor-pointer group transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                            <div className="size-9 rounded-lg flex items-center justify-center shrink-0 border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1.5 shadow-xs overflow-hidden">
                              <PluginMark name={plugin.name} iconUrl={plugin.iconUrl} size={24} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                                {stripCursorText(plugin.name) || plugin.name}
                              </h3>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                {stripCursorText(plugin.description)}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                            {connectedIds.has(plugin.id) ? (
                              <button
                                type="button"
                                aria-label={`Manage ${plugin.name}`}
                                onClick={() => openPluginById(plugin.id, plugin.name, plugin.description)}
                                className="grid size-7 place-items-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                              >
                                <MoreHorizontal className="size-4" />
                              </button>
                            ) : startingPluginId === plugin.id ? (
                              <Loader2 className="size-4 animate-spin text-neutral-400" />
                            ) : (
                              <button
                                type="button"
                                aria-label={`Add ${plugin.name}`}
                                onClick={() => void handleAuthorize(plugin)}
                                className="grid size-7 place-items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:scale-110 active:scale-95 transition-all"
                              >
                                <Plus className="size-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Default View: Installed Row, Filters & Categorized Sections */
                <>
                  {/* Installed Header & Icons Row */}
                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("installed")}
                      className="inline-flex items-center gap-1 text-base font-semibold text-neutral-900 dark:text-neutral-100 hover:opacity-80 transition-opacity group"
                    >
                      <span>Installed</span>
                      <ChevronRight className="size-4 text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors" />
                    </button>

                    {/* Horizontal Squircle App Icons Row */}
                    <div className="flex items-center gap-3 overflow-x-auto py-2 scrollbar-hide">
                      {(connections.length > 0
                        ? connections.map((conn) => ({
                            id: conn.pluginId,
                            name: conn.pluginName || conn.pluginId,
                            iconUrl:
                              conn.pluginIconUrl ||
                              `https://cdn.clauxen.com/plugins/icons/${conn.pluginId}.png`,
                          }))
                        : DEFAULT_INSTALLED_ROW_ICONS
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openPluginById(item.id, item.name)}
                          aria-label={`View ${item.name}`}
                          className="size-10 rounded-xl flex items-center justify-center shrink-0 border border-neutral-200/70 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 hover:shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden"
                        >
                          <img
                            src={item.iconUrl}
                            alt={item.name}
                            className="size-full object-contain"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `/cdn/plugins/icons/${item.id}.png`;
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter Scope Pills: Public | Personal */}
                  <div className="flex items-center gap-1.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setFilterScope("public")}
                      className={cn(
                        "rounded-full px-3.5 py-1 text-xs font-semibold transition-colors outline-none",
                        filterScope === "public"
                          ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
                      )}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterScope("personal")}
                      className={cn(
                        "rounded-full px-3.5 py-1 text-xs font-medium transition-colors outline-none",
                        filterScope === "personal"
                          ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
                      )}
                    >
                      Personal
                    </button>
                  </div>

                  {filterScope === "public" ? (
                    <>
                      {/* Category Quick Chips */}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-hide">
                        {CATEGORY_TABS.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                              "rounded-full px-3 py-1 text-xs transition-colors whitespace-nowrap shrink-0 outline-none",
                              selectedCategory === cat.id
                                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs"
                                : "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 font-medium",
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Categorized Sections List */}
                      <div className="space-y-8 pt-2">
                        {displayedSections.map((section) => {
                          const isExpanded =
                            Boolean(expandedSections[section.id]) ||
                            selectedCategory !== "all";
                          const visiblePlugins = isExpanded
                            ? section.plugins
                            : section.plugins.slice(0, 6);
                          const hasMore = section.plugins.length > 6;

                          return (
                            <div key={section.id} className="space-y-3">
                              {/* Section Header */}
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => toggleSection(section.id)}
                                  className="inline-flex items-center gap-1.5 text-base font-semibold text-neutral-900 dark:text-neutral-100 hover:opacity-80 transition-opacity group"
                                >
                                  <span>{section.displayTitle}</span>
                                  <ChevronRight
                                    className={cn(
                                      "size-4 text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-transform duration-200",
                                      isExpanded && "rotate-90",
                                    )}
                                  />
                                </button>
                                {hasMore && selectedCategory === "all" ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleSection(section.id)}
                                    className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                                  >
                                    {isExpanded
                                      ? "Show less"
                                      : `See all (${section.plugins.length})`}
                                  </button>
                                ) : null}
                              </div>

                              {/* 2-Column Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3.5">
                                {visiblePlugins.map((plugin) => {
                                  const isConnected = connectedIds.has(plugin.id);
                                  const isStarting = startingPluginId === plugin.id;

                                  return (
                                    <div
                                      key={plugin.id}
                                      onClick={() =>
                                        openPluginById(plugin.id, plugin.name, plugin.description)
                                      }
                                      className="flex items-center justify-between py-2 px-1 cursor-pointer group transition-colors"
                                    >
                                      {/* Left: Logo & Text */}
                                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                                        <div className="size-9 rounded-lg flex items-center justify-center shrink-0 border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1.5 shadow-xs overflow-hidden">
                                          <PluginMark
                                            name={plugin.name}
                                            iconUrl={plugin.iconUrl}
                                            size={24}
                                          />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                                            {stripCursorText(plugin.name) || plugin.name}
                                          </h3>
                                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                            {stripCursorText(plugin.description)}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Right: Action or Status */}
                                      <div
                                        className="shrink-0 flex items-center"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isConnected ? (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <button
                                                type="button"
                                                aria-label={`Options for ${plugin.name}`}
                                                className="grid size-7 place-items-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                              >
                                                <MoreHorizontal className="size-4" />
                                              </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              className="w-40 rounded-xl"
                                            >
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openPluginById(
                                                    plugin.id,
                                                    plugin.name,
                                                    plugin.description,
                                                  )
                                                }
                                              >
                                                Details
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handleRemoveByPluginId(plugin.id)}
                                                className="text-red-600 focus:text-red-600"
                                              >
                                                Disconnect
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        ) : isStarting ? (
                                          <Loader2 className="size-4 animate-spin text-neutral-400" />
                                        ) : (
                                          <button
                                            type="button"
                                            aria-label={`Add ${plugin.name}`}
                                            onClick={() => void handleAuthorize(plugin)}
                                            className="grid size-7 place-items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:scale-110 active:scale-95 transition-all"
                                          >
                                            <Plus className="size-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    /* Personal View */
                    <div className="space-y-6 pt-4">
                      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                        <div>
                          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                            Personal & Custom Plugins
                          </h2>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Connect custom integrations, enterprise MCP endpoints, and workspace tools
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomAddPlugin({
                              id: "",
                              name: "",
                              description: "",
                              author: "",
                              iconUrl: "",
                              category: "Custom",
                              installed: false,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:opacity-80 shadow-xs transition-opacity"
                        >
                          <Plus className="size-3.5" />
                          <span>Add custom</span>
                        </button>
                      </div>

                      {personalPlugins.length === 0 ? (
                        <div className="py-20 text-center">
                          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                            No Plugins Found
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3.5">
                          {personalPlugins.map((plugin) => {
                            const isConnected = connectedIds.has(plugin.id);
                            const isStarting = startingPluginId === plugin.id;

                            return (
                              <div
                                key={plugin.id}
                                onClick={() =>
                                  openPluginById(plugin.id, plugin.name, plugin.description)
                                }
                                className="flex items-center justify-between py-2 px-1 cursor-pointer group transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                                  <div className="size-9 rounded-lg flex items-center justify-center shrink-0 border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1.5 shadow-xs overflow-hidden">
                                    <PluginMark
                                      name={plugin.name}
                                      iconUrl={plugin.iconUrl}
                                      size={24}
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                                      {stripCursorText(plugin.name) || plugin.name}
                                    </h3>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                      {stripCursorText(plugin.description)}
                                    </p>
                                  </div>
                                </div>
                                <div
                                  className="shrink-0 flex items-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {isConnected ? (
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                      Active
                                    </span>
                                  ) : isStarting ? (
                                    <Loader2 className="size-4 animate-spin text-neutral-400" />
                                  ) : (
                                    <button
                                      type="button"
                                      aria-label={`Add ${plugin.name}`}
                                      onClick={() => void handleAuthorize(plugin)}
                                      className="grid size-7 place-items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:scale-110 active:scale-95 transition-all"
                                    >
                                      <Plus className="size-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Pop-up Container Dialog: Details & Connect Modal */}
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

      {/* Add Custom MCP Dialog */}
      <AddPluginDialog
        plugin={customAddPlugin}
        mcpUrl={null}
        connected={false}
        error={null}
        onOpenChange={(open) => {
          if (!open) setCustomAddPlugin(null);
        }}
        onConfirm={handleAuthorize}
      />
    </div>
  );
}
