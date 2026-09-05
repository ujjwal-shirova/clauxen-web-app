"use client";

import { MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { RecentChat } from "@/lib/types";
import { StreamingChatTitle } from "@/components/streaming-chat-title";
import { TypingDots } from "@/components/ui/typing-dots";
import { ChatRowMenuContent } from "@/components/chat-row-menu-content";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProjectChatListRowProps = {
  chat: RecentChat;
  active?: boolean;
  onOpen: () => void;
  onRename: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onDelete: () => void;
  onShare?: () => void;
  className?: string;
  showMenu?: boolean;
};

export function ProjectChatListRow({
  chat,
  active = false,
  onOpen,
  onRename,
  onPin,
  onUnpin,
  onDelete,
  onShare,
  className,
  showMenu = true,
}: ProjectChatListRowProps) {
  const title = chat.name || "New Chat";

  return (
    <div
      className={cn(
        "group/project-chat relative flex min-h-[56px] items-stretch border-b border-zinc-100 last:border-b-0",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center px-1 py-3.5 text-left transition-colors sm:px-0",
          "hover:bg-zinc-50/80 active:bg-zinc-50",
          active && "bg-zinc-50",
        )}
      >
        <span className="flex items-center gap-1 text-[14px] font-medium leading-5 text-zinc-900">
          <StreamingChatTitle
            title={title}
            isStreaming={!!chat.isTitleStreaming}
          />
          {chat.isTitleStreaming ? <TypingDots className="ml-1" /> : null}
        </span>
        <span className="mt-0.5 text-[12px] leading-4 text-zinc-500">
          Last message{" "}
          {chat.updatedAt
            ? formatDistanceToNow(chat.updatedAt, { addSuffix: true })
            : "just now"}
        </span>
      </button>

      {showMenu ? (
        <div className="flex shrink-0 items-center pr-1 sm:pr-0">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Options for ${title}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "ui-row-icon-button text-zinc-500",
                "opacity-0 group-hover/project-chat:opacity-100",
                "data-[state=open]:bg-zinc-100 data-[state=open]:opacity-100",
                "max-lg:opacity-100",
              )}
            >
              <MoreVertical className="size-4" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <ChatRowMenuContent
            align="end"
            side="bottom"
            isPinned={!!chat.pinned}
            showMoveToProject={false}
            onShare={onShare}
            onRename={onRename}
            onPin={onPin}
            onUnpin={onUnpin}
            onDelete={onDelete}
            onClick={(e) => e.stopPropagation()}
          />
        </DropdownMenu>
      </div>
      ) : null}
    </div>
  );
}
