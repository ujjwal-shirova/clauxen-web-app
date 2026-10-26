"use client";

import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, ChevronDown, Menu, Search, X } from "@/components/ui/bootstrap-icon";
import { cn } from "@/lib/utils";
import {
  settingsItemLabel,
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
  accountName?: string | null;
  accountAvatarUrl?: string | null;
  onBackToApp?: () => void;
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
        <span className="truncate">{settingsItemLabel(tab)}</span>
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
        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--settings-fg-subtle)]"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search settings"
        aria-label="Search settings"
        className="settings-nav-search h-9 w-full rounded-full border-0 py-2 pl-9 pr-8 text-[13px] outline-none [&::-webkit-search-cancel-button]:hidden"
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
  onBackToApp,
}: SettingsNavSidebarProps) {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredByGroup = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return settingsNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((name) =>
          normalized
            ? name.toLowerCase().includes(normalized) ||
              settingsItemLabel(name).toLowerCase().includes(normalized) ||
              settingsNavKeywords[name].includes(normalized)
            : true,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  const selectTab = (tab: SettingsTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const navigation = (
    <div className="flex flex-col gap-5">
      {filteredByGroup.map((group) => (
        <div key={group.label} className="flex flex-col">
          <h2 className="px-2.5 pb-2 text-[12px] font-normal leading-4 text-[var(--settings-fg-muted)]">
            {group.label}
          </h2>
          <ul className="flex flex-col gap-px">
            {group.items.map((tab) => (
              <NavButton
                key={tab}
                tab={tab}
                isActive={
                  activeTab === tab ||
                  (activeTab === "Analytics" && tab === "Usage")
                }
                onSelect={() => selectTab(tab)}
              />
            ))}
          </ul>
        </div>
      ))}
      {filteredByGroup.length === 0 ? (
        <div className="px-3 py-6 text-center" role="status">
          <p className="text-[13px] text-[var(--settings-fg)]">
            No settings found
          </p>
          <p className="mt-1 text-[12px] text-[var(--settings-fg-muted)]">
            Try another word, like theme or password.
          </p>
        </div>
      ) : null}
    </div>
  );

  if (variant === "mobile-toolbar") {
    return (
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            className="settings-mobile-category"
            aria-label="Choose settings section"
          >
            <Menu className="size-4" aria-hidden />
            <span className="flex-1 text-left">
              {settingsItemLabel(activeTab as VisibleSettingsTab)}
            </span>
            <ChevronDown
              className="size-4 text-[var(--settings-fg-muted)]"
              aria-hidden
            />
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-nested-settings-dialog=""
            className="cx-dialog-overlay fixed inset-0 z-[220]"
          />
          <DialogPrimitive.Content
            data-nested-settings-dialog=""
            className="settings-theme settings-navigation-drawer fixed inset-y-0 left-0 z-[221] flex w-[min(320px,calc(100%-2rem))] flex-col p-3 outline-none"
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex h-10 items-center justify-between px-2">
              <DialogPrimitive.Title className="text-[17px] font-medium">
                Settings
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="ui-icon-button !size-9"
                aria-label="Close settings navigation"
              >
                <X className="size-4" aria-hidden />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">
              Search and choose a settings category.
            </DialogPrimitive.Description>
            <SettingsSearchInput
              value={query}
              onChange={setQuery}
              className="mb-5"
            />
            <nav
              aria-label="Settings sections"
              className="min-h-0 flex-1 overflow-y-auto pb-6"
            >
              {navigation}
            </nav>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <nav
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      aria-label="Settings"
    >
      {onBackToApp ? (
        <button
          type="button"
          onClick={onBackToApp}
          className="settings-back-button mb-5 flex h-10 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[14px] text-[var(--settings-fg)] transition-colors hover:bg-[var(--settings-nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-focus-ring)]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.6} aria-hidden />
          <span>Back to app</span>
        </button>
      ) : null}
      <SettingsSearchInput value={query} onChange={setQuery} className="mb-5" />
      <div
        data-scroll-region=""
        className="min-h-0 flex-1 overflow-y-auto pb-6 [scrollbar-color:var(--settings-hairline)_transparent] [scrollbar-width:thin]"
      >
        {navigation}
      </div>
    </nav>
  );
}
