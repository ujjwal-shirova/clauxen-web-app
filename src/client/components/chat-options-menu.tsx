"use client";

import {
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const itemClass = "ui-menu-row cursor-pointer";

type ChatOptionsMenuContentProps = {
  isPinned?: boolean;
  onRename?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onDelete?: () => void;
  align?: "start" | "end" | "center";
  className?: string;
};

export function ChatOptionsMenuContent({
  isPinned = false,
  onRename,
  onPin,
  onUnpin,
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
        "z-50 min-w-[220px] rounded-xl border border-[var(--popup-border)] bg-[var(--popup-bg)] p-1.5 text-[var(--ui-fg)] shadow-[var(--popup-shadow)]",
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
        <Pencil className="size-4 shrink-0 text-[var(--ui-fg-muted)]" />
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
          <PinOff className="size-4 shrink-0 text-[var(--ui-fg-muted)]" />
        ) : (
          <Pin className="size-4 shrink-0 text-[var(--ui-fg-muted)]" />
        )}
        {isPinned ? "Unpin chat" : "Pin chat"}
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-1 bg-[var(--ui-border-subtle)]" />
      <DropdownMenuItem
        className="ui-menu-row cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
        onSelect={(event) => {
          event.preventDefault();
          onDelete?.();
        }}
      >
        <Trash2 className="size-4 shrink-0 text-red-600 dark:text-red-400" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
