"use client";

import type { MouseEventHandler } from "react";
import {
  Archive,
  ChevronRight,
  Folder,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Share,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AppHref } from "@/components/app-href";
import { APP_ROUTES } from "@/lib/app-routes";

export const chatRowMenuItemClass = "ui-menu-row cursor-pointer";

type ChatRowMenuContentProps = {
  isPinned?: boolean;
  align?: "start" | "end" | "center";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onShare?: () => void;
  onStartGroupChat?: () => void;
  onRename?: () => void;
  /** Side-effects only when href is used; navigation comes from AppHref. */
  onMoveToProject?: () => void;
  moveToProjectHref?: string;
  onPin?: () => void;
  onUnpin?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  showMoveToProject?: boolean;
};

export function ChatRowMenuContent({
  isPinned = false,
  align = "start",
  side = "bottom",
  sideOffset = 6,
  className,
  onClick,
  onShare,
  onStartGroupChat,
  onRename,
  onMoveToProject,
  moveToProjectHref = APP_ROUTES.projects,
  onPin,
  onUnpin,
  onArchive,
  onDelete,
  showMoveToProject = true,
}: ChatRowMenuContentProps) {
  return (
    <DropdownMenuContent
      align={align}
      side={side}
      sideOffset={sideOffset}
      onClick={onClick}
      className={cn(
        "z-50 min-w-[220px] rounded-xl border border-black/[0.08] bg-white p-1.5 text-zinc-800 shadow-[0_8px_28px_rgba(26,23,18,0.12)]",
        className,
      )}
    >
      <DropdownMenuItem
        className={chatRowMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          onShare?.();
        }}
      >
        <Share className="size-4 shrink-0 text-zinc-800" />
        Share
      </DropdownMenuItem>
      <DropdownMenuItem
        className={chatRowMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          onStartGroupChat?.();
        }}
      >
        <UserPlus className="size-4 shrink-0 text-zinc-800" />
        Start a group chat
      </DropdownMenuItem>
      <DropdownMenuItem
        className={chatRowMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          onRename?.();
        }}
      >
        <Pencil className="size-4 shrink-0 text-zinc-800" />
        Rename
      </DropdownMenuItem>
      {showMoveToProject ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className={cn(chatRowMenuItemClass, "data-[state=open]:bg-zinc-100")}
          >
            <Folder className="size-4 shrink-0 text-zinc-800" />
            <span className="flex-1 text-left">Move to project</span>
            <ChevronRight className="ml-auto size-3.5 text-zinc-400" />
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="z-50 min-w-[200px] rounded-xl border border-black/[0.08] bg-white p-1.5 shadow-[0_8px_28px_rgba(26,23,18,0.12)]">
              <DropdownMenuItem asChild>
                <AppHref
                  href={moveToProjectHref}
                  className={chatRowMenuItemClass}
                  onClick={() => {
                    onMoveToProject?.();
                  }}
                >
                  <Plus className="size-4 shrink-0 text-zinc-800" />
                  Start a new project
                </AppHref>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      ) : null}
      <DropdownMenuSeparator className="my-1 bg-zinc-900/10" />
      <DropdownMenuItem
        className={chatRowMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          if (isPinned) {
            onUnpin?.();
          } else {
            onPin?.();
          }
        }}
      >
        {isPinned ? (
          <PinOff className="size-4 shrink-0 text-zinc-800" />
        ) : (
          <Pin className="size-4 shrink-0 text-zinc-800" />
        )}
        {isPinned ? "Unpin chat" : "Pin chat"}
      </DropdownMenuItem>
      <DropdownMenuItem
        className={chatRowMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          onArchive?.();
        }}
      >
        <Archive className="size-4 shrink-0 text-zinc-800" />
        Archive
      </DropdownMenuItem>
      <DropdownMenuItem
        className="ui-menu-row cursor-pointer text-[#8a2424] hover:bg-[#8a2424]/10 focus:bg-[#8a2424]/10"
        onSelect={(event) => {
          event.preventDefault();
          onDelete?.();
        }}
      >
        <Trash2 className="size-4 shrink-0 text-[#8a2424]" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
