"use client";

import { useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { ChevronDown, Files, HatGlasses, MoreHorizontal, Share } from "lucide-react";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { cn } from "@/lib/utils";
import { resolveDisplayChatTitle } from "@/lib/chat-title";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppHref } from "@/components/app-href";
import { APP_ROUTES } from "@/lib/app-routes";
import { MobileMenuButton } from "@/components/mobile-menu-button";
import { HintTooltip } from "@/components/ui/hint-tooltip";

interface ChatViewHeaderProps {
  isConversationStarted: boolean;
  isGenerating?: boolean;
  onUpgradeClick: () => void;
  onShareClick?: () => void;
  showArtifacts?: boolean;
  onOpenArtifacts?: () => void;
  chatTitle?: string;
  projectCrumb?: { id: string; name: string } | null;
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
  composerMode?: "chat" | "cowork";
  onComposerModeChange?: (mode: "chat" | "cowork") => void;
}

export function ChatViewHeader({
  isConversationStarted,
  isGenerating: _isGenerating = false,
  onUpgradeClick,
  onShareClick,
  showArtifacts = false,
  onOpenArtifacts,
  chatTitle = "New Chat",
  projectCrumb = null,
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
  composerMode = "chat",
  onComposerModeChange,
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
            <div className="content-pane-title-cluster flex h-full min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
              {projectCrumb ? (
                <AppHref
                  href={APP_ROUTES.project(projectCrumb.id)}
                  className="min-w-0 max-w-[10rem] truncate px-1 text-[14px] font-medium text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]"
                >
                  {projectCrumb.name}
                </AppHref>
              ) : null}
              {projectCrumb ? (
                <span className="shrink-0 text-[14px] text-[var(--ui-fg-subtle)]">/</span>
              ) : null}
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
                  {showArtifacts && onOpenArtifacts ? (
                    <button
                      type="button"
                      onClick={onOpenArtifacts}
                      aria-label="Artifacts"
                      className="ui-icon-button shrink-0 rounded-lg text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <Files className="size-[17px]" strokeWidth={1.8} />
                    </button>
                  ) : null}
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
      <div className="relative flex h-full w-full min-w-0 items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-1">
          {showMobileMenu && onOpenMobileNav ? (
            <MobileMenuButton
              onClick={onOpenMobileNav}
              aria-controls="app-primary-nav"
              className="-ml-0.5 shrink-0"
            />
          ) : null}
        </div>

        {/* Center: Upgrade your plan pill */}
        <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={onUpgradeClick}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-blue-50/90 dark:bg-blue-950/40 px-3.5 text-[12px] font-medium text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-2xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-400 select-none"
          >
            <span className="text-[13px] leading-none">🎵</span>
            <span>Upgrade your plan</span>
          </button>
        </div>

        {/* Right Corner: Incognito Mode button */}
        <div className="ml-auto flex items-center gap-2">
          {showFreePlanUpgrade ? (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="free-plan-upgrade hidden md:inline-flex pointer-events-auto outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            >
              Free plan <span aria-hidden>·</span>{" "}
              <span className="free-plan-upgrade__action">Upgrade</span>
            </button>
          ) : null}
          <HintTooltip content="Incognito Mode" side="bottom">
            <AppHref
              href="/incognito"
              aria-label="Incognito Mode"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <HatGlasses className="size-5 shrink-0" strokeWidth={1.8} />
            </AppHref>
          </HintTooltip>
        </div>
      </div>
    </header>
  );
}
