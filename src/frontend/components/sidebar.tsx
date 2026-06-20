"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Settings,
  ArrowUpCircle,
  Gift,
  HelpCircle,
  LogOut,
  MoreVertical,
  Search,
  Languages,
  Sparkles,
  Library,
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
import { OrbCursor } from "./ui/orb-cursor";
import { SidebarBasicsChecklist } from "./sidebar-basics-checklist";
import { RenameChatDialog } from "./rename-chat-dialog";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { SidebarChatGroupMenu } from "./sidebar-chat-group-menu";
import {
  groupChats,
  hasProjectAssignments,
  type ChatGroupBy,
} from "@/frontend/lib/chat-grouping";
import type { RecentChat } from "@/frontend/lib/types";

const CHAT_GROUP_STORAGE_KEY = "clauxen_chat_group_by";

const CustomizeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M12.5 3C13.3284 3 14 3.67157 14 4.5V6H14.5C16.433 6 18 7.567 18 9.5V15.5C18 16.3284 17.3284 17 16.5 17H3.5C2.72334 17 2.08461 16.4097 2.00781 15.6533L2 15.5V9.5C2 7.567 3.567 6 5.5 6H6V4.5C6 3.67157 6.67157 3 7.5 3H12.5ZM3 15.5L3.00977 15.6006C3.05629 15.8286 3.25829 16 3.5 16H16.5C16.7761 16 17 15.7761 17 15.5V12H13V12.5C13 12.7761 12.7761 13 12.5 13C12.2239 13 12 12.7761 12 12.5V12H8V12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5V12H3V15.5ZM5.5 7C4.11929 7 3 8.11929 3 9.5V11H7V10.5C7 10.2239 7.22386 10 7.5 10C7.77614 10 8 10.2239 8 10.5V11H12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V11H17V9.5C17 8.11929 15.8807 7 14.5 7H5.5ZM7.5 4C7.22386 4 7 4.22386 7 4.5V6H13V4.5C13 4.22386 12.7761 4 12.5 4H7.5Z" />
  </svg>
);

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

const ProfileAvatarIcon = ({ className }: { className?: string }) => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("h-9 w-9 shrink-0", className)}
  >
    <circle cx="14" cy="14" r="14" fill="#6A9BCC" />
    <path
      d="M21.22 18.72C21.22 18.72 21.17 18.72 21.14 18.74C20.88 18.98 20.66 19.24 20.38 19.49C20.32 19.55 20.27 19.6 20.21 19.67C20.15 19.72 20.12 19.75 20.05 19.81C19.97 19.92 19.86 19.97 19.75 20.05C19.68 20.15 19.6 20.26 19.49 20.32C19.44 20.37 19.41 20.43 19.35 20.49C19.31 20.53 19.24 20.6 19.2 20.66C19.17 20.67 19.12 20.67 19.08 20.7C19.04 20.73 18.98 20.81 18.92 20.85C18.89 20.89 18.89 20.89 18.84 20.93C18.79 20.97 18.78 21.02 18.72 21.05C18.64 21.11 18.64 21.22 18.53 21.15C18.53 21.14 18.39 21.05 18.39 21.05C18.35 21.03 18.38 21.03 18.34 20.97C18.17 20.88 18.05 20.72 17.9 20.6C17.8 20.51 17.66 20.43 17.56 20.32C17.54 20.27 17.54 20.23 17.47 20.21C17.35 20.1 17.25 19.96 17.13 19.86C17.09 19.83 17.06 19.81 17.01 19.78C16.98 19.75 16.86 19.7 16.83 19.66C16.83 19.64 16.82 19.6 16.8 19.59C16.76 19.53 16.74 19.53 16.69 19.47C16.66 19.46 16.63 19.41 16.63 19.41C16.62 19.42 16.57 19.44 16.55 19.46C16.55 19.47 16.55 19.49 16.53 19.52C16.51 19.55 16.44 19.57 16.4 19.6C16.36 19.63 16.35 19.67 16.31 19.7C16.31 19.7 16.29 19.7 16.27 19.7C16.22 19.7 16.18 19.81 16.14 19.83C16.13 19.86 16.11 19.86 16.07 19.88C16.05 19.92 16.01 19.96 15.96 19.99C15.92 20.03 15.92 20.03 15.88 20.05C15.79 20.15 15.7 20.23 15.61 20.32C15.57 20.32 15.55 20.38 15.52 20.4C15.5 20.42 15.45 20.43 15.45 20.47C15.39 20.49 15.39 20.52 15.36 20.55C15.29 20.62 15.21 20.67 15.13 20.77C15.08 20.82 15.04 20.82 14.99 20.86C14.94 20.89 14.94 20.92 14.89 20.94C14.78 21.04 14.75 21.11 14.63 21.19C14.55 21.23 14.55 21.25 14.52 21.3C14.43 21.4 14.34 21.45 14.26 21.54C14.18 21.62 14.14 21.66 14.07 21.74C14.06 21.74 14.04 21.78 14.03 21.76C13.92 21.66 13.8 21.54 13.7 21.43C13.64 21.37 13.57 21.32 13.51 21.25C13.37 21.14 13.33 21.04 13.22 20.94C13.16 20.89 13.09 20.78 13.04 20.73C12.89 20.59 12.71 20.44 12.56 20.27C12.45 20.15 12.35 20.08 12.24 19.97C12.16 19.92 12.08 19.83 12 19.77C11.9 19.66 11.76 19.53 11.64 19.41C11.57 19.52 11.49 19.6 11.38 19.7C11.35 19.75 11.24 19.78 11.21 19.83C11.08 19.96 10.97 20.12 10.84 20.23C10.77 20.32 10.68 20.38 10.58 20.47C10.43 20.6 10.27 20.77 10.11 20.93C9.94 21.11 9.76 21.3 9.55 21.47C9.5 21.51 9.44 21.55 9.4 21.62C9.38 21.57 9.32 21.57 9.31 21.56C9.28 21.55 9.28 21.52 9.28 21.51C9.22 21.44 9.16 21.41 9.11 21.34C9.02 21.22 9 21.23 8.91 21.14C8.88 21.11 8.86 21.11 8.83 21.08C8.82 21.05 8.8 21 8.77 21C8.77 21 8.74 20.97 8.73 20.96C8.7 20.94 8.69 20.89 8.66 20.88C8.65 20.86 8.62 20.86 8.61 20.85C8.54 20.78 8.44 20.67 8.37 20.6C8.25 20.51 8.14 20.4 8.06 20.32C7.9 20.18 7.79 20.05 7.68 19.92C7.54 19.77 7.4 19.6 7.25 19.47C7.22 19.44 7.15 19.41 7.18 19.35C7.17 19.35 7.15 19.35 7.15 19.35C7.14 19.35 7.14 19.34 7.14 19.33C7.07 19.24 6.99 19.15 6.89 19.06C6.82 19.02 6.75 18.98 6.7 18.9C6.7 18.9 6.7 18.85 6.66 18.83C6.65 18.82 6.63 18.84 6.65 18.79C6.56 18.78 6.52 18.71 6.45 18.64C6.44 18.62 6.37 18.6 6.4 18.56C6.34 18.56 6.34 18.48 6.37 18.43C6.4 18.35 6.46 18.34 6.52 18.24C6.61 18.19 6.67 18.11 6.75 18.02C7.19 17.54 7.63 17.09 8.12 16.66C8.25 16.55 8.36 16.43 8.5 16.31C8.51 16.29 8.53 16.25 8.58 16.24C8.58 16.24 8.45 16.13 8.43 16.13C8.26 15.96 8.14 15.84 8 15.66C7.74 15.33 7.4 15.05 7.11 14.75C7.04 14.69 7 14.63 6.93 14.55C6.9 14.53 6.85 14.48 6.82 14.45C6.81 14.44 6.79 14.41 6.78 14.39C6.66 14.29 6.56 14.15 6.44 14.06C6.42 14.03 6.37 13.96 6.34 13.96C6.34 13.93 6.31 13.96 6.3 13.93C6.24 13.92 6.27 13.82 6.3 13.79C6.31 13.78 6.34 13.75 6.35 13.75C6.44 13.64 6.51 13.52 6.59 13.42C6.61 13.39 6.63 13.39 6.63 13.37C6.65 13.36 6.63 13.34 6.66 13.33C6.67 13.33 6.7 13.3 6.71 13.27C6.79 13.19 6.79 13.15 6.89 13.07C6.93 13.07 6.96 13.07 7 13.01C7 12.98 7 12.98 7.03 12.96C7.12 12.86 7.23 12.71 7.34 12.61C7.4 12.56 7.49 12.48 7.56 12.45C7.68 12.35 7.74 12.22 7.88 12.12C7.9 12.08 7.95 12.05 7.99 11.99C8.14 11.82 8.32 11.67 8.5 11.5C8.51 11.46 8.58 11.45 8.59 11.41C8.41 11.23 8.22 11.08 8.06 10.87C7.92 10.73 7.78 10.58 7.62 10.46C7.51 10.36 7.45 10.25 7.34 10.16C7.19 9.96 6.95 9.76 6.82 9.55C6.79 9.53 6.75 9.44 6.81 9.4C6.82 9.4 6.83 9.43 6.83 9.4C6.86 9.4 6.9 9.31 6.93 9.28C7 9.21 7.11 9.1 7.19 9C7.22 8.99 7.25 8.96 7.27 8.95C7.34 8.85 7.43 8.7 7.54 8.65C7.59 8.59 7.67 8.53 7.69 8.48C7.82 8.34 7.92 8.19 8.06 8.06C8.09 8.01 8.18 7.99 8.22 7.95C8.25 7.9 8.29 7.85 8.32 7.8C8.43 7.71 8.53 7.63 8.65 7.54C8.7 7.49 8.76 7.4 8.77 7.4C8.8 7.34 8.83 7.34 8.86 7.34C8.88 7.34 8.91 7.29 8.94 7.26C9.06 7.14 9.16 7.07 9.28 6.93C9.31 6.89 9.43 6.7 9.48 6.7C9.55 6.71 9.55 6.75 9.58 6.78C9.58 6.79 9.66 6.81 9.68 6.82C9.72 6.88 9.78 6.93 9.83 6.96C9.84 7 9.88 7.07 9.92 7.08C9.92 7.08 9.94 7.08 9.95 7.08C10.02 7.12 10.05 7.19 10.1 7.23C10.27 7.45 10.49 7.6 10.65 7.82C10.74 7.97 10.8 8.04 10.91 8.14C11.06 8.26 11.18 8.37 11.35 8.51C11.37 8.54 11.43 8.59 11.46 8.65L11.58 8.48C11.65 8.45 11.69 8.41 11.75 8.37C11.8 8.26 11.91 8.19 11.99 8.09C12 8.08 12.04 8.01 12.08 7.99C12.1 7.95 12.16 7.9 12.16 7.89C12.2 7.88 12.21 7.8 12.24 7.79C12.26 7.79 12.27 7.79 12.27 7.79C12.27 7.79 12.29 7.77 12.3 7.74C12.45 7.63 12.57 7.48 12.71 7.34C12.79 7.26 12.87 7.15 12.96 7.08C13.01 7 13.12 6.95 13.16 6.89C13.22 6.81 13.33 6.74 13.39 6.67C13.52 6.59 13.59 6.49 13.67 6.37L13.82 6.22C13.82 6.27 13.86 6.27 13.88 6.31C13.96 6.4 14.07 6.51 14.15 6.61C14.32 6.78 14.53 6.88 14.69 7.03C14.7 7.07 14.74 7.11 14.77 7.12C14.82 7.18 14.89 7.23 14.94 7.29C15.02 7.34 15.05 7.45 15.13 7.49C15.13 7.51 15.18 7.54 15.21 7.56C15.22 7.59 15.25 7.63 15.25 7.67C15.39 7.79 15.55 7.92 15.7 8.06C15.8 8.12 15.9 8.25 16.01 8.34C16.06 8.37 16.06 8.37 16.11 8.41C16.16 8.47 16.22 8.51 16.24 8.59C16.25 8.56 16.31 8.56 16.31 8.53C16.35 8.51 16.36 8.45 16.4 8.43C16.46 8.36 16.53 8.29 16.6 8.23C16.69 8.14 16.74 8.08 16.83 8C16.9 7.99 16.92 7.9 16.96 7.88C17.01 7.8 17.06 7.77 17.1 7.69C17.24 7.54 17.35 7.4 17.47 7.23C17.51 7.22 17.56 7.22 17.6 7.19C17.64 7.18 17.67 7.14 17.68 7.11C17.73 7.07 17.8 7 17.83 6.95C17.89 6.89 17.95 6.79 17.99 6.75C18 6.72 18.09 6.65 18.13 6.65C18.13 6.65 18.2 6.7 18.22 6.7C18.32 6.78 18.38 6.89 18.45 6.95C18.69 7.19 18.93 7.4 19.15 7.63C19.23 7.71 19.28 7.79 19.34 7.88C19.53 8.09 19.75 8.29 19.96 8.5C19.99 8.53 20.04 8.58 20.08 8.59C20.15 8.69 20.21 8.77 20.27 8.86C20.48 9.05 20.67 9.22 20.86 9.4C20.92 9.47 20.96 9.53 21.02 9.58C21.05 9.62 21.3 9.78 21.3 9.81C21.18 9.92 21.08 10.02 20.97 10.16C20.74 10.38 20.53 10.58 20.32 10.82C20.23 10.88 20.23 10.87 20.18 10.9C20.12 10.91 20.1 10.99 20.05 11.04C19.92 11.18 19.78 11.31 19.68 11.46C19.64 11.5 19.63 11.56 19.6 11.58C19.57 11.64 19.49 11.65 19.47 11.69C19.44 11.71 19.44 11.75 19.42 11.76C19.49 11.78 19.53 11.85 19.59 11.9C19.63 11.96 19.63 11.94 19.66 11.99C19.75 12.1 19.88 12.2 19.96 12.3C20.08 12.45 20.21 12.61 20.33 12.75C20.38 12.76 20.42 12.78 20.44 12.79C20.48 12.81 20.49 12.87 20.52 12.89C20.59 12.96 20.72 13.03 20.77 13.09C20.86 13.18 21 13.34 21.1 13.42C21.11 13.42 21.11 13.42 21.13 13.44C21.17 13.47 21.19 13.56 21.23 13.59C21.32 13.69 21.4 13.75 21.51 13.85C21.58 13.92 21.63 14.04 21.74 14.12C21.76 14.14 21.71 14.18 21.69 14.2C21.66 14.25 21.63 14.26 21.59 14.3C21.45 14.45 21.32 14.63 21.17 14.75C21.08 14.85 21 14.92 20.93 15.02C20.82 15.13 20.67 15.22 20.58 15.33C20.53 15.36 20.51 15.39 20.48 15.45C20.42 15.47 20.37 15.55 20.32 15.61C20.27 15.66 20.22 15.73 20.2 15.78C20.18 15.79 20.15 15.79 20.12 15.8C20.12 15.84 20.12 15.85 20.1 15.88C20.05 15.92 19.97 15.95 19.94 16C19.88 16.05 19.86 16.11 19.81 16.17C19.75 16.24 19.68 16.31 19.6 16.36C19.53 16.44 19.49 16.52 19.42 16.57C19.41 16.58 19.35 16.58 19.35 16.62C19.44 16.66 19.52 16.76 19.57 16.82C19.7 16.96 19.83 17.09 19.96 17.21C20.03 17.27 20.08 17.37 20.18 17.45C20.37 17.64 20.55 17.88 20.77 18.03C20.83 18.09 20.93 18.13 21 18.2C21.08 18.28 21.14 18.36 21.23 18.45C21.28 18.5 21.32 18.52 21.3 18.6C21.29 18.61 21.23 18.68 21.23 18.71C21.22 18.71 21.22 18.71 21.22 18.71L21.22 18.72Z"
      fill="#CBCADB"
    />
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
  onCustomizeClick: () => void;
  onAppsExtensionsClick: () => void;
  onHistoryClick: () => void;
  onLibraryClick: () => void;
  onGiftClick: () => void;
  onProjectsClick: () => void;
  activeView?: string;
  recentChats: RecentChat[];
  activeChatId: string | null;
  onSelectChat: (chat: RecentChat) => void;
  onDeleteChat?: (chatId: string) => void;
  onRenameChat?: (chatId: string, newName: string) => void;
  onPinChat?: (chatId: string, pinned: boolean) => void;
  userDisplayName?: string;
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
  onHistoryClick,
  onLibraryClick,
  onGiftClick,
  onProjectsClick,
  activeView,
  recentChats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onPinChat,
  userDisplayName = "Guest",
  userEmail = "",
  onLogoutClick,
  showAccountMenu = true,
}: SidebarProps) {
  const isCustomizeActive = activeView === "customize";
  const [chatGroupBy, setChatGroupBy] = useState<ChatGroupBy>("none");
  const [showBasicsChecklist, setShowBasicsChecklist] = useState(false);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(CHAT_GROUP_STORAGE_KEY);
      if (stored === "none" || stored === "date" || stored === "project") {
        setChatGroupBy(stored);
      }
      const basicsRaw = localStorage.getItem("clauxen_sidebar_basics_v1");
      const basicsState = basicsRaw
        ? (JSON.parse(basicsRaw) as { dismissed?: boolean })
        : { dismissed: false };
      setShowBasicsChecklist(!basicsState.dismissed);
    } catch {
      setShowBasicsChecklist(true);
    }
  }, []);

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

  const renderChatRow = (chat: RecentChat) => (
    <div
      key={chat.id}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelectChat(chat);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectChat(chat);
        }
      }}
      className={cn(
        "group/chat glass-sidebar-agent-menu-btn flex h-7 w-full cursor-pointer items-center rounded-md px-2 text-left text-[12.5px] font-[430] text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
        activeChatId === chat.id && "bg-black/[0.06]",
      )}
    >
      <div className="flex h-full min-w-0 flex-1 items-center text-left">
        <span className="truncate">{chat.name || "New Chat"}</span>
        {chat.isTitleStreaming && <OrbCursor />}
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-all group-hover/chat:opacity-100 hover:bg-zinc-100 data-[state=open]:opacity-100 data-[state=open]:bg-black/5"
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
          onClick={(e) => e.stopPropagation()}
        />
      </DropdownMenu>
    </div>
  );

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
      <div className="ui-sidebar-top-bar relative flex h-10 shrink-0 items-center justify-between px-1.5">
        <div
          className={cn(
            "flex items-center pl-1.5 transition-opacity duration-300",
            isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100",
          )}
        >
          <div className="flex items-center pl-1.5">
            <span className="font-sans text-[13px] font-medium tracking-[-0.01em] text-zinc-800">
              Clauxen
            </span>
          </div>
        </div>

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
            isCollapsed && !isMobileLayout
              ? "absolute left-1/2 -translate-x-1/2"
              : "",
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
      </div>

      <div className="sidebar-scrollable app-scrollbar ui-sidebar-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div
          className={cn(
            "sticky top-0 z-10 bg-[var(--app-shell-bg)] px-1.5 pb-1.5 pt-1",
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

        <div className="space-y-0.5 px-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              runNavAction(onLibraryClick);
            }}
            className={cn(
              "ui-sidebar-menu-button mb-0 flex h-8 w-full items-center rounded-md text-[12.5px] font-[430] leading-[18px] text-zinc-800 transition-all duration-75 hover:bg-zinc-100",
              isCollapsed
                ? "mx-auto h-8 w-8 justify-center"
                : "justify-start px-2",
              activeView === "library" && "bg-black/[0.06]",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2",
                !isCollapsed && "w-full",
              )}
            >
              <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <Library className="h-[18px] w-[18px]" />
              </div>
              {!isCollapsed && <span className="truncate">Library</span>}
            </div>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              runNavAction(onProjectsClick);
            }}
            className={cn(
              "ui-sidebar-menu-button mb-0 flex h-8 w-full items-center rounded-md text-[12.5px] font-[430] leading-[18px] text-zinc-800 transition-all duration-75 hover:bg-zinc-100",
              isCollapsed
                ? "mx-auto h-8 w-8 justify-center"
                : "justify-start px-2",
              activeView === "projects" && "bg-black/[0.06]",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2",
                !isCollapsed && "w-full",
              )}
            >
              <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <NavProjectsIcon />
              </div>
              {!isCollapsed && <span className="truncate">Projects</span>}
            </div>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              runNavAction(onCustomizeClick);
            }}
            className={cn(
              "ui-sidebar-menu-button mb-0 flex h-8 w-full items-center rounded-md text-[12.5px] font-[430] leading-[18px] text-zinc-800 transition-all duration-75 hover:bg-zinc-100",
              isCollapsed
                ? "mx-auto h-8 w-8 justify-center"
                : "justify-start px-2",
              activeView === "customize" && "bg-black/[0.06]",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2",
                !isCollapsed && "w-full",
              )}
            >
              <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <CustomizeIcon />
              </div>
              {!isCollapsed && <span className="truncate">Customize</span>}
            </div>
          </button>

          {!isCollapsed && pinnedChats.length > 0 ? (
            <div className="mt-3 mb-1.5 px-0.5">
              <p className="px-2 py-1 text-[11px] font-medium tracking-[-0.002em] text-zinc-500/90">
                Pinned Chats
              </p>
              <div className="mt-1 space-y-0.5">
                {pinnedChats.map((chat) => renderChatRow(chat))}
              </div>
            </div>
          ) : null}

          {!isCollapsed && (
            <div className="relative mb-3 px-0.5">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-[11px] font-medium tracking-[-0.002em] text-zinc-500/90">
                  Recents
                </p>
                <SidebarChatGroupMenu
                  value={chatGroupBy}
                  onChange={handleChatGroupChange}
                  projectGroupingEnabled={projectGroupingEnabled}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="mt-1 space-y-2">
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
              : "items-stretch gap-1 p-1.5",
          )}
        >
          {!isCollapsed && showBasicsChecklist ? (
            <SidebarBasicsChecklist
              onDismiss={() => setShowBasicsChecklist(false)}
              steps={[
                {
                  id: "import-history",
                  title: "Bring history from another AI",
                  onSelect: () => runNavAction(onSettingsClick),
                },
                {
                  id: "connect-tools",
                  title: "Connect your everyday tools",
                  onSelect: () => runNavAction(onCustomizeClick),
                },
                {
                  id: "desktop-app",
                  title: "Get the desktop app",
                  onSelect: () => runNavAction(onAppsExtensionsClick),
                },
              ]}
            />
          ) : null}
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
                  <ProfileAvatarIcon
                    className={isCollapsed ? "h-8 w-8" : undefined}
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
