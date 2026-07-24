"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  settingsNav,
  settingsNavByName,
  settingsNavGroups,
  type SettingsTab,
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
            ? "bg-[rgba(11,11,11,0.08)] font-medium text-zinc-900 dark:bg-white/10 dark:text-zinc-100"
            : "font-normal text-zinc-600 hover:bg-[rgba(11,11,11,0.04)] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 stroke-[1.75]",
            isActive
              ? "text-zinc-700 dark:text-zinc-200"
              : "text-zinc-500 dark:text-zinc-500",
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
        className="h-9 w-full rounded-lg bg-white/80 py-0 pl-9 pr-2 text-[14px] leading-5 text-zinc-900 placeholder:text-zinc-400 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition-[box-shadow,background-color] duration-75 focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)] dark:bg-zinc-900/80 dark:text-zinc-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:focus:bg-zinc-900"
      />
    </div>
  );
}

function ScrollHintChevron({
  direction,
  visible,
  onClick,
}: {
  direction: "up" | "down";
  visible: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={
        direction === "up"
          ? "Scroll settings nav up"
          : "Scroll settings nav down"
      }
      onClick={onClick}
      className={cn(
        "pointer-events-auto absolute left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200/90 bg-white/95 text-zinc-500 shadow-[0_4px_14px_-6px_rgba(24,24,27,0.35)] backdrop-blur-sm transition-[opacity,transform,box-shadow] duration-200 dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-300 dark:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.55)]",
        direction === "up" ? "top-1" : "bottom-1",
        visible
          ? "opacity-100 scale-100 hover:text-zinc-800 hover:shadow-[0_6px_16px_-6px_rgba(24,24,27,0.45)] dark:hover:text-zinc-100"
          : "pointer-events-none opacity-0 scale-90",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function SettingsNavSidebar({
  activeTab,
  onTabChange,
  variant = "sidebar",
}: SettingsNavSidebarProps) {
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

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

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight - clientHeight > 2;
    setCanScrollUp(overflow && scrollTop > 2);
    setCanScrollDown(overflow && scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  useLayoutEffect(() => {
    updateScrollHints();
  }, [filteredByGroup, updateScrollHints]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollHints();
    el.addEventListener("scroll", updateScrollHints, { passive: true });

    const ro = new ResizeObserver(() => updateScrollHints());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      ro.disconnect();
    };
  }, [updateScrollHints, filteredByGroup]);

  const scrollByPage = useCallback((direction: "up" | "down") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(120, Math.round(el.clientHeight * 0.55));
    el.scrollBy({
      top: direction === "down" ? amount : -amount,
      behavior: "smooth",
    });
  }, []);

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
            className="h-9 w-full appearance-none rounded-lg bg-white/80 px-3 pr-10 text-[14px] text-zinc-800 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition-colors focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)] dark:bg-zinc-900/80 dark:text-zinc-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
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

      <div className="relative min-h-0 flex-1">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-[5] h-8 bg-gradient-to-b from-[var(--app-shell-bg)] to-transparent transition-opacity duration-200",
            canScrollUp ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-8 bg-gradient-to-t from-[var(--app-shell-bg)] to-transparent transition-opacity duration-200",
            canScrollDown ? "opacity-100" : "opacity-0",
          )}
        />
        <ScrollHintChevron
          direction="up"
          visible={canScrollUp}
          onClick={() => scrollByPage("up")}
        />
        <ScrollHintChevron
          direction="down"
          visible={canScrollDown}
          onClick={() => scrollByPage("down")}
        />

        <div
          ref={scrollRef}
          className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-1 [scrollbar-width:thin]"
        >
          <div className="flex flex-col gap-4">
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
        </div>
      </div>
    </nav>
  );
}
