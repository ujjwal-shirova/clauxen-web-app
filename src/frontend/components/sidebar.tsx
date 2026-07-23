"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Settings,
  ArrowUpCircle,
  Briefcase,
  Bot,
  CalendarClock,
  ChevronRight,
  Code2,
  Ellipsis,
  Gift,
  HelpCircle,
  LogOut,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Search,
  Languages,
  Sparkles,
  Library,
  UserRound,
  X,
  LayoutGrid,
} from "lucide-react";
import {
  SidebarToggleIcon,
  SidebarOpenIcon,
  NewChatIcon,
  NavProjectsIcon,
} from "./icons";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";
import { sidebarDisplayName } from "@/lib/profile-names";
import { UserAvatarDisplay } from "@/frontend/components/settings/profile-avatar-upload";
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
} from "@/frontend/components/ui/dropdown-menu";
import { TypingDots } from "./ui/typing-dots";
import { StreamingChatTitle } from "./streaming-chat-title";
import { RenameChatDialog } from "./rename-chat-dialog";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { SidebarChatGroupMenu } from "./sidebar-chat-group-menu";
import {
  groupChats,
  hasProjectAssignments,
  type ChatGroupBy,
} from "@/frontend/lib/chat-grouping";
import type { ApiProject } from "@/frontend/lib/api/projects";
import type { RecentChat } from "@/frontend/lib/types";

const CHAT_GROUP_STORAGE_KEY = "clauxen_chat_group_by";
const SECTION_STORAGE_PREFIX = "clauxen_sidebar_section_";
const CLAUXEN_LOGO_SRC = "/assets/icons/clauxen-icon.png";

type SidebarSectionKey = "pinned" | "projects" | "recents" | "more";

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

/** Category label — bold on hover, no button wash; chevron for expand/collapse. */
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
    <div className="flex items-center justify-between gap-1 px-2 py-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-expanded={expanded}
        className="label-hover-bold no-hover-overlay group/section flex min-w-0 items-center gap-0.5 bg-transparent p-0 text-left text-[11px] font-medium tracking-[-0.002em] text-zinc-500/90 hover:text-zinc-800"
      >
        <span className="truncate">{label}</span>
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-200 group-hover/section:text-zinc-600",
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

/** Up/down chevron (Phosphor-style) for profile menu affordance */
const ProfileMenuChevron = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    fill="currentColor"
    viewBox="0 0 256 256"
    aria-hidden="true"
    className={cn("shrink-0 text-zinc-500", className)}
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
  /** Called after mobile drawer navigation actions (close overlay). */
  onNavigate?: () => void;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
  onPersonalizationClick?: () => void;
  onCustomizeClick?: () => void;
  onAppsExtensionsClick: () => void;
  onLibraryClick: () => void;
  onGiftClick: () => void;
  onProjectsClick: () => void;
  onMyClauxenClick?: () => void;
  onScheduledTasksClick?: () => void;
  onClauxenCodeClick?: () => void;
  onClauxenWorkClick?: () => void;
  onClauxenClawClick?: () => void;
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
  projects?: ApiProject[];
  projectsLoading?: boolean;
  activeProjectId?: string | null;
  onNewProjectClick?: () => void;
  onSelectProject?: (project: ApiProject) => void;
  userDisplayName?: string;
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
  onNavigate,
  onUpgradeClick,
  onSettingsClick,
  onPersonalizationClick,
  onCustomizeClick,
  onAppsExtensionsClick,
  onLibraryClick,
  onGiftClick,
  onProjectsClick,
  onMyClauxenClick,
  onScheduledTasksClick,
  onClauxenCodeClick,
  onClauxenWorkClick,
  onClauxenClawClick,
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
  projects = [],
  projectsLoading = false,
  activeProjectId = null,
  onNewProjectClick,
  onSelectProject,
  userDisplayName = "Guest",
  userAvatarUrl,
  userEmail = "",
  onLogoutClick,
  showAccountMenu = true,
}: SidebarProps) {
  const isCustomizeActive = activeView === "customize";
  const [chatGroupBy, setChatGroupBy] = useState<ChatGroupBy>("none");
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [recentsExpanded, setRecentsExpanded] = useState(true);
  const [moreExpanded, setMoreExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(CHAT_GROUP_STORAGE_KEY);
      if (stored === "none" || stored === "date" || stored === "project") {
        setChatGroupBy(stored);
      }
    } catch {
      /* ignore */
    }
    setPinnedExpanded(readSectionExpanded("pinned", true));
    setProjectsExpanded(readSectionExpanded("projects", true));
    setRecentsExpanded(readSectionExpanded("recents", true));
    setMoreExpanded(readSectionExpanded("more", false));
  }, []);

  const toggleSection = (key: SidebarSectionKey) => {
    const setters: Record<
      SidebarSectionKey,
      React.Dispatch<React.SetStateAction<boolean>>
    > = {
      pinned: setPinnedExpanded,
      projects: setProjectsExpanded,
      recents: setRecentsExpanded,
      more: setMoreExpanded,
    };
    setters[key]((prev) => {
      const next = !prev;
      writeSectionExpanded(key, next);
      return next;
    });
  };

  const projectGroupingEnabled = hasProjectAssignments(recentChats);
  const pinnedChats = useMemo(
    () => recentChats.filter((chat) => chat.pinned),
    [recentChats],
  );
  const unpinnedChats = useMemo(
    () => recentChats.filter((chat) => !chat.pinned),
    [recentChats],
  );
  const groupedChats = useMemo(
    () => groupChats(unpinnedChats, chatGroupBy),
    [unpinnedChats, chatGroupBy],
  );
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

  const navButtonClass = (active = false) =>
    cn(
      "ui-sidebar-menu-button mb-0 flex h-8 w-full items-center rounded-md text-[12.5px] font-[430] leading-[18px] text-zinc-800 transition-all duration-75 hover:bg-zinc-100",
      isCollapsed
        ? "mx-auto h-8 w-8 justify-center"
        : "justify-start px-2",
      active && "bg-black/[0.06]",
    );

  const renderNavButton = ({
    label,
    icon,
    onClick,
    active = false,
    trailing,
  }: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    trailing?: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className={navButtonClass(active)}
    >
      <div
        className={cn("flex min-w-0 items-center gap-2", !isCollapsed && "w-full")}
      >
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          {icon}
        </div>
        {!isCollapsed && <span className="truncate">{label}</span>}
        {!isCollapsed && trailing}
      </div>
    </button>
  );

  const generatingSet = useMemo(() => {
    if (!generatingChatIds) return new Set<string>();
    return generatingChatIds instanceof Set
      ? generatingChatIds
      : new Set(generatingChatIds);
  }, [generatingChatIds]);

  const renderChatRow = (chat: RecentChat) => {
    const isGeneratingChat = generatingSet.has(chat.id);
    const isActive = activeChatId === chat.id;
    // Spinner only for background generations — active chat already shows the stream.
    const showSidebarSpinner =
      isGeneratingChat && activeChatId !== chat.id;
    return (
      <div
        key={chat.id}
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group/chat glass-sidebar-agent-menu-btn flex h-7 w-full items-center rounded-md px-2 text-[12.5px] font-[430] text-zinc-800 transition-colors",
          // One continuous row highlight — never nest hover/selection on
          // the title button or pin/menu actions.
          isActive ? "bg-black/[0.06]" : "hover:bg-zinc-100",
        )}
      >
        <button
          type="button"
          onClick={() => onSelectChat(chat)}
          className="no-hover-overlay flex h-full min-w-0 flex-1 items-center gap-1.5 bg-transparent text-left text-inherit outline-none focus-visible:ring-2 focus-visible:ring-black/10"
        >
          <span className="min-w-0 flex-1 truncate">
            {chat.isTitleStreaming ? (
              <StreamingChatTitle
                title={chat.name || "New Chat"}
                isStreaming
              />
            ) : (
              chat.name || "New Chat"
            )}
          </span>
          {chat.isTitleStreaming ? <TypingDots className="mr-0.5 shrink-0" /> : null}
        </button>
        <div className="ml-1 flex shrink-0 items-center gap-0.5">
          {showSidebarSpinner ? (
            <span
              className="flex h-6 w-6 items-center justify-center"
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
                className="no-hover-overlay flex h-6 w-6 items-center justify-center rounded-md bg-transparent text-zinc-500 opacity-0 transition-[opacity,color] group-hover/chat:opacity-100 hover:bg-transparent hover:text-zinc-800 focus-visible:opacity-100 focus-visible:outline-none"
              >
                {chat.pinned ? (
                  <PinOff className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Pin className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Chat options for ${chat.name || "New Chat"}`}
                    className="no-hover-overlay flex h-6 w-6 items-center justify-center rounded-md bg-transparent text-zinc-500 opacity-0 transition-[opacity,color] group-hover/chat:opacity-100 hover:bg-transparent hover:text-zinc-800 data-[state=open]:bg-transparent data-[state=open]:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                  >
                    <MoreVertical className="icon-md icon-muted" />
                  </button>
                </DropdownMenuTrigger>
                <ChatRowMenuContent
                  align="end"
                  side="right"
                  isPinned={!!chat.pinned}
                  onRename={() => setRenameChatId(chat.id)}
                  onMoveToProject={() => runNavAction(onProjectsClick)}
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
      onClick={() =>
        !isMobileLayout &&
        isCollapsed &&
        !isCustomizeActive &&
        setIsCollapsed(false)
      }
      className={cn(
        "sidebar-hover-area glass-sidebar-docked flex h-full min-h-0 select-none flex-col overflow-hidden bg-[var(--app-shell-bg)] pt-[env(safe-area-inset-top)]",
        isMobileLayout &&
          "fixed left-0 top-0 z-30 will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
        !isMobileLayout &&
          "relative z-20 shrink-0",
        !isMobileLayout &&
          sidebarReady &&
          "transition-[width] duration-300 ease-in-out",
        !isMobileLayout && !sidebarReady && "transition-none",
        isMobileLayout &&
          isCollapsed &&
          "pointer-events-none w-[min(88vw,240px)] -translate-x-full shadow-none",
        isMobileLayout &&
          !isCollapsed &&
          "z-40 w-[min(88vw,240px)] translate-x-0 shadow-[12px_0_32px_rgba(24,24,27,0.08)] pb-[env(safe-area-inset-bottom)]",
        !isMobileLayout &&
          isCollapsed &&
          "w-[48px] cursor-pointer",
        !isMobileLayout &&
          !isCollapsed &&
          "w-[min(84vw,210px)] lg:w-[210px]",
      )}
    >
      <div className="ui-sidebar-top-bar relative flex h-10 shrink-0 items-center justify-between pl-1.5 pr-0.5">
        <div
          className={cn(
            "flex items-center pl-1.5 transition-opacity duration-300",
            isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100",
          )}
        >
          <img
            src={CLAUXEN_LOGO_SRC}
            alt="Clauxen"
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 rounded-[6px] object-contain"
            draggable={false}
          />
        </div>

        {isCollapsed && !isMobileLayout ? (
          <div className="group/sidebar-logo absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <img
              src={CLAUXEN_LOGO_SRC}
              alt="Clauxen"
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 rounded-[6px] object-contain transition-opacity duration-200 group-hover/sidebar-logo:opacity-0"
              draggable={false}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isCustomizeActive) setIsCollapsed(false);
              }}
              disabled={isCustomizeActive}
              aria-label="Expand sidebar"
              className={cn(
                "absolute inset-0 inline-flex items-center justify-center rounded-md p-1.5 text-zinc-500 opacity-0 transition-all duration-200 hover:bg-zinc-100 group-hover/sidebar-logo:opacity-100",
                isCustomizeActive && "cursor-not-allowed opacity-0",
              )}
            >
              <SidebarOpenIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isCustomizeActive) setIsCollapsed(!isCollapsed);
            }}
            disabled={isCustomizeActive}
            aria-label={
              isMobileLayout && !isCollapsed ? "Close menu" : "Toggle sidebar"
            }
            className={cn(
              "ui-icon-button rounded-md p-1.5 text-zinc-500 transition-all duration-200 hover:bg-zinc-100",
              isCustomizeActive && "cursor-not-allowed opacity-30",
            )}
          >
            {isMobileLayout && !isCollapsed ? (
              <X className="h-[18px] w-[18px]" />
            ) : isCollapsed ? (
              <SidebarOpenIcon className="h-[18px] w-[18px]" />
            ) : (
              <SidebarToggleIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        )}
      </div>

      <div className="sidebar-scrollable app-scrollbar ui-sidebar-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div
          className={cn(
            "sticky top-0 z-10 bg-[var(--app-shell-bg)] pl-1.5 pr-0.5 pb-1.5 pt-1",
            isCollapsed && "px-0",
          )}
        >
          <div className={cn("py-0.5", isCollapsed ? "px-0" : "px-1")}>
            {isCollapsed ? (
              <button
                onClick={(e) => e.stopPropagation()}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-all hover:bg-zinc-100"
              >
                <Search className="h-[18px] w-[18px] opacity-70" />
              </button>
            ) : (
              <button
                onClick={(e) => e.stopPropagation()}
                className="group flex h-8 w-full items-center justify-between gap-2 rounded-md border border-transparent bg-transparent px-2 text-[12.5px] text-zinc-700 transition-all hover:bg-zinc-100"
              >
                <div className="flex items-center gap-2.5">
                  <Search className="h-3.5 w-3.5 opacity-60" />
                  <span className="font-[430] opacity-60">Search</span>
                </div>
                <span className="pr-0.5 text-[10.5px] font-medium text-black/30">
                  Ctrl+K
                </span>
              </button>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleNewChat();
            }}
            aria-label="New chat"
            className={cn(
              "ui-sidebar-menu-button group mb-0 h-8 w-full justify-start gap-2 px-2 text-[12.5px] font-[430] text-zinc-800 transition-all hover:bg-zinc-100",
              isCollapsed &&
                "mx-auto flex h-8 w-8 shrink-0 justify-center rounded-lg px-0",
            )}
          >
            <div className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-zinc-500/15">
              <NewChatIcon className="h-3 w-3 text-zinc-800" />
            </div>
            {!isCollapsed && (
              <span className="flex-1 truncate text-left">New chat</span>
            )}
          </Button>
        </div>

        <div className="space-y-0.5 pl-1.5 pr-0.5">
          {renderNavButton({
            label: "Library",
            icon: <Library className="h-[18px] w-[18px]" />,
            onClick: () => runNavAction(onLibraryClick),
            active: activeView === "library",
          })}

          {renderNavButton({
            label: "My Clauxen",
            icon: <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />,
            onClick: () =>
              runNavAction(() => {
                (onMyClauxenClick ?? onCustomizeClick)?.();
              }),
            active: activeView === "customize" || activeView === "my-clauxen",
          })}

          {renderNavButton({
            label: "Scheduled Task",
            icon: (
              <CalendarClock className="h-[18px] w-[18px]" strokeWidth={1.75} />
            ),
            onClick: () =>
              runNavAction(() => {
                onScheduledTasksClick?.();
              }),
            active: activeView === "scheduled-tasks",
          })}

          {renderNavButton({
            label: "More",
            icon: <Ellipsis className="h-[18px] w-[18px]" strokeWidth={1.75} />,
            onClick: () => {
              if (isCollapsed) {
                setIsCollapsed(false);
                if (!moreExpanded) toggleSection("more");
                return;
              }
              toggleSection("more");
            },
            trailing: !isCollapsed ? (
              <ChevronRight
                className={cn(
                  "ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200",
                  moreExpanded && "rotate-90",
                )}
                strokeWidth={2}
                aria-hidden
              />
            ) : undefined,
          })}

          {!isCollapsed && moreExpanded ? (
            <div className="mb-0.5 space-y-0.5 pl-2">
              {renderNavButton({
                label: "Clauxen Code",
                icon: <Code2 className="h-[18px] w-[18px]" strokeWidth={1.75} />,
                onClick: () =>
                  runNavAction(() => {
                    onClauxenCodeClick?.();
                  }),
                active: activeView === "clauxen-code",
              })}
              {renderNavButton({
                label: "Clauxen Work",
                icon: (
                  <Briefcase className="h-[18px] w-[18px]" strokeWidth={1.75} />
                ),
                onClick: () =>
                  runNavAction(() => {
                    onClauxenWorkClick?.();
                  }),
                active: activeView === "clauxen-work",
              })}
              {renderNavButton({
                label: "Clauxen Claw",
                icon: <Bot className="h-[18px] w-[18px]" strokeWidth={1.75} />,
                onClick: () =>
                  runNavAction(() => {
                    onClauxenClawClick?.();
                  }),
                active: activeView === "clauxen-claw",
              })}
            </div>
          ) : null}

          {!isCollapsed && pinnedChats.length > 0 ? (
            <div className="mt-3 mb-1.5 px-0.5">
              <SidebarSectionLabel
                label="Pinned chats"
                expanded={pinnedExpanded}
                onToggle={() => toggleSection("pinned")}
              />
              {pinnedExpanded ? (
                <div className="mt-1 space-y-0.5">
                  {pinnedChats.map((chat) => renderChatRow(chat))}
                </div>
              ) : null}
            </div>
          ) : null}

          {!isCollapsed ? (
            <div className="mt-2 mb-1.5 px-0.5">
              <SidebarSectionLabel
                label="Projects"
                expanded={projectsExpanded}
                onToggle={() => toggleSection("projects")}
              />
              {projectsExpanded ? (
                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      runNavAction(() => {
                        onNewProjectClick?.();
                      });
                    }}
                    className="group/chat glass-sidebar-agent-menu-btn flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-[12.5px] font-[430] text-zinc-800 transition-colors hover:bg-zinc-100"
                  >
                    <Plus
                      className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                      strokeWidth={2}
                    />
                    <span className="truncate">New Project</span>
                  </button>
                  {projectsLoading && projects.length === 0 ? (
                    <div
                      className="space-y-1.5 px-0.5"
                      aria-busy="true"
                      aria-label="Loading projects"
                    >
                      {[1, 2, 3].map((row) => (
                        <div
                          key={row}
                          className="h-7 overflow-hidden rounded-md"
                          aria-hidden
                        >
                          <div
                            className="h-full shimmer-bg rounded-md"
                            style={{
                              width: `${68 - ((row * 9) % 22)}%`,
                              minWidth: "40%",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {projects.map((project) => {
                    const isActive = activeProjectId === project.id;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          runNavAction(() => {
                            onSelectProject?.(project);
                          });
                        }}
                        data-active={isActive ? "true" : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group/chat glass-sidebar-agent-menu-btn flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-[12.5px] font-[430] text-zinc-800 transition-colors",
                          isActive ? "bg-black/[0.06]" : "hover:bg-zinc-100",
                        )}
                      >
                        <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-zinc-500">
                          <NavProjectsIcon className="h-[14px] w-[14px]" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left">
                          {project.name || "Untitled project"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {!isCollapsed && (
            <div className="relative mb-3 px-0.5">
              <SidebarSectionLabel
                label="Recent chats"
                expanded={recentsExpanded}
                onToggle={() => toggleSection("recents")}
                trailing={
                  <SidebarChatGroupMenu
                    value={chatGroupBy}
                    onChange={handleChatGroupChange}
                    projectGroupingEnabled={projectGroupingEnabled}
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              />
              {recentsExpanded ? (
                <div className="mt-1 space-y-2">
                  {chatsLoading &&
                  groupedChats.length === 0 &&
                  pinnedChats.length === 0 ? (
                    <div
                      className="space-y-1.5 px-0.5"
                      aria-busy="true"
                      aria-label="Loading conversations"
                    >
                      {[1, 2, 3, 4, 5, 6].map((row) => (
                        <div
                          key={row}
                          className="h-7 overflow-hidden rounded-md"
                          aria-hidden
                        >
                          <div
                            className="h-full shimmer-bg rounded-md"
                            style={{
                              width: `${72 - ((row * 7) % 28)}%`,
                              minWidth: "42%",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {groupedChats.map((group) => (
                    <div key={group.label || "all"}>
                      {group.label ? (
                        <p className="px-2 py-1 text-[11px] font-medium text-zinc-500">
                          {group.label}
                        </p>
                      ) : null}
                      <div className="space-y-0.5">
                        {group.chats.map((chat) => renderChatRow(chat))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {showAccountMenu && (
        <div
          className={cn(
            "mt-auto shrink-0 flex flex-col bg-[var(--app-shell-bg)]",
            isCollapsed
              ? "items-center gap-2 px-0 pb-2 pt-1"
              : "items-stretch gap-1 py-1.5 pl-1.5 pr-0.5",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              isCollapsed ? "justify-center" : "gap-1",
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu modal={!isMobileLayout}>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    "menu-trigger-active glass-sidebar-footer-account-trigger flex items-center outline-none transition-colors duration-200 hover:bg-zinc-100 data-[state=open]:bg-black/5",
                    isCollapsed
                      ? "h-8 w-8 shrink-0 items-center justify-center gap-0 rounded-full p-0"
                      : "min-w-0 flex-1 justify-start gap-2 rounded-md p-1.5",
                  )}
                >
                  <UserAvatarDisplay
                    name={userDisplayName}
                    avatarUrl={userAvatarUrl}
                    size={isCollapsed ? "sm" : "md"}
                    className={isCollapsed ? "h-8 w-8" : "h-9 w-9"}
                  />
                  <div
                    className={cn(
                      "flex-1 text-left min-w-0 flex flex-col transition-opacity duration-200",
                      isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100",
                    )}
                  >
                    <p className="truncate text-[12.5px] font-medium leading-4 text-zinc-800">
                      {userDisplayName}
                    </p>
                    <p className="text-[11px] leading-3.5 text-zinc-500">
                      Free plan
                    </p>
                  </div>
                  {!isCollapsed && (
                    <ProfileMenuChevron className="shrink-0 opacity-80" />
                  )}
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align={isCollapsed ? "center" : "end"}
              sideOffset={6}
              collisionPadding={12}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="z-[60] w-[min(252px,calc(100vw-2rem))] rounded-xl border border-zinc-300 bg-white/85 p-1.5 font-sans shadow-lg backdrop-blur-3xl"
            >
              <DropdownMenuLabel className="px-2 py-1 text-[12px] font-[430] text-zinc-500 truncate">
                {userEmail || "Not signed in"}
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => runNavAction(onSettingsClick)}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-zinc-800" />
                  <span>Settings</span>
                </div>
                <span className="text-[12px] text-zinc-500">⇧⌘,</span>
              </DropdownMenuItem>
              {onPersonalizationClick && (
                <DropdownMenuItem
                  onClick={() => {
                    if (onPersonalizationClick)
                      runNavAction(onPersonalizationClick);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-zinc-800" />
                  <span>Personalization</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-lg data-[state=open]:bg-black/5 cursor-pointer">
                  <Languages className="w-5 h-5 text-zinc-800" />
                  <span>Language</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-[220px] bg-white/80 backdrop-blur-3xl border-zinc-300 rounded-xl shadow-lg p-1.5 z-50 font-sans">
                    <DropdownMenuItem className="px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                      English
                    </DropdownMenuItem>
                    <DropdownMenuItem className="px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                      Hindi
                    </DropdownMenuItem>
                    <DropdownMenuItem className="px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                      Tamil
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuItem className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                <HelpCircle className="w-5 h-5 text-zinc-800" />
                <span>Get help</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => runNavAction(onUpgradeClick)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <ArrowUpCircle className="w-5 h-5 text-zinc-800" />
                <span>Upgrade plan</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => runNavAction(onAppsExtensionsClick)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <LayoutGrid className="w-5 h-5 text-zinc-800" />
                <span>Apps and extensions</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => runNavAction(onGiftClick)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <Gift className="w-5 h-5 text-zinc-800" />
                <span>Gift Clauxen</span>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-lg data-[state=open]:bg-black/5 cursor-pointer">
                  <HelpCircle className="w-5 h-5 text-zinc-800" />
                  <span>Learn more</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-[220px] bg-white/80 backdrop-blur-3xl border-zinc-300 rounded-xl shadow-lg p-1.5 z-50 font-sans">
                    <DropdownMenuItem className="px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                      Release notes
                    </DropdownMenuItem>
                    <DropdownMenuItem className="px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                      Documentation
                    </DropdownMenuItem>
                    <DropdownMenuItem className="px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer">
                      Community
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator className="my-1.5 bg-zinc-900/10" />
              <DropdownMenuItem
                onClick={() => onLogoutClick?.()}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer text-destructive"
              >
                <LogOut className="w-5 h-5" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
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
