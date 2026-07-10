"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  settingsNav,
  settingsNavByName,
  settingsNavGroups,
  type SettingsTab,
} from "@/frontend/components/settings/constants";

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
  tab: SettingsTab;
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
          "flex h-8 w-full items-center gap-3 rounded-lg px-2 text-left text-[14px] leading-5 transition-colors duration-150",
          isActive
            ? "bg-[rgba(11,11,11,0.08)] font-medium text-zinc-900"
            : "font-normal text-zinc-600 hover:bg-[rgba(11,11,11,0.04)] hover:text-zinc-900",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 stroke-[1.75]",
            isActive ? "text-zinc-700" : "text-zinc-500",
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
        className="pointer-events-none absolute left-2 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        aria-label="Search settings"
        className="h-9 w-full rounded-lg bg-white/80 py-0 pl-9 pr-2 text-[14px] leading-5 text-zinc-900 placeholder:text-zinc-400 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition-[box-shadow,background-color] duration-75 focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]"
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
        items: group.items.filter((name) =>
          normalized ? name.toLowerCase().includes(normalized) : true,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  if (variant === "mobile-toolbar") {
    const flatTabs =
      filteredByGroup.flatMap((g) => g.items).length > 0
        ? filteredByGroup.flatMap((g) => g.items)
        : settingsNav.map((i) => i.name);

    return (
      <div className="flex flex-col gap-2">
        <SettingsSearchInput value={query} onChange={setQuery} />
        <label htmlFor="settings-tab-select" className="sr-only">
          Settings section
        </label>
        <div className="relative">
          <select
            id="settings-tab-select"
            value={activeTab}
            onChange={(event) => onTabChange(event.target.value as SettingsTab)}
            className="h-9 w-full appearance-none rounded-lg bg-white/80 px-3 pr-10 text-[14px] text-zinc-800 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition-colors focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]"
          >
            {flatTabs.map((tab) => (
              <option key={tab} value={tab}>
                {tab}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <nav
      className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden"
      aria-label="Settings"
    >
      <SettingsSearchInput value={query} onChange={setQuery} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1">
        {filteredByGroup.map((group) => (
          <div key={group.label} className="flex flex-col gap-px">
            <p className="px-2 pb-1 pt-2 text-[12px] leading-[14px] text-zinc-500">
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
          <p className="px-2 py-4 text-center text-[13px] text-zinc-500">
            No matching settings
          </p>
        ) : null}
      </div>
    </nav>
  );
}
