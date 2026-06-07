"use client";

import { useState } from "react";
import { ChevronDown, Star, Pencil, FolderPlus, Trash2 } from "lucide-react";
import { OrbCursor } from "./ui/orb-cursor";
import { HintTooltip } from "./ui/hint-tooltip";
import { ChatFrostedEdge } from "./ui/chat-frosted-edge";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { cn } from "@/frontend/lib/utils";
import { isUsableChatTitle } from "@/lib/chat-title";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";

interface ChatViewHeaderProps {
  isConversationStarted: boolean;
  isGenerating?: boolean;
  onUpgradeClick: () => void;
  onShareClick?: () => void;
  onToggleArtifactsPanel?: () => void;
  isArtifactsPanelOpen?: boolean;
  chatTitle?: string;
  isTitleStreaming?: boolean;
  onDeleteChat?: () => void;
  onOpenSettings?: () => void;
  thinkingEnabled?: boolean;
  onThinkingEnabledChange?: (enabled: boolean) => void;
  className?: string;
}

export function ChatViewHeader({
  isConversationStarted,
  isGenerating = false,
  onUpgradeClick,
  onShareClick,
  onToggleArtifactsPanel,
  isArtifactsPanelOpen = false,
  chatTitle = "New Chat",
  isTitleStreaming = false,
  onDeleteChat,
  onOpenSettings,
  className,
}: ChatViewHeaderProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const displayTitle =
    chatTitle?.trim() && (!isTitleStreaming || isUsableChatTitle(chatTitle))
      ? chatTitle.trim()
      : "New Chat";

  if (isConversationStarted) {
    return (
      <>
        <header
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 flex h-11 items-center bg-transparent font-sans md:right-11",
            className,
          )}
        >
          <ChatFrostedEdge placement="top" isStreaming={isGenerating} />
          <div className="pointer-events-auto relative z-10 flex h-full w-full items-center justify-between pl-3 pr-3 sm:pl-4 sm:pr-4 md:pl-5 md:pr-5">
            <div className="flex min-w-0 items-center">
              <DropdownMenu>
                <div className="flex min-w-0 items-center gap-0">
                  <button
                    type="button"
                    className="flex h-7 min-w-0 max-w-[min(280px,50vw)] items-center rounded-l-lg px-2 text-[13px] font-medium text-zinc-800 transition-all hover:bg-zinc-100"
                  >
                    <span className="truncate">{displayTitle}</span>
                    {isTitleStreaming ? <OrbCursor /> : null}
                  </button>
                  <div className="h-7 w-px shrink-0 bg-black/10" />
                  <DropdownMenuTrigger asChild>
                    <HintTooltip content="Chat options">
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-r-lg text-zinc-800 transition-all hover:bg-zinc-100 data-[state=open]:bg-black/5"
                      >
                        <ChevronDown className="icon-md opacity-70" />
                      </button>
                    </HintTooltip>
                  </DropdownMenuTrigger>
                </div>
                <DropdownMenuContent
                  align="start"
                  side="bottom"
                  className="min-w-[170px] rounded-xl border border-zinc-200 bg-white/95 p-1.5 text-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xl"
                >
                  <DropdownMenuItem className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] transition-colors hover:bg-zinc-100 focus:bg-black/5">
                    <Star className="icon-md mr-2" />
                    Star
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] transition-colors hover:bg-zinc-100 focus:bg-black/5">
                    <Pencil className="icon-md mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] transition-colors hover:bg-zinc-100 focus:bg-black/5">
                    <FolderPlus className="icon-md mr-2" />
                    Add to project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-zinc-100" />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] text-red-700 transition-colors hover:bg-red-50 focus:bg-red-50"
                    onSelect={(event) => {
                      event.preventDefault();
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="icon-md mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <HintTooltip content="Artifacts">
                <button
                  type="button"
                  onClick={onToggleArtifactsPanel}
                  aria-label="Toggle artifacts panel"
                  aria-pressed={isArtifactsPanelOpen}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-800 transition-all hover:bg-zinc-100 data-[state=open]:bg-black/[0.06]"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M11.586 2a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V16.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.492-1.347L4 16.5v-13A1.5 1.5 0 0 1 5.5 2zM5.5 3a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V7h-2.5A1.5 1.5 0 0 1 11 5.5V3zm7.04 10.304a.5.5 0 0 1 .92.392c-.295.69-.871 1.304-1.66 1.304-.487 0-.892-.234-1.2-.574-.309.34-.713.574-1.2.574-.486 0-.892-.233-1.2-.574-.31.34-.714.574-1.2.574a.5.5 0 0 1 0-1c.212 0 .52-.18.74-.696l.034-.067a.5.5 0 0 1 .886.067c.221.516.528.696.74.696.213 0 .52-.18.74-.696l.035-.067a.5.5 0 0 1 .885.067c.22.516.527.696.74.696s.519-.18.74-.696m0-4a.5.5 0 0 1 .92.392c-.295.69-.871 1.304-1.66 1.304-.487 0-.892-.234-1.2-.574-.309.34-.713.574-1.2.574-.486 0-.892-.233-1.2-.574-.31.34-.714.574-1.2.574a.5.5 0 0 1 0-1c.212 0 .52-.18.74-.696l.034-.067a.5.5 0 0 1 .886.067c.221.516.528.696.74.696.213 0 .52-.18.74-.696l.035-.067a.5.5 0 0 1 .885.067c.22.516.527.696.74.696s.519-.18.74-.696M12 5.5a.5.5 0 0 0 .5.5h2.293L12 3.207z" />
                  </svg>
                </button>
              </HintTooltip>
              <HintTooltip content="Share chat">
                <button
                  type="button"
                  onClick={onShareClick}
                  className="hidden h-8 min-w-[58px] items-center justify-center rounded-md border border-zinc-300 bg-transparent px-2.5 text-[12px] font-medium text-zinc-800 transition-all hover:bg-zinc-100 min-[420px]:flex"
                >
                  Share
                </button>
              </HintTooltip>
            </div>
          </div>
        </header>

        <DeleteChatDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          chatTitle={chatTitle}
          onConfirm={() => onDeleteChat?.()}
          onOpenSettings={onOpenSettings}
        />
      </>
    );
  }

  return (
    <div className="relative sticky top-0 z-20 flex h-11 w-full shrink-0 items-center justify-center bg-transparent px-3 font-sans sm:h-12 sm:px-5">
      <ChatFrostedEdge
        placement="top"
        isStreaming={isGenerating}
        className="h-12 sm:h-14"
      />
      <HintTooltip content="Free plan · Upgrade">
        <button
          type="button"
          onClick={onUpgradeClick}
          className="relative z-10 inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-transparent px-4 text-[14px] text-zinc-500 transition-colors hover:bg-black/[0.03] hover:text-zinc-800"
          aria-label="Free plan — upgrade"
        >
          <span>Free plan</span>
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <span className="underline decoration-zinc-400 underline-offset-[3px]">
            Upgrade
          </span>
        </button>
      </HintTooltip>
    </div>
  );
}
