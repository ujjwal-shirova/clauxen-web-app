"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { useAuth } from "@/hooks/use-auth";
import { useOptionalAuthGate } from "@/contexts/auth-gate-context";
import { Download } from "@/components/icons/app-icons";
import { ChevronDown, Files, MoreHorizontal, Share } from "@/components/ui/bootstrap-icon";
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
}: ChatViewHeaderProps) {
  const isClient = useIsClient();
  const router = useRouter();
  const auth = useAuth();
  const authGate = useOptionalAuthGate();
  const isGuest = isClient && !auth.loading && !auth.user;
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
      <div className="relative flex h-full w-full min-w-0 items-center justify-between px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          {showMobileMenu && onOpenMobileNav ? (
            <MobileMenuButton
              onClick={onOpenMobileNav}
              aria-controls="app-primary-nav"
              className="-ml-0.5 shrink-0"
            />
          ) : null}
        </div>

        {/* Center: Upgrade your plan */}
        <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {showFreePlanUpgrade ? (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="landing-upgrade-pill outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            >
              Upgrade your plan
            </button>
          ) : null}
        </div>

        {/* Guests get the two account CTAs instead of a plan upsell. */}
        {isGuest ? (
          <div className="pointer-events-auto relative z-10 ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => authGate?.openAuthGate()}
              className="inline-flex h-9 items-center rounded-lg bg-[#f4f4f5] px-3.5 text-[13px] font-medium text-[#18181b] transition-colors hover:bg-[#e9e9ec] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:outline-none dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => router.push("/download")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#18181b] pl-3 pr-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:outline-none dark:bg-[#f4f4f5] dark:text-[#18181b] dark:hover:bg-[#e4e4e7]"
            >
              <Download className="shrink-0 text-[15px]" />
              <span className="max-[520px]:hidden">Download for Desktop</span>
            </button>
          </div>
        ) : null}

      </div>
    </header>
  );
}
