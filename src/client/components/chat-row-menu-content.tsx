"use client";

import type { MouseEventHandler } from "react";
import {
  Archive,
  Pencil,
  Pin,
  PinOff,
  Share,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  onPin?: () => void;
  onUnpin?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
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
  onPin,
  onUnpin,
  onArchive,
  onDelete,
}: ChatRowMenuContentProps) {
  return (
    <DropdownMenuContent
      align={align}
      side={side}
      sideOffset={sideOffset}
      onClick={onClick}
      className={cn(
        "z-50 w-[240px] text-zinc-800",
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
