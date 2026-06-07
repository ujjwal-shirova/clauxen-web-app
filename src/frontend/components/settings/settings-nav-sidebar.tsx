"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { settingsNav, type SettingsTab } from "@/frontend/components/settings/constants";

interface SettingsNavSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsNavSidebar({ activeTab, onTabChange }: SettingsNavSidebarProps) {
  return (
    <>
      <div className="md:hidden">
        <label htmlFor="settings-tab-select" className="sr-only">
          Settings section
        </label>
        <div className="relative">
          <select
            id="settings-tab-select"
            value={activeTab}
            onChange={(event) => onTabChange(event.target.value as SettingsTab)}
            className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3.5 pr-10 text-[14px] font-[430] text-zinc-700 shadow-sm outline-none ring-0 transition-colors hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          >
            {settingsNav.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>

      <aside className="hidden self-start md:sticky md:top-4 md:block md:w-[220px]">
        <nav className="flex flex-col gap-0.5 pr-2" aria-label="Settings categories">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => onTabChange(item.name)}
                className={cn(
                  "interactive-nav-item flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] font-[430] leading-none transition-colors",
                  isActive
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-50",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 stroke-[1.75]",
                    isActive ? "text-zinc-900" : "text-zinc-700",
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
