"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Settings,
  ArrowUpCircle,
  ArrowUpRight,
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
  Languages,
  Sparkles,
  Library,
  SlidersHorizontal,
  UserRound,
  X,
  LayoutGrid,
} from "lucide-react";
import {
  SidebarToggleIcon,
  SidebarOpenIcon,
  NewChatBubbleIcon,
  NavProjectsIcon,
} from "./icons";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/use-is-client";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { AppHref, isPlainLeftClick } from "@/components/app-href";
import { APP_ROUTES, buildOverlayLocation } from "@/lib/app-routes";
import { UserAvatarDisplay } from "@/components/settings/profile-avatar-upload";
import { Skeleton } from "@/components/ui/skeleton";
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
import { StreamingChatTitle } from "./streaming-chat-title";
import { RenameChatDialog } from "./rename-chat-dialog";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { SidebarChatGroupMenu } from "./sidebar-chat-group-menu";
import {
  groupChats,
  hasProjectAssignments,
  type ChatGroupBy,
} from "@/lib/chat-grouping";
import type { ApiProject } from "@/lib/api/projects";
import type { RecentChat } from "@/lib/types";

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
    <div className="flex items-center justify-between gap-1 px-2 py-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-expanded={expanded}
        className="label-hover-bold no-hover-overlay group/section flex min-w-0 items-center gap-0.5 bg-transparent p-0 text-left text-[13px] font-semibold tracking-[-0.01em] text-zinc-800 hover:text-zinc-950"
      >
        <span className="truncate">{label}</span>
        <ChevronRight
          className={cn(
            "sidebar-section-chevron h-3 w-3 shrink-0 text-zinc-400 transition-[opacity,transform,color] duration-200 ease-out group-hover/section:text-zinc-600",
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

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-zinc-200/90 bg-zinc-100/90 px-1 font-sans text-[10px] font-medium leading-none text-zinc-500">
      {children}
    </kbd>
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
    className={cn("size-4 shrink-0 text-zinc-500", className)}
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
  /** Projects currently pinned into the shared Pinned section. */
  pinnedProjects?: ApiProject[];
  projectsLoading?: boolean;
  activeProjectId?: string | null;
  onNewProjectClick?: () => void;
  onSelectProject?: (project: ApiProject) => void;
  onPinProject?: (projectId: string, pinned: boolean) => void;
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
  chatsLoading: _chatsLoading = false,
  creatingChatPending: _creatingChatPending = false,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onPinChat,
  generatingChatIds,
  projects = [],
  pinnedProjects = [],
  projectsLoading: _projectsLoading = false,
  activeProjectId = null,
  onNewProjectClick,
  onSelectProject,
  onPinProject,
  userDisplayName = null,
  accountLoading = false,
  userAvatarUrl,
  userEmail = "",
  onLogoutClick,
  showAccountMenu = true,
}: SidebarProps) {
  const pathname = useAppPathname() || APP_ROUTES.newChat;
  const isClient = useIsClient();
  const isApplePlatform =
    isClient &&
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(
      `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`,
    );
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
  const pinnedProjectIdSet = useMemo(
    () => new Set(pinnedProjects.map((p) => p.id)),
    [pinnedProjects],
  );
  const unpinnedProjects = useMemo(
    () => projects.filter((p) => !pinnedProjectIdSet.has(p.id)),
    [projects, pinnedProjectIdSet],
  );
  const hasPinnedSection = pinnedChats.length > 0 || pinnedProjects.length > 0;
  const groupedChats = useMemo(
    () => groupChats(unpinnedChats, chatGroupBy),
    [unpinnedChats, chatGroupBy],
  );

  const overlayHref = (overlay: Parameters<typeof buildOverlayLocation>[0]) =>
    buildOverlayLocation(overlay, pathname);

  const renderProjectRow = (
    project: ApiProject,
    opts?: { pinned?: boolean },
  ) => {
    const isActive = activeProjectId === project.id;
    const showUnpin = Boolean(opts?.pinned);
    const projectHref = APP_ROUTES.project(project.id);
    return (
      <div
        key={`project-${project.id}`}
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group/chat glass-sidebar-agent-menu-btn ui-nav-row ui-nav-row--loose w-full rounded-lg px-2.5 text-[14px] font-medium text-zinc-800 transition-colors",
          isActive ? "bg-black/[0.06]" : "hover:bg-zinc-100",
        )}
      >
        <AppHref
          href={projectHref}
          onClick={(event) => {
            event.stopPropagation();
            if (!isPlainLeftClick(event)) return;
            onSelectProject?.(project);
            if (isMobileLayout) onNavigate?.();
          }}
          className="no-hover-overlay flex h-full min-w-0 flex-1 items-center gap-1.5 bg-transparent text-left text-inherit outline-none focus-visible:ring-2 focus-visible:ring-black/10"
        >
          <span className="ui-nav-icon text-zinc-500">
            <NavProjectsIcon className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {project.name || "Untitled project"}
          </span>
        </AppHref>
        {onPinProject ? (
          <button
            type="button"
            aria-label={showUnpin ? "Unpin project" : "Pin project"}
            onClick={(event) => {
              event.stopPropagation();
              onPinProject(project.id, !showUnpin);
            }}
            className="ui-row-icon-button ml-1 opacity-0 transition-[opacity,color] group-hover/chat:opacity-100 focus-visible:opacity-100"
          >
            {showUnpin ? <PinOff strokeWidth={2} /> : <Pin strokeWidth={2} />}
          </button>
        ) : null}
      </div>
    );
  };
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

  const navButtonClass = (active = false, muted = false) =>
    cn(
      "ui-sidebar-menu-button mb-0 w-full rounded-lg text-[14px] font-medium leading-5 transition-all duration-75 hover:bg-zinc-100",
      muted ? "text-zinc-400 hover:text-zinc-500" : "text-zinc-800",
      isCollapsed
        ? "ui-icon-button mx-auto justify-center gap-0 px-0"
        : "ui-nav-row justify-start px-2.5",
      active && "bg-black/[0.06]",
    );

  const renderNavButton = ({
    label,
    icon,
    href,
    onClick,
    active = false,
    muted = false,
    trailing,
    replace = false,
    looseGap = false,
  }: {
    label: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    active?: boolean;
    muted?: boolean;
    trailing?: React.ReactNode;
    replace?: boolean;
    /** Block 2 (submenu / secondary) uses 6px icon–label gap */
    looseGap?: boolean;
  }) => {
    const body = (
      <div
        className={cn(
          "flex min-w-0 items-center",
          looseGap ? "gap-1.5" : "gap-[3px]",
          !isCollapsed && "w-full",
        )}
      >
        <div className={cn("ui-nav-icon", muted && "opacity-60")}>{icon}</div>
        {!isCollapsed && (
          <span className={cn("truncate", muted && "text-zinc-400")}>
            {label}
          </span>
        )}
        {!isCollapsed && trailing}
      </div>
    );

    if (href) {
      return (
        <AppHref
          href={href}
          replace={replace}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={navButtonClass(active, muted)}
          onClick={(e) => {
            e.stopPropagation();
            if (!isPlainLeftClick(e)) return;
            onClick?.();
            if (isMobileLayout) onNavigate?.();
          }}
        >
          {body}
        </AppHref>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        aria-label={label}
        className={navButtonClass(active, muted)}
      >
        {body}
      </button>
    );
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
    const chatHref = chat.projectId
      ? APP_ROUTES.projectChat(chat.id)
      : APP_ROUTES.chat(chat.id);
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
          "group/chat glass-sidebar-agent-menu-btn ui-nav-row ui-nav-row--loose w-full rounded-lg px-2.5 text-[14px] font-medium text-zinc-800 transition-colors",
          // One continuous row highlight — never nest hover/selection on
          // the title button or pin/menu actions.
          isActive ? "bg-black/[0.06]" : "hover:bg-zinc-100",
        )}
      >
        <AppHref
          href={chatHref}
          onClick={(event) => {
            if (!isPlainLeftClick(event)) return;
            onSelectChat(chat);
            if (isMobileLayout) onNavigate?.();
          }}
          className="no-hover-overlay flex h-full min-w-0 flex-1 items-center gap-1.5 bg-transparent text-left text-inherit outline-none focus-visible:ring-2 focus-visible:ring-black/10"
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
                className="ui-row-icon-button opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100"
              >
                {chat.pinned ? (
                  <PinOff strokeWidth={2} />
                ) : (
                  <Pin strokeWidth={2} />
                )}
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Chat options for ${chat.name || "New Chat"}`}
                    className="ui-row-icon-button opacity-0 group-hover/chat:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
                  >
                    <MoreVertical className="icon-md" />
                  </button>
                </DropdownMenuTrigger>
                <ChatRowMenuContent
                  align="end"
                  side="right"
                  isPinned={!!chat.pinned}
                  onRename={() => setRenameChatId(chat.id)}
                  moveToProjectHref={APP_ROUTES.projects}
                  onMoveToProject={() => {
                    // Side-effects only — AppHref owns the route change.
                    runNavAction(onProjectsClick);
                  }}
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
          !isMobileLayout && "relative z-20 shrink-0",
          !isMobileLayout &&
            sidebarReady &&
            "transition-[width] duration-300 ease-in-out",
          !isMobileLayout && !sidebarReady && "transition-none",
          isMobileLayout &&
            isCollapsed &&
            "pointer-events-none w-[min(88vw,280px)] -translate-x-full shadow-none",
          isMobileLayout &&
            !isCollapsed &&
            "z-40 w-[min(88vw,280px)] translate-x-0 shadow-[12px_0_32px_rgba(24,24,27,0.08)] pb-[env(safe-area-inset-bottom)]",
          !isMobileLayout && isCollapsed && "w-[48px] cursor-pointer",
          !isMobileLayout && !isCollapsed && "w-[min(86vw,256px)] lg:w-[256px]",
        )}
      >
        <div className="ui-sidebar-top-bar relative flex h-11 shrink-0 items-center justify-between pl-2 pr-1">
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
            <div className="group/sidebar-logo absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
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
                  "ui-icon-button absolute inset-0 text-zinc-500 opacity-0 transition-all duration-200 hover:bg-zinc-100 group-hover/sidebar-logo:opacity-100",
                  isCustomizeActive && "cursor-not-allowed opacity-0",
                )}
              >
                <SidebarOpenIcon className="size-[18px]" />
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
                "ui-icon-button text-zinc-500 transition-all duration-200 hover:bg-zinc-100",
                isCustomizeActive && "cursor-not-allowed opacity-30",
              )}
            >
              {isMobileLayout && !isCollapsed ? (
                <X className="size-[18px]" />
              ) : isCollapsed ? (
                <SidebarOpenIcon className="size-[18px]" />
              ) : (
                <SidebarToggleIcon className="size-[18px]" />
              )}
            </button>
          )}
        </div>

        <div
          className="sidebar-scrollable app-scrollbar ui-sidebar-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          data-scroll-region=""
        >
          <div
            className={cn(
              "sticky top-0 z-10 bg-[var(--app-shell-bg)] pl-2 pr-1.5 pb-2 pt-1.5",
              isCollapsed && "px-0",
            )}
          >
            <div className={cn(isCollapsed ? "px-0" : "px-1")}>
              {isCollapsed ? (
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
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-colors hover:bg-zinc-50"
                >
                  <NewChatBubbleIcon className="size-[18px]" />
                </AppHref>
              ) : (
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
                  className="group flex h-[34px] w-full items-center justify-between gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-2.5 text-[14px] font-medium text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-colors hover:bg-zinc-50"
                >
                  <span className="flex min-w-0 items-center gap-[3px]">
                    <NewChatBubbleIcon className="size-[18px] shrink-0 text-zinc-800" />
                    <span className="truncate">New Chat</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <ShortcutKey>{isApplePlatform ? "⌘" : "Ctrl"}</ShortcutKey>
                    <ShortcutKey>K</ShortcutKey>
                  </span>
                </AppHref>
              )}
            </div>
          </div>

          <div className="space-y-0.5 pl-2 pr-1.5">
            {/* New Chat pill is above — nav order: My Clauxen → Library → Scheduled → Customize */}
            {renderNavButton({
              label: "My Clauxen",
              icon: <UserRound className="size-[18px]" strokeWidth={1.75} />,
              href: APP_ROUTES.myClauxen,
              onClick: () => {
                (
                  onMyClauxenClick ??
                  onPersonalizationClick ??
                  onCustomizeClick
                )?.();
              },
              active: activeView === "my-clauxen",
            })}

            {renderNavButton({
              label: "Library",
              icon: <Library className="size-[18px]" />,
              href: APP_ROUTES.library,
              onClick: onLibraryClick,
              active: activeView === "library",
            })}

            {renderNavButton({
              label: "Scheduled Task",
              icon: (
                <CalendarClock className="size-[18px]" strokeWidth={1.75} />
              ),
              href: APP_ROUTES.scheduledTasks,
              onClick: () => onScheduledTasksClick?.(),
              active: activeView === "scheduled-tasks",
            })}

            {renderNavButton({
              label: "Customize",
              icon: (
                <SlidersHorizontal className="size-[18px]" strokeWidth={1.75} />
              ),
              href: overlayHref({ type: "settings", tab: "Connectors" }),
              onClick: () => onCustomizeClick?.(),
              active: activeView === "connectors",
            })}

            {renderNavButton({
              label: moreExpanded ? "Collapse" : "More",
              icon: <Ellipsis className="size-[18px]" strokeWidth={1.75} />,
              muted: moreExpanded,
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
                    "sidebar-section-chevron ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400 transition-[opacity,transform] duration-200",
                    moreExpanded && "rotate-90",
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              ) : undefined,
            })}

            {!isCollapsed ? (
              <SidebarSectionBody
                expanded={moreExpanded}
                className="mb-0.5 space-y-0.5 pl-2"
              >
                {renderNavButton({
                  label: "Clauxen Code",
                  icon: <Code2 className="size-[18px]" strokeWidth={1.75} />,
                  onClick: () =>
                    runNavAction(() => {
                      onClauxenCodeClick?.();
                    }),
                  active: activeView === "clauxen-code",
                  looseGap: true,
                  trailing: !isCollapsed ? (
                    <ArrowUpRight
                      className="ml-auto size-4 shrink-0 text-zinc-400"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  ) : undefined,
                })}
                {renderNavButton({
                  label: "Clauxen Collabry",
                  icon: (
                    <Briefcase className="size-[18px]" strokeWidth={1.75} />
                  ),
                  onClick: () =>
                    runNavAction(() => {
                      onClauxenWorkClick?.();
                    }),
                  active: activeView === "clauxen-work",
                  looseGap: true,
                  trailing: !isCollapsed ? (
                    <ArrowUpRight
                      className="ml-auto size-4 shrink-0 text-zinc-400"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  ) : undefined,
                })}
                {renderNavButton({
                  label: "Clauxen Claw",
                  icon: <Bot className="size-[18px]" strokeWidth={1.75} />,
                  onClick: () =>
                    runNavAction(() => {
                      onClauxenClawClick?.();
                    }),
                  active: activeView === "clauxen-claw",
                  looseGap: true,
                })}
              </SidebarSectionBody>
            ) : null}

            {/* Order: Pinned (chats + projects) → Projects → Recent */}
            {!isCollapsed && hasPinnedSection ? (
              <div className="mt-3 mb-1.5 px-0.5">
                <SidebarSectionLabel
                  label="Pinned"
                  expanded={pinnedExpanded}
                  onToggle={() => toggleSection("pinned")}
                />
                <SidebarSectionBody
                  expanded={pinnedExpanded}
                  className="mt-1 space-y-0.5"
                >
                  {pinnedProjects.map((project) =>
                    renderProjectRow(project, { pinned: true }),
                  )}
                  {pinnedChats.map((chat) => renderChatRow(chat))}
                </SidebarSectionBody>
              </div>
            ) : null}

            {!isCollapsed ? (
              <div className="mt-2 mb-1.5 px-0.5">
                <SidebarSectionLabel
                  label="Projects"
                  expanded={projectsExpanded}
                  onToggle={() => toggleSection("projects")}
                />
                <SidebarSectionBody
                  expanded={projectsExpanded}
                  className="mt-1 space-y-0.5"
                >
                  <AppHref
                    href={APP_ROUTES.projects}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isPlainLeftClick(event)) return;
                      onNewProjectClick?.();
                      if (isMobileLayout) onNavigate?.();
                    }}
                    className="group/chat glass-sidebar-agent-menu-btn ui-nav-row ui-nav-row--loose w-full rounded-lg px-2.5 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
                  >
                    <Plus
                      className="size-[18px] shrink-0 text-zinc-500"
                      strokeWidth={1.75}
                    />
                    <span className="truncate">New Project</span>
                  </AppHref>
                  {unpinnedProjects.map((project) => renderProjectRow(project))}
                </SidebarSectionBody>
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
                <SidebarSectionBody
                  expanded={recentsExpanded}
                  className="mt-1 space-y-2"
                >
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
                </SidebarSectionBody>
              </div>
            )}
          </div>
        </div>

        {showAccountMenu && (
          <div
            className={cn(
              "mt-auto shrink-0 flex flex-col bg-[var(--app-shell-bg)]",
              isCollapsed
                ? "items-center gap-2 px-0 pb-2.5 pt-1"
                : "items-stretch gap-1 py-2 pl-2 pr-1.5",
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
                        ? "ui-icon-button shrink-0 items-center justify-center gap-0 rounded-full !p-0"
                        : "ui-nav-row h-8 min-h-8 w-full justify-start gap-[3px] rounded-lg px-2.5 py-0",
                    )}
                  >
                    <UserAvatarDisplay
                      name={userDisplayName || "?"}
                      avatarUrl={userAvatarUrl}
                      size="sm"
                      className="h-[18px] w-[18px] shrink-0 text-[10px]"
                    />
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 text-left transition-opacity duration-200",
                        isCollapsed ? "hidden w-0 opacity-0" : "opacity-100",
                      )}
                    >
                      {accountLoading || !userDisplayName ? (
                        <Skeleton
                          className="h-3.5 w-[7.5rem] max-w-full"
                          variant="text"
                        />
                      ) : (
                        <p className="truncate text-[14px] font-medium leading-5 text-zinc-800">
                          {userDisplayName}
                        </p>
                      )}
                    </div>
                    {!isCollapsed && (
                      <ProfileMenuChevron className="opacity-80" />
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
                  <DropdownMenuLabel className="px-2.5 py-1.5 text-[12px] font-medium text-zinc-500 truncate">
                    {userEmail || "Not signed in"}
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <AppHref
                      href={overlayHref({ type: "settings", tab: "General" })}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        runNavAction(onSettingsClick);
                      }}
                      className="ui-menu-row cursor-pointer justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Settings className="size-4 text-zinc-800" />
                        <span>Settings</span>
                      </div>
                      <span className="text-[12px] text-zinc-500">⇧⌘,</span>
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
                          runNavAction(onPersonalizationClick);
                        }}
                        className="ui-menu-row cursor-pointer"
                      >
                        <Sparkles className="size-4 text-zinc-800" />
                        <span>Personalization</span>
                      </AppHref>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="ui-menu-row cursor-pointer">
                      <Languages className="size-4 text-zinc-800" />
                      <span>Language</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-[220px] bg-white/80 backdrop-blur-3xl border-zinc-300 rounded-xl shadow-lg p-1.5 z-50 font-sans">
                        <DropdownMenuItem className="ui-menu-row cursor-pointer">
                          English
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row cursor-pointer">
                          Hindi
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row cursor-pointer">
                          Tamil
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuItem className="ui-menu-row cursor-pointer">
                    <HelpCircle className="size-4 text-zinc-800" />
                    <span>Get help</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <AppHref
                      href={overlayHref({ type: "pricing" })}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        runNavAction(onUpgradeClick);
                      }}
                      className="ui-menu-row cursor-pointer"
                    >
                      <ArrowUpCircle className="size-4 text-zinc-800" />
                      <span>Upgrade plan</span>
                    </AppHref>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <AppHref
                      href={overlayHref({ type: "apps" })}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        runNavAction(onAppsExtensionsClick);
                      }}
                      className="ui-menu-row cursor-pointer"
                    >
                      <LayoutGrid className="size-4 text-zinc-800" />
                      <span>Apps and extensions</span>
                    </AppHref>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <AppHref
                      href={overlayHref({ type: "gift" })}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        runNavAction(onGiftClick);
                      }}
                      className="ui-menu-row cursor-pointer"
                    >
                      <Gift className="size-4 text-zinc-800" />
                      <span>Gift Clauxen</span>
                    </AppHref>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="ui-menu-row cursor-pointer">
                      <HelpCircle className="size-4 text-zinc-800" />
                      <span>Learn more</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-[220px] bg-white/80 backdrop-blur-3xl border-zinc-300 rounded-xl shadow-lg p-1.5 z-50 font-sans">
                        <DropdownMenuItem className="ui-menu-row cursor-pointer">
                          Release notes
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row cursor-pointer">
                          Documentation
                        </DropdownMenuItem>
                        <DropdownMenuItem className="ui-menu-row cursor-pointer">
                          Community
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator className="my-1.5 bg-zinc-900/10" />
                  <DropdownMenuItem
                    onClick={() => onLogoutClick?.()}
                    className="ui-menu-row cursor-pointer text-destructive"
                  >
                    <LogOut className="size-4" />
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
