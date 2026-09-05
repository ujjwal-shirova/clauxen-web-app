"use client";

import type { MouseEventHandler } from "react";
import {
  Archive,
  Check,
  ChevronRight,
  Folder,
  FolderMinus,
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
import type { ApiProject } from "@/lib/api/projects";
import { ProjectAvatar } from "@/components/projects/project-avatar";

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
  onMoveChatToProject?: (projectId: string | null) => void;
  projects?: ApiProject[];
  currentProjectId?: string | null;
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
  moveToProjectHref = APP_ROUTES.projectNew,
  onMoveChatToProject,
  projects = [],
  currentProjectId = null,
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
            <DropdownMenuSubContent className="z-50 max-h-72 w-[240px] overflow-y-auto">
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
              {projects.length > 0 ? (
                <DropdownMenuSeparator className="my-1 bg-zinc-900/10" />
              ) : null}
              {projects.map((project) => {
                const selected = currentProjectId === project.id;
                return (
                  <DropdownMenuItem
                    key={project.id}
                    className={chatRowMenuItemClass}
                    onSelect={(event) => {
                      event.preventDefault();
                      if (selected) return;
                      onMoveChatToProject?.(project.id);
                    }}
                  >
                    <ProjectAvatar
                      icon={project.icon}
                      color={project.color}
                      size="sm"
                      className="h-5 w-5 text-[11px]"
                    />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {selected ? (
                      <Check className="size-3.5 shrink-0 text-zinc-700" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
              {currentProjectId ? (
                <>
                  <DropdownMenuSeparator className="my-1 bg-zinc-900/10" />
                  <DropdownMenuItem
                    className={chatRowMenuItemClass}
                    onSelect={(event) => {
                      event.preventDefault();
                      onMoveChatToProject?.(null);
                    }}
                  >
                    <FolderMinus className="size-4 shrink-0 text-zinc-800" />
                    Remove from project
                  </DropdownMenuItem>
                </>
              ) : null}
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
