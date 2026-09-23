"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  settingsNavByName,
  settingsNavGroups,
  settingsNavKeywords,
  type SettingsTab,
  type VisibleSettingsTab,
} from "@/components/settings/constants";

interface SettingsNavSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  variant?: "sidebar" | "mobile-toolbar";
}

function NavButton({
  tab,
  isActive,
  onSelect,
}: {
  tab: VisibleSettingsTab;
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
        className={cn("cx-set-link", isActive && "is-active")}
      >
        <Icon strokeWidth={1.75} aria-hidden />
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
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--settings-fg-subtle)]"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search settings"
        aria-label="Search settings"
        className="cx-field !h-[30px] !pl-8 !pr-7 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="ui-icon-button no-hover-overlay absolute right-1 top-1/2 !size-6 -translate-y-1/2 text-[var(--settings-fg-subtle)] hover:text-[var(--settings-fg)]"
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
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
        items: group.items.filter((name) =>
          normalized
            ? name.toLowerCase().includes(normalized) ||
              settingsNavKeywords[name].includes(normalized)
            : true,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  const flatMatches = useMemo(
    () => filteredByGroup.flatMap((group) => group.items),
    [filteredByGroup],
  );

  if (variant === "mobile-toolbar") {
    return (
      <div className="flex flex-col gap-2">
        <SettingsSearchInput value={query} onChange={setQuery} />
        <div
          role="tablist"
          aria-label="Settings sections"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(flatMatches.length > 0 ? flatMatches : [activeTab]).map((tab) => {
            const visible = tab as VisibleSettingsTab;
            const item = settingsNavByName[visible];
            if (!item) return null;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
                  isActive
                    ? "border-transparent bg-[var(--settings-fg)] text-[var(--settings-canvas-bg)]"
                    : "border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] text-[var(--settings-fg-muted)]",
                )}
              >
                <item.icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                {item.name}
              </button>
            );
          })}
        </div>
        {flatMatches.length === 0 ? (
          <p className="py-1.5 text-center text-[12.5px] text-[var(--settings-fg-muted)]">
            No matching settings
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <nav
      className="flex h-full min-h-0 flex-1 flex-col gap-2.5 overflow-hidden"
      aria-label="Settings"
    >
      <SettingsSearchInput value={query} onChange={setQuery} />

      <div className="relative min-h-0 flex-1">
        <div
          data-scroll-region=""
          className="flex h-full min-h-0 flex-col overflow-y-auto pb-3 pr-0.5 [scrollbar-color:var(--settings-hairline)_transparent] [scrollbar-width:thin]"
        >
          <div className="flex flex-col gap-3.5">
            {filteredByGroup.map((group) => (
              <div key={group.label} className="flex flex-col">
                <p className="px-2 pb-1 text-[11px] font-medium leading-4 text-[var(--settings-fg-subtle)]">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-px">
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
              <p className="px-2 py-4 text-center text-[12.5px] text-[var(--settings-fg-muted)]">
                No matching settings
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
