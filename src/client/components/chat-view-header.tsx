"use client";

import { useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { ChevronDown, MoreHorizontal } from "lucide-react";
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
import { AppHref } from "@/components/app-href";

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
  onMoveToProject?: () => void;
  onMoveChatToProject?: (projectId: string | null) => void;
  projects?: import("@/lib/api/projects").ApiProject[];
  currentProjectId?: string | null;
  moveToProjectHref?: string;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  /** Show the centered free-plan upgrade prompt on the new-chat surface. */
  showFreePlanUpgrade?: boolean;
  className?: string;
  projectBreadcrumb?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
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
  onMoveToProject,
  onMoveChatToProject,
  projects,
  currentProjectId,
  moveToProjectHref,
  onOpenMobileNav,
  showMobileMenu = false,
  showFreePlanUpgrade = false,
  className,
  projectBreadcrumb,
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
          className="ui-icon-button rounded-lg text-zinc-600 transition-colors hover:bg-black/[0.045] hover:text-zinc-900 data-[state=open]:bg-black/[0.055]"
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
        onMoveToProject={onMoveToProject}
        onMoveChatToProject={onMoveChatToProject}
        projects={projects}
        currentProjectId={currentProjectId}
        moveToProjectHref={moveToProjectHref}
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
            "content-pane-top-bar pointer-events-none absolute inset-x-0 top-0 flex items-center bg-[var(--chat-canvas-bg,#f2f3f6)] font-sans",
            className,
          )}
        >
          <div className="pointer-events-auto flex h-full w-full min-w-0 items-center gap-1 px-1 sm:gap-2.5 sm:px-4">
            {showMobileMenu && onOpenMobileNav ? (
              <MobileMenuButton
                onClick={onOpenMobileNav}
                aria-controls="app-primary-nav"
                className="-ml-0.5 shrink-0"
              />
            ) : null}
            <div className="flex min-w-0 flex-1 items-center overflow-hidden">
              {projectBreadcrumb ? (
                <div className="mr-1 hidden min-w-0 items-center gap-1.5 text-[13px] font-medium text-zinc-800 sm:flex">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2f6fed]"
                    aria-hidden
                  >
                    {}
                    <img
                      src="/assets/icons/clauxen-icon.png"
                      alt=""
                      className="h-5 w-5 object-cover"
                    />
                  </span>
                  {projectBreadcrumb.href ? (
                    <AppHref
                      href={projectBreadcrumb.href}
                      onClick={projectBreadcrumb.onClick}
                      className="max-w-[min(28vw,180px)] truncate transition-colors hover:text-zinc-950"
                    >
                      {projectBreadcrumb.label}
                    </AppHref>
                  ) : (
                    <button
                      type="button"
                      onClick={projectBreadcrumb.onClick}
                      className="max-w-[min(28vw,180px)] truncate transition-colors hover:text-zinc-950"
                    >
                      {projectBreadcrumb.label}
                    </button>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setRenameDialogOpen(true)}
                className="ui-chrome-text-btn group/title min-w-0 max-w-[min(48vw,12.5rem)] gap-1 bg-transparent px-1.5 text-[#52514e] hover:bg-black/[0.045] hover:text-zinc-950 sm:max-w-[min(52vw,34rem)] sm:gap-1.5 sm:px-2"
                aria-label={`${displayTitle}, rename chat`}
              >
                <span className="truncate">{displayTitle}</span>
                <ChevronDown
                  className="size-3.5 shrink-0 text-[#898781] transition-transform group-hover/title:text-[#52514e]"
                  strokeWidth={1.7}
                  aria-hidden
                />
              </button>
              {!headerControlsLoading ? chatOptionsMenu : null}
            </div>

            <div className="content-pane-top-bar__trailing-wrap ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
              {headerControlsLoading ? null : (
                <ChatRightRailControls
                  isArtifactsPanelOpen={isArtifactsPanelOpen}
                  onToggleArtifactsPanel={onToggleArtifactsPanel}
                  menu={undefined}
                />
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
        "content-pane-top-bar relative sticky top-0 z-20 flex w-full shrink-0 items-center overflow-visible bg-[var(--app-panel-bg)] font-sans",
        className,
      )}
    >
      <div className="flex h-full w-full min-w-0 items-center gap-1 px-1 sm:gap-2.5 sm:px-4">
        {showMobileMenu && onOpenMobileNav ? (
          <MobileMenuButton
            onClick={onOpenMobileNav}
            aria-controls="app-primary-nav"
            className="-ml-0.5 shrink-0"
          />
        ) : null}
        {showFreePlanUpgrade ? (
          <div className="pointer-events-none absolute inset-x-12 top-1/2 flex h-8 -translate-y-1/2 select-none items-center justify-center sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
            <div className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-lg bg-[#f6f6f4] px-2 pr-2.5 text-center text-[13px] font-normal leading-5 text-[#898781] sm:text-[14px]">
              <span>Free plan</span>
              <span
                className="mt-0.5 h-[3px] w-[3px] shrink-0 rounded-full bg-[rgba(137,135,129,0.3)]"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={onUpgradeClick}
                className="rounded-sm text-[#184f95] underline decoration-[rgba(24,79,149,0.4)] underline-offset-[3px] outline-none transition-[color,text-decoration-color,box-shadow] duration-[60ms] hover:text-[#123f79] hover:decoration-[#184f95] focus-visible:ring-2 focus-visible:ring-[#256abf]/40"
              >
                Upgrade
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
