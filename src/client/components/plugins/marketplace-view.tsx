"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from "@/components/ui/bootstrap-icon";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useOptionalAuthGate } from "@/contexts/auth-gate-context";
import { cn } from "@/lib/utils";
import { marketplaceCatalog, pluginMatches, pluginsByIds } from "./catalog";
import { PluginMark } from "./plugin-mark";
import { cardDescription, stripCursorText } from "./plugin-copy";
import { PluginDetailPage } from "./plugin-detail-page";
import {
  usePluginConnections,
  type ConnectEvent,
  type PluginAvailability,
  type PluginConnection,
} from "./use-plugin-connections";
import type { MarketplacePlugin } from "./types";

type Tab = "discover" | "installed";

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
  if (pluginId) url.searchParams.set("p", pluginId);
  else url.searchParams.delete("p");
  window.history.pushState(null, "", `${url.pathname}${url.search}`);
}

export function MarketplaceView() {
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const { toast } = useToast();
  const authGate = useOptionalAuthGate();

  const [tab, setTab] = useState<Tab>("discover");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onEvent = useCallback(
    (event: ConnectEvent) => {
      if (event.type === "connected") {
        toast({
          title: `${event.pluginName} connected`,
          description: "Clauxen can now use it in your chats.",
        });
      } else if (event.type === "failed") {
        toast({
          variant: "destructive",
          title: "Connection failed",
          description: event.message,
        });
      }
    },
    [toast],
  );

  const {
    connections,
    availability,
    loading,
    connectingId,
    refresh,
    connect,
    disconnect,
  } = usePluginConnections({ onEvent });

  useEffect(() => {
    setSelectedId(readSelectedFromUrl());
    const onPop = () => setSelectedId(readSelectedFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const connectionByPlugin = useMemo(() => {
    const map = new Map<string, PluginConnection>();
    for (const connection of connections) map.set(connection.pluginId, connection);
    return map;
  }, [connections]);

  const openPlugin = useCallback((pluginId: string) => {
    setSelectedId(pluginId);
    writeSelectedToUrl(pluginId);
    document.querySelector("[data-plugins-scroll]")?.scrollTo({ top: 0 });
  }, []);

  const closePlugin = useCallback(() => {
    setSelectedId(null);
    writeSelectedToUrl(null);
  }, []);

  const handleConnect = useCallback(
    (pluginId: string) => {
      if (authGate && !authGate.requireAuth()) return;
      connect(pluginId);
    },
    [authGate, connect],
  );

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
    if (!needle) return null;
    return Object.values(marketplaceCatalog.plugins).filter((plugin) =>
      pluginMatches(plugin, needle),
    );
  }, [query]);

  const visibleSections =
    category === "all" ? sections : sections.filter((section) => section.id === category);

  const installed = connections.filter((connection) => connection.status !== "revoked");

  const cardProps = (plugin: MarketplacePlugin) => ({
    plugin,
    connection: connectionByPlugin.get(plugin.id) ?? null,
    availability: availability[plugin.id] ?? null,
    connecting: connectingId === plugin.id,
    onOpen: () => openPlugin(plugin.id),
    onConnect: () => handleConnect(plugin.id),
  });

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
          <PluginDetailPage
            pluginId={selectedId}
            connection={connectionByPlugin.get(selectedId) ?? null}
            availability={availability[selectedId] ?? null}
            connecting={connectingId === selectedId}
            onBack={closePlugin}
            onConnect={() => handleConnect(selectedId)}
            onDisconnect={async (connection) => {
              try {
                await disconnect(connection.id);
                toast({
                  title: `${connection.pluginName} disconnected`,
                  description: "Clauxen's access was revoked and its tokens deleted.",
                });
              } catch (error) {
                toast({
                  variant: "destructive",
                  title: "Couldn't disconnect",
                  description: error instanceof Error ? error.message : "Try again.",
                });
              }
            }}
            onChanged={refresh}
          />
        ) : (
          <div className="mx-auto w-full max-w-[960px]">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">Plugins</h1>
                <p className="mt-1.5 max-w-[520px] text-[14px] leading-[22px] text-zinc-500 dark:text-zinc-400">
                  Connect the apps you use so Clauxen can work with them. You sign in on each
                  app&apos;s own page, and Clauxen never sees your password.
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

            <div
              className="mt-7 flex items-center gap-6 border-b border-black/[0.06] dark:border-white/[0.08]"
              role="tablist"
            >
              {(
                [
                  ["discover", "Discover"],
                  ["installed", `Installed${installed.length ? ` · ${installed.length}` : ""}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "-mb-px border-b-2 pb-2.5 text-[13.5px] font-medium transition-colors",
                    tab === id
                      ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {searchResults ? (
              <section className="mt-6">
                <p className="mb-3 text-[13px] text-zinc-500">
                  {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{query.trim()}”
                </p>
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {searchResults.map((plugin) => (
                      <PluginCard key={plugin.id} {...cardProps(plugin)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No plugins found"
                    body="Try a different name, or browse the categories."
                  />
                )}
              </section>
            ) : tab === "installed" ? (
              <InstalledList
                loading={loading}
                connections={installed}
                onOpen={openPlugin}
                onBrowse={() => setTab("discover")}
              />
            ) : (
              <>
                <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
                  {[{ id: "all", title: "All" }, ...sections].map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setCategory(section.id)}
                      className={cn(
                        "h-8 shrink-0 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
                        category === section.id
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-black/[0.08] bg-white text-zinc-600 hover:border-black/[0.16] hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300",
                      )}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>

                <TrustStrip />

                {visibleSections.map((section) => {
                  const isOpen = category !== "all" || expanded[section.id];
                  const shown = isOpen ? section.plugins : section.plugins.slice(0, SECTION_PREVIEW);
                  return (
                    <section key={section.id} className="mt-9">
                      <div className="mb-3 flex items-baseline justify-between">
                        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{section.title}</h2>
                        {category === "all" && section.plugins.length > SECTION_PREVIEW ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((current) => ({ ...current, [section.id]: !current[section.id] }))
                            }
                            className="text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          >
                            {isOpen ? "Show less" : `Show all ${section.plugins.length}`}
                          </button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {shown.map((plugin) => (
                          <PluginCard key={`${section.id}-${plugin.id}`} {...cardProps(plugin)} />
                        ))}
                      </div>
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

function TrustStrip() {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-[#fbfaf9] px-4 py-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <ShieldCheck className="mt-0.5 text-[16px] text-emerald-600 dark:text-emerald-400" />
      <p className="text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">Your accounts, your rules.</span>{" "}
        Tokens are encrypted and used only on Clauxen&apos;s servers, instructions hidden in emails or
        pages are filtered before the assistant reads them, and every action is logged on the
        plugin&apos;s page.
      </p>
    </div>
  );
}

function StatusPill({
  connection,
  availability,
  connecting,
  onConnect,
}: {
  connection: PluginConnection | null;
  availability: PluginAvailability | null;
  connecting: boolean;
  onConnect: () => void;
}) {
  if (connection?.status === "active") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[12px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        Connected
      </span>
    );
  }
  if (connection?.status === "reauthorization_required") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 text-[12px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        <AlertTriangle className="text-[11px]" />
        Reconnect
      </span>
    );
  }
  if (availability && !availability.available) {
    return (
      <span className="inline-flex h-7 items-center rounded-full bg-zinc-100 px-2.5 text-[12px] font-medium text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
        {availability.reason === "local_only" ? "Local only" : "Coming soon"}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onConnect();
      }}
      disabled={connecting}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-black/[0.1] bg-white px-3 text-[12px] font-medium text-zinc-800 transition-colors hover:border-black/[0.2] hover:bg-zinc-50 disabled:opacity-70 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
    >
      {connecting ? <Loader2 className="animate-spin text-[11px]" /> : null}
      {connecting ? "Connecting" : "Connect"}
    </button>
  );
}

function PluginCard({
  plugin,
  connection,
  availability,
  connecting,
  onOpen,
  onConnect,
}: {
  plugin: MarketplacePlugin;
  connection: PluginConnection | null;
  availability: PluginAvailability | null;
  connecting: boolean;
  onOpen: () => void;
  onConnect: () => void;
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
        <StatusPill
          connection={connection}
          availability={availability}
          connecting={connecting}
          onConnect={onConnect}
        />
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-[14px] font-semibold tracking-[-0.01em]">
          {stripCursorText(plugin.name) || plugin.name}
        </p>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-[18px] text-zinc-500 dark:text-zinc-400">
          {cardDescription(plugin.description, 100)}
        </p>
      </div>
    </div>
  );
}

function InstalledList({
  loading,
  connections,
  onOpen,
  onBrowse,
}: {
  loading: boolean;
  connections: PluginConnection[];
  onOpen: (pluginId: string) => void;
  onBrowse: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-10 flex justify-center text-zinc-400">
        <Loader2 className="animate-spin text-[18px]" />
      </div>
    );
  }
  if (connections.length === 0) {
    return (
      <EmptyState
        title="No plugins connected yet"
        body="Connect Gmail, GitHub, Slack, Notion and more to let Clauxen work across your apps."
        action={{ label: "Browse plugins", onClick: onBrowse }}
      />
    );
  }
  return (
    <ul className="mt-5 divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.07] bg-white dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-zinc-900">
      {connections.map((connection) => {
        const catalogEntry = marketplaceCatalog.plugins[connection.pluginId];
        const needsReconnect = connection.status === "reauthorization_required";
        return (
          <li key={connection.id}>
            <button
              type="button"
              onClick={() => onOpen(connection.pluginId)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            >
              <PluginMark
                name={connection.pluginName}
                iconUrl={connection.pluginIconUrl ?? catalogEntry?.iconUrl}
                size={38}
                className="rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{connection.pluginName}</p>
                <p className="truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">
                  {[
                    connection.accountLabel,
                    connection.toolCount != null ? `${connection.toolCount} tools` : null,
                    connection.permissionMode === "read_only" ? "Read only" : "Read & write",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {needsReconnect ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-50 px-2 text-[11.5px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  <AlertTriangle className="text-[10px]" />
                  Reconnect
                </span>
              ) : (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2 text-[11.5px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                  Active
                </span>
              )}
              <ChevronRight className="text-[12px] text-zinc-400" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-black/[0.1] px-6 py-14 text-center dark:border-white/10">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1.5 max-w-[360px] text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex h-9 items-center rounded-full bg-zinc-900 px-4 text-[13px] font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
