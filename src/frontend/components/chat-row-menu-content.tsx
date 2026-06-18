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
} from "@/frontend/components/ui/dropdown-menu";
import { cn } from "@/frontend/lib/utils";

export const chatRowMenuItemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-[430] text-zinc-800 transition-colors hover:bg-zinc-100 focus:bg-zinc-100";

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
  onMoveToProject?: () => void;
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
        <Share className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
        Share
      </DropdownMenuItem>
      <DropdownMenuItem
        className={chatRowMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          onStartGroupChat?.();
        }}
      >
        <UserPlus className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
        Start a group chat
      </DropdownMenuItem>
      <DropdownMenuItem
        className={chatRowMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          onRename?.();
        }}
      >
        <Pencil className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
        Rename
      </DropdownMenuItem>
      {showMoveToProject ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className={cn(chatRowMenuItemClass, "data-[state=open]:bg-zinc-100")}
          >
            <Folder className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
            <span className="flex-1 text-left">Move to project</span>
            <ChevronRight className="ml-auto h-4 w-4 text-zinc-400" />
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="z-50 min-w-[200px] rounded-xl border border-black/[0.08] bg-white p-1.5 shadow-[0_8px_28px_rgba(26,23,18,0.12)]">
              <DropdownMenuItem
                className={chatRowMenuItemClass}
                onSelect={(event) => {
                  event.preventDefault();
                  onMoveToProject?.();
                }}
              >
                <Plus className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
                Start a new project
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
          <PinOff className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
        ) : (
          <Pin className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
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
        <Archive className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
        Archive
      </DropdownMenuItem>
      <DropdownMenuItem
        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-[430] text-[#8a2424] transition-colors hover:bg-[#8a2424]/10 focus:bg-[#8a2424]/10"
        onSelect={(event) => {
          event.preventDefault();
          onDelete?.();
        }}
      >
        <Trash2 className="h-[18px] w-[18px] shrink-0 text-[#8a2424]" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
