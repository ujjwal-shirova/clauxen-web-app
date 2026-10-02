"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import {
  filteredSections,
  marketplaceCatalog,
  pluginMatches,
  pluginsByIds,
} from "./catalog";
import { CategorySection } from "./category-section";
import { DiscoverRow } from "./discover-row";
import { AddedPluginsRow } from "./added-plugins-row";
import { PluginDetailDialog } from "./plugin-detail-dialog";
import { AddPluginDialog } from "./add-plugin-dialog";
import {
  startPluginAuthorization,
  usePluginConnections,
  type PluginConnection,
} from "./use-plugin-connections";
import type { MarketplacePlugin } from "./types";

/**
 * The Plugins page.
 *
 * Clicking any plugin opens its detail popup (icon, name, description, then
 * "Add to Clauxen" and "Try it in chat"). "Add to Clauxen" opens the connect
 * confirmation, and confirming starts the plugin's MCP OAuth authorization in
 * a new tab. Connected plugins appear in the "Added" strip at the top.
 */
export function MarketplaceView() {
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState(false);

  // Popup state: the detail popover, then the add-to-platform confirmation.
  const [detailPlugin, setDetailPlugin] = useState<MarketplacePlugin | null>(null);
  const [addPlugin, setAddPlugin] = useState<MarketplacePlugin | null>(null);
  const [starting, setStarting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const {
    connections,
    refresh: refreshConnections,
    revoke,
  } = usePluginConnections();

  // New-tab authorization reports back through postMessage; refresh then too.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === "clauxen:plugin-connected") void refreshConnections();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshConnections]);

  const connectedIds = useMemo(
    () => new Set(connections.map((connection) => connection.pluginId)),
    [connections],
  );

  const openPlugin = useCallback((plugin: MarketplacePlugin) => {
    setAddError(null);
    setDetailPlugin(plugin);
  }, []);

  const openAddConfirmation = useCallback((plugin: MarketplacePlugin) => {
    setAddError(null);
    setDetailPlugin(null);
    setAddPlugin(plugin);
  }, []);

  const confirmAdd = useCallback(
    async (plugin: MarketplacePlugin) => {
      setStarting(true);
      setAddError(null);
      try {
        const result = await startPluginAuthorization(plugin.id);
        if (result.ok) {
          // The provider's consent screen opens in a new tab; the callback
          // posts back here when it completes.
          window.open(result.authorizeUrl, "_blank", "noopener,noreferrer");
          setAddPlugin(null);
        } else {
          setAddError(result.message);
        }
      } catch {
        setAddError("Could not reach the plugin authorization service.");
      } finally {
        setStarting(false);
      }
    },
    [],
  );

  const removeConnection = useCallback(
    async (connection: PluginConnection) => {
      try {
        await revoke(connection.id);
      } catch {
        /* surfaced by the row's own state on the next refresh */
      }
    },
    [revoke],
  );

  const discoverPlugins = useMemo(() => {
    if (managing || query.trim()) return [];
    return pluginsByIds(marketplaceCatalog.discover);
  }, [managing, query]);

  const sections = useMemo(() => {
    if (managing) return [];
    return filteredSections(query);
  }, [managing, query]);

  const searching = query.trim().length > 0;
  const resultCount = sections.reduce((sum, section) => sum + section.plugins.length, 0);

  const managedConnections = useMemo(() => {
    if (!managing) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return connections;
    return connections.filter((connection) =>
      `${connection.pluginName} ${connection.pluginId}`
        .toLowerCase()
        .includes(needle),
    );
  }, [connections, managing, query]);

  return (
    <div className="plugin-marketplace relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans">
      {isMobile ? (
        <MobilePageHeader
          title="Plugins"
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
        />
      ) : null}

      {/* The "Added" strip — every connected plugin, in one horizontal line. */}
      {!managing && !searching ? (
        <AddedPluginsRow
          connections={connections}
          onOpen={openPlugin}
          onRemove={removeConnection}
        />
      ) : null}

      <div className="mx-auto flex min-h-0 w-full max-w-[780px] flex-1 flex-col">
        <header className="shrink-0 px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-2">
            <label className="relative flex h-8 min-w-0 flex-1 items-center">
              <Search
                className="pointer-events-none absolute left-2.5 size-3.5 text-[var(--ui-fg-placeholder)]"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search plugins"
                aria-label="Search plugins"
                className="cx-field h-8 !pl-8 !pr-7"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="ui-icon-button no-hover-overlay absolute right-1 top-1/2 !size-6 -translate-y-1/2"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>
            <button
              type="button"
              aria-pressed={managing}
              onClick={() => setManaging((value) => !value)}
              className={cn(
                appBtn.secondarySm,
                "h-8 px-3",
                managing &&
                  "bg-[var(--ui-hover-wash)] text-[var(--ui-fg)] shadow-none",
              )}
            >
              Manage
            </button>
          </div>
        </header>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-16 sm:px-6">
          {managing ? (
            managedConnections.length === 0 ? (
              <EmptyState
                title={searching ? "No matching plugins" : "No plugins added"}
                body={
                  searching
                    ? `Nothing you’ve added matches “${query.trim()}”.`
                    : "Add a plugin from the marketplace and it will show up here."
                }
                actionLabel={searching ? undefined : "Browse marketplace"}
                onAction={searching ? undefined : () => setManaging(false)}
              />
            ) : (
              <section className="mt-2" aria-labelledby="installed-plugins-heading">
                <h2
                  id="installed-plugins-heading"
                  className="mb-3 text-[15px] font-medium leading-5 tracking-[-0.01em] text-[var(--ui-fg)]"
                >
                  Installed
                  <span className="ml-1.5 text-[12.5px] font-normal text-[var(--ui-fg-placeholder)]">
                    · {managedConnections.length}
                  </span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {managedConnections.map((connection) => (
                    <ManagedConnectionRow
                      key={connection.id}
                      connection={connection}
                      onOpen={openPlugin}
                      onRemove={removeConnection}
                    />
                  ))}
                </ul>
              </section>
            )
          ) : searching && sections.length === 0 ? (
            <EmptyState
              title="No matching plugins"
              body={`Nothing in the marketplace matches “${query.trim()}”.`}
            />
          ) : (
            <>
              {searching ? (
                <p className="pt-2 text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
                  {resultCount} {resultCount === 1 ? "result" : "results"}
                </p>
              ) : null}
              <DiscoverRow
                plugins={discoverPlugins}
                onOpen={openPlugin}
              />
              {sections.map((section) => (
                <CategorySection
                  key={section.id}
                  title={section.title}
                  plugins={section.plugins}
                  onOpen={openPlugin}
                  defaultExpanded={searching}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Step 1 — the plugin popup: icon, name, description, two actions. */}
      <PluginDetailDialog
        plugin={detailPlugin}
        connected={detailPlugin ? connectedIds.has(detailPlugin.id) : false}
        starting={false}
        onOpenChange={(open) => {
          if (!open) setDetailPlugin(null);
        }}
        onAdd={openAddConfirmation}
      />

      {/* Step 2 — the add-to-platform confirmation. */}
      <AddPluginDialog
        plugin={addPlugin}
        mcpUrl={null}
        connected={addPlugin ? connectedIds.has(addPlugin.id) : false}
        error={addError}
        onOpenChange={(open) => {
          if (!open) {
            setAddPlugin(null);
            setAddError(null);
          }
        }}
        onConfirm={confirmAdd}
      />
    </div>
  );
}

function ManagedConnectionRow({
  connection,
  onOpen,
  onRemove,
}: {
  connection: PluginConnection;
  onOpen: (plugin: MarketplacePlugin) => void;
  onRemove: (connection: PluginConnection) => void;
}) {
  const name = connection.pluginName || connection.pluginId;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-white p-3">
      <button
        type="button"
        onClick={() =>
          onOpen({
            id: connection.pluginId,
            name,
            description: "",
            author: "",
            iconUrl: connection.pluginIconUrl ?? "",
            category: "",
            installed: true,
          })
        }
        className="no-hover-overlay flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium leading-5 text-[var(--ui-fg)]">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-[12px] leading-[17px] text-[var(--ui-fg-muted)]">
            {connection.status === "active"
              ? "Connected"
              : connection.status === "reauthorization_required"
                ? "Needs reconnecting"
                : connection.status}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(connection)}
        className={cn(appBtn.secondarySm, "h-8 px-2.5")}
      >
        Remove
      </button>
    </li>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-10 place-items-center rounded-[10px] bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)]">
        <Search className="size-[18px]" strokeWidth={1.75} />
      </span>
      <h2 className="mt-3 text-[14px] font-medium leading-5 text-[var(--ui-fg)]">{title}</h2>
      <p className="mt-0.5 max-w-xs text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">{body}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={cn(appBtn.secondarySm, "mt-4 px-2.5")}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
