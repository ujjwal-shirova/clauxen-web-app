"use client";

import { useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { ChevronDown, MoreHorizontal, Share } from "lucide-react";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { ChatRightRailControls } from "./chat-right-rail-controls";
import { cn } from "@/lib/utils";
import { resolveDisplayChatTitle } from "@/lib/chat-title";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileMenuButton } from "@/components/mobile-menu-button";

interface ChatViewHeaderProps {
  isConversationStarted: boolean;
  isGenerating?: boolean;
  onUpgradeClick: () => void;
  onShareClick?: () => void;
  onToggleArtifactsPanel?: () => void;
  isArtifactsPanelOpen?: boolean;
  chatTitle?: string;
  isTitleStreaming?: boolean;
  isChatPinned?: boolean;
  onRenameChat?: (newTitle: string) => void;
  onPinChat?: () => void;
  onUnpinChat?: () => void;
  onDeleteChat?: () => void;
  onOpenSettings?: () => void;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  /** Show the centered free-plan upgrade prompt on the new-chat surface. */
  showFreePlanUpgrade?: boolean;
  className?: string;
  /** Hide interactive header controls until the chat id exists on the server (no shimmer). */
  headerControlsLoading?: boolean;
}

export function ChatViewHeader({
  isConversationStarted,
  isGenerating: _isGenerating = false,
  onUpgradeClick,
  onShareClick,
  onToggleArtifactsPanel,
  isArtifactsPanelOpen = false,
  chatTitle = "New Chat",
  isTitleStreaming = false,
  isChatPinned = false,
  onRenameChat,
  onPinChat,
  onUnpinChat,
  onDeleteChat,
  onOpenSettings,
  onOpenMobileNav,
  showMobileMenu = false,
  showFreePlanUpgrade = false,
  className,
  headerControlsLoading = false,
}: ChatViewHeaderProps) {
  const isClient = useIsClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);

  const displayTitle = resolveDisplayChatTitle(chatTitle, isTitleStreaming);
  const chatOptionsMenu = isClient ? (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Chat options"
          className="ui-icon-button shrink-0 rounded-lg text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] data-[state=open]:bg-[var(--ui-hover-wash)] data-[state=open]:text-[var(--ui-fg)]"
        >
          <MoreHorizontal className="size-[18px]" strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <ChatRowMenuContent
        align="start"
        side="bottom"
        className="z-[100]"
        isPinned={isChatPinned}
        onShare={onShareClick}
        onRename={() => setRenameDialogOpen(true)}
        onPin={onPinChat}
        onUnpin={onUnpinChat}
        onDelete={() => setDeleteDialogOpen(true)}
      />
    </DropdownMenu>
  ) : null;

  if (isConversationStarted) {
    return (
      <>
        <header
          className={cn(
            "content-pane-top-bar pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center bg-[var(--app-panel-bg,#fcfcfb)] font-sans",
            className,
          )}
        >
          <div className="pointer-events-auto flex h-full w-full min-w-0 items-center gap-0.5 px-2 sm:gap-1 sm:px-2">
            {showMobileMenu && onOpenMobileNav ? (
              <MobileMenuButton
                onClick={onOpenMobileNav}
                aria-controls="app-primary-nav"
                className="-ml-0.5 shrink-0"
              />
            ) : null}
            <div className="flex h-full min-w-0 flex-1 flex-nowrap items-center gap-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setRenameDialogOpen(true)}
                className="ui-chrome-text-btn group/title min-w-0 max-w-[min(52vw,20rem)] flex-none gap-1 overflow-hidden bg-transparent px-1 text-[14px] font-medium text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)] sm:max-w-[min(42vw,22rem)] sm:gap-1 sm:px-1.5"
                aria-label={`${displayTitle}, rename chat`}
              >
                <span className="truncate whitespace-nowrap">{displayTitle}</span>
                <ChevronDown
                  className="size-3.5 shrink-0 text-[var(--ui-fg-muted)] transition-transform group-hover/title:text-[var(--ui-fg)]"
                  strokeWidth={1.7}
                  aria-hidden
                />
              </button>
              {!headerControlsLoading ? chatOptionsMenu : null}
            </div>

            <div className="content-pane-top-bar__trailing-wrap ml-auto flex h-full shrink-0 items-center gap-1">
              {headerControlsLoading ? null : (
                <>
                  {onShareClick ? (
                    <button
                      type="button"
                      onClick={onShareClick}
                      aria-label="Share chat"
                      className="ui-icon-button shrink-0 rounded-lg text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] max-[400px]:hidden"
                    >
                      <Share className="size-[17px]" strokeWidth={1.8} />
                    </button>
                  ) : null}
                  <ChatRightRailControls
                    isArtifactsPanelOpen={isArtifactsPanelOpen}
                    onToggleArtifactsPanel={onToggleArtifactsPanel}
                    menu={undefined}
                  />
                </>
              )}
            </div>
          </div>
        </header>

        <DeleteChatDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          chatTitle={displayTitle}
          onConfirm={() => onDeleteChat?.()}
          onOpenSettings={onOpenSettings}
        />
        <RenameChatDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          chatTitle={displayTitle}
          onConfirm={(nextTitle) => onRenameChat?.(nextTitle)}
        />
      </>
    );
  }

  return (
    <header
      className={cn(
        "content-pane-top-bar content-pane-top-bar--landing relative sticky top-0 z-20 flex w-full shrink-0 items-center overflow-visible bg-transparent font-sans",
        className,
      )}
    >
      <div className="flex h-full w-full min-w-0 items-center gap-1 px-2 sm:gap-2.5 sm:px-4">
        {showMobileMenu && onOpenMobileNav ? (
          <MobileMenuButton
            onClick={onOpenMobileNav}
            aria-controls="app-primary-nav"
            className="-ml-0.5 shrink-0"
          />
        ) : null}
        {showFreePlanUpgrade ? (
          <div className="pointer-events-none absolute inset-x-12 top-1/2 flex h-8 -translate-y-1/2 select-none items-center justify-center sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
            <div className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-lg bg-[var(--ui-muted-surface)] px-2 pr-2.5 text-center text-[13px] font-normal leading-5 text-[var(--ui-fg-muted)] sm:text-[14px]">
              <button
                type="button"
                onClick={onUpgradeClick}
                className="rounded-sm text-[var(--link)] underline decoration-[var(--link-decoration)] underline-offset-[3px] outline-none transition-[color,text-decoration-color,box-shadow] duration-[60ms] hover:text-[var(--link-hover)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
