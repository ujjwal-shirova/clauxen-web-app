"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Settings,
  ArrowUpCircle,
  ChevronRight,
  Gift,
  HelpCircle,
  LogOut,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Languages,
  Sparkles,
  X,
  Library,
  Search,
} from "lucide-react";
import { SidebarToggleIcon } from "./icons";
import { cn } from "@/lib/utils";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { AppHref, isPlainLeftClick } from "@/components/app-href";
import { APP_ROUTES, buildOverlayLocation } from "@/lib/app-routes";
import { UserAvatarDisplay } from "@/components/settings/profile-avatar-upload";
import { focusAppSurface } from "@/lib/surface-focus";
import {
  readCachedBillingPlan,
  writeCachedBillingPlan,
} from "@/lib/billing-plan-cache";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { TypingDots } from "./ui/typing-dots";
import { Skeleton } from "./ui/skeleton";
import { StreamingChatTitle } from "./streaming-chat-title";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RenameChatDialog } from "./rename-chat-dialog";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { SidebarChatGroupMenu } from "./sidebar-chat-group-menu";
import { groupChats, type ChatGroupBy } from "@/lib/chat-grouping";
import type { RecentChat } from "@/lib/types";

const CHAT_GROUP_STORAGE_KEY = "clauxen_chat_group_by";
const SECTION_STORAGE_PREFIX = "clauxen_sidebar_section_";

type SidebarSectionKey = "pinned" | "recents";

function readSectionExpanded(key: SidebarSectionKey, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(`${SECTION_STORAGE_PREFIX}${key}`);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeSectionExpanded(key: SidebarSectionKey, expanded: boolean) {
  try {
    localStorage.setItem(
      `${SECTION_STORAGE_PREFIX}${key}`,
      expanded ? "1" : "0",
    );
  } catch {
    /* ignore */
  }
}

/** Category label — bold on hover, no button wash; chevron only while sidebar hovered. */
function SidebarSectionLabel({
  label,
  expanded,
  onToggle,
  trailing,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex h-6 items-center justify-between gap-1 pl-2.5 pr-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-expanded={expanded}
        className="no-hover-overlay group/section flex min-w-0 items-center gap-1 bg-transparent p-0 text-left text-[11px] font-medium leading-4 tracking-[0.02em] text-[var(--ui-fg-subtle)] transition-colors hover:text-[var(--ui-fg)]"
      >
        <span className="truncate">{label}</span>
        <ChevronRight
          className={cn(
            "sidebar-section-chevron h-3 w-3 shrink-0 text-[var(--ui-fg-placeholder)] transition-[opacity,transform,color] duration-200 ease-out group-hover/section:text-[var(--ui-fg-muted)]",
            expanded && "rotate-90",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {trailing}
    </div>
  );
}

/** Height + opacity expand/collapse for sidebar category lists. */
function SidebarSectionBody({
  expanded,
  children,
  className,
}: {
  expanded: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        expanded
          ? "grid-rows-[1fr] opacity-100"
          : "pointer-events-none grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={!expanded}
    >
      <div className={cn("min-h-0 overflow-hidden", className)}>{children}</div>
    </div>
  );
}

/** Up/down chevron (Phosphor-style) for profile menu affordance */
const ProfileMenuChevron = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 256 256"
    aria-hidden="true"
    className={cn("size-4 shrink-0 text-[var(--ui-fg-muted)]", className)}
  >
    <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
  </svg>
);

interface SidebarProps {
  id?: string;
  handleNewChat: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  /** When true, the nav is a full off-canvas drawer (no slim rail). */
  isMobileLayout: boolean;
  /** When false, width transitions are suppressed to avoid hydration flicker. */
  sidebarReady?: boolean;
  /** Temporary desktop overlay revealed from the collapsed trigger. */
  isPeekPreview?: boolean;
  /** Called after mobile drawer navigation actions (close overlay). */
  onNavigate?: () => void;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
  onPersonalizationClick?: () => void;
  onGiftClick: () => void;
  activeView?: string;
  recentChats: RecentChat[];
  activeChatId: string | null;
  /** Initial / reload fetch of the chats list. */
  chatsLoading?: boolean;
  creatingChatPending?: boolean;
  onSelectChat: (chat: RecentChat) => void;
  onDeleteChat?: (chatId: string) => void;
  onRenameChat?: (chatId: string, newName: string) => void;
  onPinChat?: (chatId: string, pinned: boolean) => void;
  /** Chat IDs with an in-flight assistant generation (sidebar splash). */
  generatingChatIds?: ReadonlySet<string> | string[];
  userDisplayName?: string | null;
  /** True while auth identity is resolving — show skeletons, not mock labels. */
  accountLoading?: boolean;
  userAvatarUrl?: string | null;
  userEmail?: string;
  onLogoutClick?: () => void;
  showAccountMenu?: boolean;
}

export function Sidebar({
  id,
  handleNewChat,
  isCollapsed,
  setIsCollapsed,
  isMobileLayout,
  sidebarReady = true,
  isPeekPreview = false,
  onNavigate,
  onUpgradeClick,
  onSettingsClick,
  onPersonalizationClick,
  onGiftClick,
  activeView,
  recentChats,
  activeChatId,
  chatsLoading = false,
  creatingChatPending: _creatingChatPending = false,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onPinChat,
  generatingChatIds,
  userDisplayName = null,
  accountLoading = false,
  userAvatarUrl,
  userEmail = "",
  onLogoutClick,
  showAccountMenu = true,
}: SidebarProps) {
  const pathname = useAppPathname() || APP_ROUTES.newChat;
  const [chatGroupBy, setChatGroupBy] = useState<ChatGroupBy>("none");
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [recentsExpanded, setRecentsExpanded] = useState(true);
  const cachedPlan = readCachedBillingPlan();
  const [planLabel, setPlanLabel] = useState<string | null>(
    () => cachedPlan?.planLabel ?? null,
  );
  const [planLoading, setPlanLoading] = useState(() => !cachedPlan);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  const sidebarSearchResults = useMemo(() => {
    const query = sidebarSearchQuery.trim().toLocaleLowerCase();
    if (!query) return recentChats.slice(0, 8);
    return recentChats
      .filter((chat) =>
        (chat.name || "New Chat").toLocaleLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [recentChats, sidebarSearchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(CHAT_GROUP_STORAGE_KEY);
      if (stored === "none" || stored === "date") {
        setChatGroupBy(stored);
      }
    } catch {
      /* ignore */
    }
    setPinnedExpanded(readSectionExpanded("pinned", true));
    setRecentsExpanded(readSectionExpanded("recents", true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPlan = async () => {
      if (!userEmail) {
        setPlanLabel(null);
        setPlanLoading(false);
        return;
      }
      const hasCached = Boolean(readCachedBillingPlan());
      if (!hasCached) setPlanLoading(true);
      try {
        const { getBillingSubscription } = await import("@/lib/api/billing");
        const overview = await getBillingSubscription();
        if (cancelled) return;
        const planId = overview.subscription?.plan_id ?? "free";
        const match = overview.plans?.find((p) => p.id === planId);
        const cached = writeCachedBillingPlan(
          planId,
          match?.display_name || planId,
        );
        setPlanLabel(cached.planLabel);
      } catch {
        if (!cancelled) {
          const fallback = writeCachedBillingPlan("free");
          setPlanLabel(fallback.planLabel);
        }
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    };
    void loadPlan();
    const onBillingUpdated = () => void loadPlan();
    window.addEventListener("clauxen:billing-updated", onBillingUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("clauxen:billing-updated", onBillingUpdated);
    };
  }, [userEmail]);

  const toggleSection = (key: SidebarSectionKey) => {
    const setters: Record<
      SidebarSectionKey,
      React.Dispatch<React.SetStateAction<boolean>>
    > = {
      pinned: setPinnedExpanded,
      recents: setRecentsExpanded,
    };
    setters[key]((prev) => {
      const next = !prev;
      writeSectionExpanded(key, next);
      return next;
    });
  };

  const pinnedChats = useMemo(
    () => recentChats.filter((chat) => chat.pinned),
    [recentChats],
  );
  const unpinnedChats = useMemo(
    () => recentChats.filter((chat) => !chat.pinned),
    [recentChats],
  );
  const hasPinnedSection = pinnedChats.length > 0;
  const groupedChats = useMemo(
    () => groupChats(unpinnedChats, chatGroupBy),
    [unpinnedChats, chatGroupBy],
  );

  const overlayHref = (overlay: Parameters<typeof buildOverlayLocation>[0]) =>
    buildOverlayLocation(overlay, pathname);

  const renameChat = useMemo(
    () => recentChats.find((chat) => chat.id === renameChatId) ?? null,
    [recentChats, renameChatId],
  );
  const deleteChat = useMemo(
    () => recentChats.find((chat) => chat.id === deleteChatId) ?? null,
    [recentChats, deleteChatId],
  );

  const handleChatGroupChange = (next: ChatGroupBy) => {
    setChatGroupBy(next);
    try {
      localStorage.setItem(CHAT_GROUP_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const runNavAction = (action: () => void) => {
    action();
    if (isMobileLayout) onNavigate?.();
  };

  const runAccountOverlayAction = (action: () => void) => {
    setAccountMenuOpen(false);
    // Let the menu unmount before the overlay takes focus.
    queueMicrotask(() => {
      runNavAction(action);
      requestAnimationFrame(() => {
        focusAppSurface();
      });
    });
  };

  const generatingSet = useMemo(() => {
    if (!generatingChatIds) return new Set<string>();
    return generatingChatIds instanceof Set
      ? generatingChatIds
      : new Set(generatingChatIds);
  }, [generatingChatIds]);

  const renderChatRow = (chat: RecentChat) => {
    const isGeneratingChat = generatingSet.has(chat.id);
    const isActive = activeChatId === chat.id;
    const chatHref = APP_ROUTES.chat(chat.id);
    // Spinner only when another chat is generating in the background.
    // Never on the active chat, never while creating/starting a new chat.
    const showSidebarSpinner =
      isGeneratingChat &&
      Boolean(activeChatId) &&
      activeChatId !== chat.id &&
      !chat.isCreating &&
      !chat.id.startsWith("pending-");
    return (
      <div
        key={chat.id}
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group/chat glass-sidebar-agent-menu-btn ui-nav-row ui-nav-row--loose w-full rounded-[7px] pl-2.5 pr-1 text-[13px] font-normal leading-[18px] tracking-[-0.006em] text-[var(--ui-fg-body)] transition-[background-color,box-shadow,color] duration-150",
          // One continuous row highlight — never nest hover/selection on
          // the title button or pin/menu actions. Keep the hover pill while
          // pin/menu are focused or the overflow menu is open.
          isActive
            ? "bg-[var(--brand-soft)] text-[var(--ui-fg)]"
            : "hover:bg-[var(--ui-hover-wash)] focus-within:bg-[var(--ui-hover-wash)] has-[[data-state=open]]:bg-[var(--ui-hover-wash)]",
        )}
      >
        <AppHref
          href={chatHref}
          onClick={(event) => {
            if (!isPlainLeftClick(event)) return;
            onSelectChat(chat);
            if (isMobileLayout) onNavigate?.();
          }}
          className="no-hover-overlay flex h-full min-w-0 flex-1 items-center gap-2 bg-transparent text-left text-inherit outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
        >
          <span className="min-w-0 flex-1 truncate">
            {chat.isTitleStreaming ? (
              <StreamingChatTitle title={chat.name || "New Chat"} isStreaming />
            ) : (
              chat.name || "New Chat"
            )}
          </span>
          {chat.isTitleStreaming ? (
            <TypingDots className="mr-0.5 shrink-0" />
          ) : null}
        </AppHref>
        <div className="ml-0.5 flex shrink-0 items-center">
          {showSidebarSpinner ? (
            <span
              className="flex size-[22px] items-center justify-center"
              aria-label="Generating"
              title="Generating"
              role="status"
            >
              <span className="chat-gen-spinner" />
            </span>
          ) : (
            <>
              <button
                type="button"
                aria-label={chat.pinned ? "Unpin chat" : "Pin chat"}
                onClick={(event) => {
                  event.stopPropagation();
                  onPinChat?.(chat.id, !chat.pinned);
                }}
                className="ui-row-icon-button opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100 group-has-[[data-state=open]]/chat:opacity-100 focus-visible:opacity-100"
              >
                {chat.pinned ? (
                  <PinOff strokeWidth={1.5} />
                ) : (
                  <Pin strokeWidth={1.5} />
                )}
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Chat options for ${chat.name || "New Chat"}`}
                    className="ui-row-icon-button opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100 group-has-[[data-state=open]]/chat:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
                  >
                    <MoreVertical className="icon-sm" />
                  </button>
                </DropdownMenuTrigger>
                <ChatRowMenuContent
                  align="end"
                  side="right"
                  isPinned={!!chat.pinned}
                  onRename={() => setRenameChatId(chat.id)}
                  onPin={() => onPinChat?.(chat.id, true)}
                  onUnpin={() => onPinChat?.(chat.id, false)}
                  onDelete={() => setDeleteChatId(chat.id)}
                />
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <nav
        id={id}
        data-skip-global-prompt-focus
        onClick={() => !isMobileLayout && isCollapsed && setIsCollapsed(false)}
        className={cn(
          "cx-sidebar sidebar-hover-area glass-sidebar-docked flex h-full min-h-0 select-none flex-col overflow-hidden pt-[env(safe-area-inset-top)]",
          !isMobileLayout && isCollapsed && "is-collapsed",
          isMobileLayout &&
            "fixed left-0 top-0 z-40 will-change-transform transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          !isMobileLayout && "relative z-20 shrink-0",
          !isMobileLayout &&
            sidebarReady &&
            "transition-[width] duration-300 ease-in-out",
          !isMobileLayout && !sidebarReady && "transition-none",
          isMobileLayout &&
            "w-[min(88vw,288px)] shadow-[12px_0_32px_rgba(24,24,27,0.08)]",
          isMobileLayout &&
            isCollapsed &&
            "pointer-events-none -translate-x-full",
          isMobileLayout &&
            !isCollapsed &&
            "translate-x-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
          !isMobileLayout && isCollapsed && "w-[52px] cursor-pointer",
          !isMobileLayout && !isCollapsed && "w-[min(86vw,256px)] lg:w-[256px]",
        )}
      >
        <div
          className={cn(
            "ui-sidebar-top-bar relative flex h-11 shrink-0 items-center px-2",
            isMobileLayout && "h-11 px-2",
            isCollapsed && !isMobileLayout
              ? "justify-center"
              : "justify-between",
          )}
        >
          {!isCollapsed && !isPeekPreview ? (
            <div className="flex min-w-0 items-center px-1.5">
              <span
                className="clauxen-wordmark truncate leading-none text-[var(--ui-fg)]"
                aria-label="Clauxen"
              >
                Clauxen
              </span>
            </div>
          ) : (
            <span className="sr-only">Clauxen</span>
          )}

          {isMobileLayout && !isCollapsed ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(true);
              }}
              aria-label="Close menu"
              className="ui-icon-button !size-8 shrink-0 touch-manipulation text-[var(--ui-fg-muted)] transition-all duration-200 hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div
          className="sidebar-scrollable app-scrollbar ui-sidebar-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          data-scroll-region=""
        >
          <nav className="cx-nav" aria-label="Primary">
            <AppHref
              href={APP_ROUTES.newChat}
              replace
              onClick={(e) => {
                e.stopPropagation();
                if (!isPlainLeftClick(e)) return;
                e.preventDefault();
                handleNewChat();
              }}
              aria-label="New chat"
              className="cx-nav-btn cx-nav-btn--primary"
            >
              <Plus strokeWidth={1.75} />
              {isCollapsed && !isMobileLayout ? null : <span>New chat</span>}
            </AppHref>
            <AppHref
              href={APP_ROUTES.library}
              onClick={(e) => {
                e.stopPropagation();
                if (!isPlainLeftClick(e)) return;
                if (isMobileLayout) onNavigate?.();
              }}
              aria-label="Library"
              aria-current={activeView === "library" ? "page" : undefined}
              className={cn(
                "cx-nav-btn",
                activeView === "library" && "is-active",
              )}
            >
              <Library strokeWidth={1.75} />
              {isCollapsed && !isMobileLayout ? null : <span>Library</span>}
            </AppHref>
          </nav>

          <div
            className={cn(
              "space-y-px pb-1",
              isCollapsed ? "flex flex-col items-center px-0" : "px-2",
            )}
          >
            {/* Order: Pinned → Recent */}
            {!isCollapsed && hasPinnedSection ? (
              <div className="mt-2.5 mb-1 px-0">
                <SidebarSectionLabel
                  label="Pinned"
                  expanded={pinnedExpanded}
                  onToggle={() => toggleSection("pinned")}
                />
                <SidebarSectionBody
                  expanded={pinnedExpanded}
                  className="space-y-px"
                >
                  {pinnedChats.map((chat) => renderChatRow(chat))}
                </SidebarSectionBody>
              </div>
            ) : null}

            {!isCollapsed && (
              <div
                className={cn(
                  "relative mb-2 px-0",
                  !hasPinnedSection && "mt-2.5",
                )}
              >
                <SidebarSectionLabel
                  label="Recents"
                  expanded={recentsExpanded}
                  onToggle={() => toggleSection("recents")}
                  trailing={
                    <SidebarChatGroupMenu
                      value={chatGroupBy}
                      onChange={handleChatGroupChange}
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                />
                <SidebarSectionBody
                  expanded={recentsExpanded}
                  className="space-y-1"
                >
                  {chatsLoading && recentChats.length === 0 ? (
                    <div className="space-y-px" aria-hidden>
                      {[72, 58, 84, 64, 50, 76, 60].map((width, index) => (
                        <div key={index} className="flex h-[30px] items-center px-2.5">
                          <Skeleton
                            variant="text"
                            className="h-2.5 bg-[var(--ui-hover-wash)]"
                            style={{
                              width: `${width}%`,
                              ["--skeleton-delay" as string]: `${index * 70}ms`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {groupedChats.map((group) => (
                    <div key={group.label || "all"}>
                      {group.label ? (
                        <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium leading-4 text-[var(--ui-fg-subtle)]">
                          {group.label}
                        </p>
                      ) : null}
                      <div className="space-y-px">
                        {group.chats.map((chat) => renderChatRow(chat))}
                      </div>
                    </div>
                  ))}
                </SidebarSectionBody>
              </div>
            )}
          </div>
        </div>

        {showAccountMenu && (
          <div
            className={cn(
              "sidebar-account-footer mt-auto shrink-0 flex flex-col border-t border-[var(--ui-border-subtle)] bg-[var(--app-sidebar-bg,var(--app-shell-bg))]",
              isCollapsed
                ? "items-center gap-1.5 px-0 pb-2 pt-1.5"
                : "items-stretch gap-1 px-2 py-1.5",
            )}
          >
            <div
              className={cn(
                "flex items-center",
                isCollapsed ? "justify-center" : "gap-0.5",
              )}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu
                modal={false}
                open={accountMenuOpen}
                onOpenChange={setAccountMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="Account menu"
                    className={cn(
                      "menu-trigger-active glass-sidebar-footer-account-trigger no-hover-overlay flex items-center border-0 bg-transparent outline-none transition-[background-color] duration-150 hover:bg-[var(--ui-hover-wash)] data-[state=open]:bg-[var(--ui-hover-wash)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
                      isCollapsed
                        ? "size-9 shrink-0 items-center justify-center rounded-full !p-0"
                        : "h-10 min-w-0 flex-1 justify-start gap-2 rounded-[8px] pl-1.5 pr-2",
                    )}
                  >
                    <UserAvatarDisplay
                      name={userDisplayName || "?"}
                      avatarUrl={userAvatarUrl}
                      size="sm"
                      className="size-7 shrink-0 bg-[var(--ui-hover-wash)] text-[11px] leading-none text-[var(--ui-fg-muted)]"
                    />
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 flex-col items-stretch justify-center gap-0 text-left transition-opacity duration-200",
                        isCollapsed ? "hidden w-0 opacity-0" : "opacity-100",
                      )}
                    >
                      {!accountLoading && userDisplayName ? (
                        <p className="truncate text-[13px] font-medium leading-4 text-[var(--ui-fg-body)]">
                          {userDisplayName}
                        </p>
                      ) : null}
                      {!accountLoading &&
                      !(Boolean(userEmail) && (planLoading || !planLabel)) &&
                      planLabel ? (
                        <p className="truncate text-[11px] leading-[14px] text-[var(--ui-fg-muted)]">
                          {planLabel}
                        </p>
                      ) : null}
                    </div>
                    {!isCollapsed && (
                      <ProfileMenuChevron className="size-3.5 opacity-60" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align={isCollapsed ? "center" : "start"}
                  sideOffset={6}
                  collisionPadding={10}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  className="z-[60] w-[min(232px,calc(100vw-2rem))] font-sans"
                >
                  <DropdownMenuLabel className="truncate px-2 pb-1 pt-1 text-[11.5px] font-normal text-[var(--ui-fg-muted)]">
                    {userEmail || "Not signed in"}
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <AppHref
                      href={overlayHref({ type: "settings", tab: "General" })}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        runAccountOverlayAction(onSettingsClick);
                      }}
                      className="ui-menu-row no-hover-overlay cursor-pointer justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Settings className="size-[15px] text-[var(--ui-fg-muted)]" />
                        <span>Settings</span>
                      </div>
                      <span className="text-[11px] tracking-wide text-[var(--ui-fg-subtle)]">⇧⌘,</span>
                    </AppHref>
                  </DropdownMenuItem>
                  {onPersonalizationClick && (
                    <DropdownMenuItem asChild>
                      <AppHref
                        href={overlayHref({
                          type: "settings",
                          tab: "Personalization",
                        })}
                        onClick={(e) => {
                          if (!isPlainLeftClick(e)) return;
                          e.preventDefault();
                          runAccountOverlayAction(onPersonalizationClick);
                        }}
                        className="ui-menu-row no-hover-overlay cursor-pointer"
                      >
                        <Sparkles className="size-[15px] text-[var(--ui-fg-muted)]" />
                        <span>Personalization</span>
                      </AppHref>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="ui-menu-row no-hover-overlay cursor-pointer">
                      <Languages className="size-[15px] text-[var(--ui-fg-muted)]" />
                      <span>Language</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="z-50 w-[184px] font-sans">
                        <DropdownMenuItem className="ui-menu-row no-hover-overlay cursor-pointer">
                          English
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row no-hover-overlay cursor-pointer">
                          Hindi
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row no-hover-overlay cursor-pointer">
                          Tamil
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuItem className="ui-menu-row no-hover-overlay cursor-pointer">
                    <HelpCircle className="size-[15px] text-[var(--ui-fg-muted)]" />
                    <span>Get help</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <AppHref
                      href={overlayHref({ type: "pricing" })}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        runAccountOverlayAction(onUpgradeClick);
                      }}
                      className="ui-menu-row no-hover-overlay cursor-pointer"
                    >
                      <ArrowUpCircle className="size-[15px] text-[var(--ui-fg-muted)]" />
                      <span>Upgrade plan</span>
                    </AppHref>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <AppHref
                      href={overlayHref({ type: "gift" })}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        runAccountOverlayAction(onGiftClick);
                      }}
                      className="ui-menu-row no-hover-overlay cursor-pointer"
                    >
                      <Gift className="size-[15px] text-[var(--ui-fg-muted)]" />
                      <span>Gift Clauxen</span>
                    </AppHref>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="ui-menu-row no-hover-overlay cursor-pointer">
                      <HelpCircle className="size-[15px] text-[var(--ui-fg-muted)]" />
                      <span>Learn more</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="z-50 w-[184px] font-sans">
                        <DropdownMenuItem className="ui-menu-row no-hover-overlay cursor-pointer">
                          Release notes
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row no-hover-overlay cursor-pointer">
                          Documentation
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row no-hover-overlay cursor-pointer">
                          Community
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator className="my-1 bg-[var(--ui-border-subtle)]" />
                  <DropdownMenuItem
                    onClick={() => onLogoutClick?.()}
                    className="ui-menu-row no-hover-overlay cursor-pointer text-destructive"
                  >
                    <LogOut className="size-[15px]" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {!isCollapsed ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  {!isPeekPreview ? (
                    <Popover
                    open={sidebarSearchOpen}
                    onOpenChange={(open) => {
                      setSidebarSearchOpen(open);
                      if (!open) setSidebarSearchQuery("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Search chats"
                        title="Search chats"
                        className={cn(
                          "ui-icon-button !rounded-[7px] text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] data-[state=open]:bg-[var(--ui-hover-wash)] data-[state=open]:text-[var(--ui-fg)]",
                          isMobileLayout ? "!size-8" : "!size-7",
                        )}
                      >
                        <Search className="size-4" strokeWidth={1.75} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="end"
                      sideOffset={6}
                      collisionPadding={10}
                      className="z-[70] w-[min(calc(92vw-1.5rem),256px)] rounded-[12px] border border-[var(--popup-border)] bg-[var(--popup-bg)] p-1 shadow-[var(--popup-shadow)]"
                    >
                      <div className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-2 focus-within:border-[var(--ui-field-focus-border)]">
                        <Search
                          className="size-3.5 shrink-0 text-[var(--ui-fg-placeholder)]"
                          strokeWidth={1.7}
                          aria-hidden
                        />
                        <input
                          autoFocus
                          value={sidebarSearchQuery}
                          onChange={(event) =>
                            setSidebarSearchQuery(event.target.value)
                          }
                          placeholder="Search chats"
                          aria-label="Search chat history"
                          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)]"
                        />
                      </div>
                      <div className="mt-1 max-h-64 space-y-px overflow-y-auto">
                        {sidebarSearchResults.length ? (
                          sidebarSearchResults.map((chat) => (
                            <AppHref
                              key={chat.id}
                              href={APP_ROUTES.chat(chat.id)}
                              onClick={() => {
                                setSidebarSearchOpen(false);
                                onSelectChat(chat);
                                if (isMobileLayout) onNavigate?.();
                              }}
                              className="flex h-[30px] w-full items-center rounded-[7px] px-2 text-left text-[13px] text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                            >
                              <span className="truncate">
                                {chat.name || "New Chat"}
                              </span>
                            </AppHref>
                          ))
                        ) : (
                          <p className="px-2 py-4 text-center text-[12px] text-[var(--ui-fg-muted)]">
                            No chats found
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                    </Popover>
                  ) : null}

                  {!isPeekPreview && !isMobileLayout ? (
                    <button
                      type="button"
                      onClick={() => setIsCollapsed(true)}
                      aria-label="Collapse sidebar"
                      title="Collapse sidebar"
                      className="ui-icon-button !size-7 !rounded-[7px] text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <SidebarToggleIcon className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </nav>
      <RenameChatDialog
        open={renameChatId != null}
        onOpenChange={(open) => {
          if (!open) setRenameChatId(null);
        }}
        chatTitle={renameChat?.name ?? "New Chat"}
        onConfirm={(title) => {
          if (renameChatId) onRenameChat?.(renameChatId, title);
        }}
      />
      <DeleteChatDialog
        open={deleteChatId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteChatId(null);
        }}
        chatTitle={deleteChat?.name ?? "New Chat"}
        onConfirm={() => {
          if (deleteChatId) onDeleteChat?.(deleteChatId);
        }}
        onOpenSettings={onSettingsClick}
      />
    </>
  );
}
