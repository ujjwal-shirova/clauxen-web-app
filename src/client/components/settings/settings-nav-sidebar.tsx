"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  settingsNav,
  settingsTabAliases,
  settingsNavByName,
  settingsNavGroups,
  type SettingsCategory,
  type SettingsTab,
} from "@/components/settings/constants";

interface SettingsNavSidebarProps {
  activeTab: SettingsCategory;
  onTabChange: (tab: SettingsTab) => void;
  variant?: "sidebar" | "mobile-toolbar";
}

function NavButton({
  tab,
  isActive,
  onSelect,
}: {
  tab: SettingsCategory;
  isActive: boolean;
  onSelect: () => void;
}) {
  const item = settingsNavByName[tab];
  const Icon = item.icon;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--settings-focus-ring)]",
          isActive
            ? "bg-[var(--settings-nav-active-bg)] text-[var(--settings-fg)]"
            : "text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]",
        )}
      >
        <Icon
          className={cn(
            "h-[15px] w-[15px] shrink-0 stroke-[1.7] transition-colors",
            isActive
              ? "text-[var(--settings-fg)]"
              : "text-[var(--settings-fg-muted)] group-hover:text-[var(--settings-fg)]",
          )}
          aria-hidden
        />
        <span className="truncate">{item.name}</span>
      </button>
    </li>
  );
}

function SettingsSearchInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--settings-fg-subtle)]"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        aria-label="Search settings"
        className="h-9 w-full rounded-lg border border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] py-0 pl-8 pr-3 text-[13px] leading-[18px] text-[var(--settings-fg)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--settings-fg-subtle)] focus:border-[var(--settings-input-focus)] focus:shadow-[0_0_0_3px_var(--settings-focus-ring)]"
      />
    </div>
  );
}

export function SettingsNavSidebar({
  activeTab,
  onTabChange,
  variant = "sidebar",
}: SettingsNavSidebarProps) {
  const [query, setQuery] = useState("");

  const filteredByGroup = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return settingsNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((name) => {
          if (!normalized) return true;
          const aliases = Object.entries(settingsTabAliases)
            .filter(([, category]) => category === name)
            .map(([alias]) => alias);
          return [name, ...aliases].some((label) =>
            label.toLowerCase().includes(normalized),
          );
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  if (variant === "mobile-toolbar") {
    const matchingTabs =
      filteredByGroup.flatMap((g) => g.items).length > 0
        ? filteredByGroup.flatMap((g) => g.items)
        : settingsNav.map((i) => i.name);
    const flatTabs = matchingTabs.includes(activeTab)
      ? matchingTabs
      : [activeTab, ...matchingTabs];

    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,0.8fr)] gap-2">
        <SettingsSearchInput value={query} onChange={setQuery} />
        <label htmlFor="settings-tab-select" className="sr-only">
          Settings section
        </label>
        <div className="relative">
          <select
            id="settings-tab-select"
            value={activeTab}
            onChange={(event) => onTabChange(event.target.value as SettingsTab)}
            className="h-9 w-full appearance-none rounded-lg border border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] px-3 pr-9 text-[13px] font-medium leading-[18px] text-[var(--settings-fg)] outline-none transition-[border-color,box-shadow] focus:border-[var(--settings-input-focus)] focus:shadow-[0_0_0_3px_var(--settings-focus-ring)]"
          >
            {flatTabs.map((tab) => (
              <option key={tab} value={tab}>
                {tab}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 icon-md -translate-y-1/2 text-[var(--settings-fg-muted)]" />
        </div>
      </div>
    );
  }

  return (
    <nav
      className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      aria-label="Settings"
    >
      <SettingsSearchInput value={query} onChange={setQuery} />

      <div className="relative min-h-0 flex-1">
        <div
          data-scroll-region=""
          className="flex h-full min-h-0 flex-col overflow-y-auto pb-3 pr-0.5 [scrollbar-color:var(--settings-hairline)_transparent] [scrollbar-width:thin]"
        >
          <div className="flex flex-col gap-4">
            {filteredByGroup.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="px-2.5 pb-0.5 pt-1 text-[11px] font-medium leading-4 text-[var(--settings-fg-subtle)]">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((tab) => (
                    <NavButton
                      key={tab}
                      tab={tab}
                      isActive={activeTab === tab}
                      onSelect={() => onTabChange(tab)}
                    />
                  ))}
                </ul>
              </div>
            ))}
            {filteredByGroup.length === 0 ? (
              <p className="px-2 py-4 text-center text-[13px] text-[var(--settings-fg-muted)]">
                No matching settings
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
