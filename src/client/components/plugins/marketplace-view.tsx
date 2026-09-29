"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import {
  defaultInstalledIds,
  filteredSections,
  marketplaceCatalog,
  pluginMatches,
  pluginsByIds,
} from "./catalog";
import { CategorySection } from "./category-section";
import { DiscoverRow } from "./discover-row";
import { AddMarketplaceDialog, PluginDetailDialog } from "./plugin-dialogs";
import type { CustomMarketplace, MarketplacePlugin } from "./types";

const INSTALLS_KEY = "clauxen.marketplace.installs";
const MARKETS_KEY = "clauxen.marketplace.custom";

type MarketplaceTab = "all" | "marketplace" | string;

function readInstalls(): string[] | null {
  try {
    const raw = localStorage.getItem(INSTALLS_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

function readMarkets(): CustomMarketplace[] {
  try {
    const raw = localStorage.getItem(MARKETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CustomMarketplace =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as CustomMarketplace).id === "string" &&
        typeof (item as CustomMarketplace).name === "string" &&
        typeof (item as CustomMarketplace).url === "string",
    );
  } catch {
    return [];
  }
}

export function MarketplaceView() {
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MarketplaceTab>("all");
  const [managing, setManaging] = useState(false);
  const [installed, setInstalled] = useState<Set<string>>(
    () => new Set(defaultInstalledIds()),
  );
  const [markets, setMarkets] = useState<CustomMarketplace[]>([]);
  const [selected, setSelected] = useState<MarketplacePlugin | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const stored = readInstalls();
    if (stored) setInstalled(new Set(stored));
    setMarkets(readMarkets());
  }, []);

  const toggleInstalled = (id: string) => {
    setInstalled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(INSTALLS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const addMarket = (input: { name: string; url: string }) => {
    const market: CustomMarketplace = {
      id: `custom-${crypto.randomUUID()}`,
      name: input.name,
      url: input.url,
    };
    setMarkets((current) => {
      const next = [...current, market];
      localStorage.setItem(MARKETS_KEY, JSON.stringify(next));
      return next;
    });
    setManaging(false);
    setTab(market.id);
  };

  const removeMarket = (id: string) => {
    setMarkets((current) => {
      const next = current.filter((market) => market.id !== id);
      localStorage.setItem(MARKETS_KEY, JSON.stringify(next));
      return next;
    });
    setTab("all");
  };

  const activeMarket = markets.find((market) => market.id === tab) ?? null;
  const browsingOfficial = tab === "all" || tab === "marketplace";

  const discoverPlugins = useMemo(() => {
    if (!browsingOfficial || managing || query.trim()) return [];
    return pluginsByIds(marketplaceCatalog.discover);
  }, [browsingOfficial, managing, query]);

  const sections = useMemo(() => {
    if (!browsingOfficial || managing) return [];
    return filteredSections(query);
  }, [browsingOfficial, managing, query]);

  const installedPlugins = useMemo(() => {
    if (!managing) return [];
    const seen = new Set<string>();
    const list: MarketplacePlugin[] = [];
    for (const section of marketplaceCatalog.sections) {
      for (const id of section.pluginIds) {
        if (seen.has(id) || !installed.has(id)) continue;
        const plugin = marketplaceCatalog.plugins[id];
        if (!plugin || !pluginMatches(plugin, query)) continue;
        seen.add(id);
        list.push(plugin);
      }
    }
    return list;
  }, [installed, managing, query]);

  const searching = query.trim().length > 0;
  const resultCount = sections.reduce((sum, section) => sum + section.plugins.length, 0);

  return (
    <div className="plugin-marketplace relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans">
      {isMobile ? (
        <MobilePageHeader
          title="Plugins"
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
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
                  className="ui-icon-button no-hover-overlay absolute right-1 !size-6"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>
            <button
              type="button"
              aria-pressed={managing}
              onClick={() => setManaging((value) => !value)}
              className={cn(appBtn.secondarySm, "px-2.5", managing && "bg-[var(--ui-hover-wash)]")}
            >
              Manage
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Marketplaces">
            <div className="cx-segmented">
              <TabButton active={tab === "all" && !managing} onClick={() => { setTab("all"); setManaging(false); }}>
                All
              </TabButton>
              <TabButton
                active={tab === "marketplace" && !managing}
                onClick={() => { setTab("marketplace"); setManaging(false); }}
              >
                Marketplace
              </TabButton>
              {markets.map((market) => (
                <TabButton
                  key={market.id}
                  active={tab === market.id && !managing}
                  onClick={() => { setTab(market.id); setManaging(false); }}
                >
                  <span className="max-w-[140px] truncate">{market.name}</span>
                </TabButton>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className={cn(appBtn.ghost, "h-8 gap-1 px-2 text-[12.5px]")}
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Add Marketplace
            </button>
          </div>
        </header>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-16 sm:px-6">
          {managing ? (
            installedPlugins.length === 0 ? (
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
              <CategorySection
                title="Installed"
                plugins={installedPlugins}
                installed={installed}
                onOpen={setSelected}
                onToggle={toggleInstalled}
                className="mt-2"
              />
            )
          ) : activeMarket ? (
            <CustomMarketplaceEmpty
              market={activeMarket}
              onRemove={() => removeMarket(activeMarket.id)}
            />
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
              <DiscoverRow plugins={discoverPlugins} onOpen={setSelected} />
              {sections.map((section) => (
                <CategorySection
                  key={section.id}
                  title={section.title}
                  plugins={section.plugins}
                  installed={installed}
                  onOpen={setSelected}
                  onToggle={toggleInstalled}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <PluginDetailDialog
        plugin={selected}
        added={selected ? installed.has(selected.id) : false}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onToggle={toggleInstalled}
      />
      <AddMarketplaceDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addMarket} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-active={active || undefined}
      onClick={onClick}
      className="cx-segmented__item no-hover-overlay"
    >
      {children}
    </button>
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

function CustomMarketplaceEmpty({
  market,
  onRemove,
}: {
  market: CustomMarketplace;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <h2 className="text-[14px] font-medium leading-5 text-[var(--ui-fg)]">
        No plugins in {market.name}
      </h2>
      <p className="mt-0.5 max-w-sm text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
        {market.url
          ? `Plugins from ${market.url} will show up here once the source is connected.`
          : "This marketplace is saved. Plugins will show up here once the source is connected."}
      </p>
      <button type="button" onClick={onRemove} className={cn(appBtn.secondarySm, "mt-4 px-2.5")}>
        Remove marketplace
      </button>
    </div>
  );
}
