"use client";

import {
  FolderPlus,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/frontend/components/ui/dropdown-menu";
import { cn } from "@/frontend/lib/utils";

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-[430] text-zinc-800 transition-colors hover:bg-zinc-100 focus:bg-zinc-100";

type ChatOptionsMenuContentProps = {
  isPinned?: boolean;
  onRename?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onAddToProject?: () => void;
  onDelete?: () => void;
  align?: "start" | "end" | "center";
  className?: string;
};

export function ChatOptionsMenuContent({
  isPinned = false,
  onRename,
  onPin,
  onUnpin,
  onAddToProject,
  onDelete,
  align = "start",
  className,
}: ChatOptionsMenuContentProps) {
  return (
    <DropdownMenuContent
      align={align}
      side="bottom"
      sideOffset={6}
      className={cn(
        "z-50 min-w-[220px] rounded-xl border border-black/[0.08] bg-white p-1.5 text-zinc-800 shadow-[0_8px_28px_rgba(26,23,18,0.12)]",
        className,
      )}
    >
      <DropdownMenuItem
        className={itemClass}
        onSelect={(event) => {
          event.preventDefault();
          onRename?.();
        }}
      >
        <Pencil className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem
        className={itemClass}
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
      <DropdownMenuItem className={itemClass} onSelect={() => onAddToProject?.()}>
        <FolderPlus className="h-[18px] w-[18px] shrink-0 text-zinc-800" />
        Add to project
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-1 bg-zinc-900/10" />
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
