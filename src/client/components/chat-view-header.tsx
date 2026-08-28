"use client";

import { useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { Check, ChevronDown, MoreHorizontal, Sparkles } from "lucide-react";
import { HintTooltip } from "./ui/hint-tooltip";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { ChatRightRailControls } from "./chat-right-rail-controls";
import { GhostChatIcon } from "./icons";
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
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  /** Opens the Incognito chat surface from the new-chat header ghost button. */
  onOpenIncognito?: () => void;
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
  onOpenMobileNav,
  showMobileMenu = false,
  onOpenIncognito,
  className,
  projectBreadcrumb,
  headerControlsLoading = false,
}: ChatViewHeaderProps) {
  const isClient = useIsClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);

  const displayTitle = resolveDisplayChatTitle(chatTitle, isTitleStreaming);

  if (isConversationStarted) {
    return (
      <>
        <header
          className={cn(
            "content-pane-top-bar pointer-events-none absolute inset-x-0 top-0 flex items-center bg-[var(--chat-canvas-bg,#f2f3f6)] font-sans",
            className,
          )}
        >
          <div className="pointer-events-auto flex h-full w-full min-w-0 items-center gap-2 px-3 sm:gap-2.5 sm:px-4">
            {showMobileMenu && onOpenMobileNav ? (
              <MobileMenuButton
                onClick={onOpenMobileNav}
                aria-controls="app-primary-nav"
              />
            ) : null}
            <div className="flex min-w-0 flex-1 items-center overflow-hidden">
              {projectBreadcrumb ? (
                <div className="mr-1 flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-zinc-800">
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
            </div>

            <div className="content-pane-top-bar__trailing-wrap flex shrink-0 items-center gap-1">
              {headerControlsLoading ? null : (
                <ChatRightRailControls
                  isArtifactsPanelOpen={isArtifactsPanelOpen}
                  onToggleArtifactsPanel={onToggleArtifactsPanel}
                  onShareClick={onShareClick}
                  menu={
                    isClient ? (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Chat options"
                            className="ui-icon-button rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 data-[state=open]:bg-zinc-100"
                          >
                            <MoreHorizontal
                              className="size-[18px]"
                              strokeWidth={1.8}
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <ChatRowMenuContent
                          align="end"
                          side="bottom"
                          className="z-[100]"
                          isPinned={isChatPinned}
                          onShare={onShareClick}
                          onRename={() => setRenameDialogOpen(true)}
                          onMoveToProject={onMoveToProject}
                          onPin={onPinChat}
                          onUnpin={onUnpinChat}
                          onDelete={() => setDeleteDialogOpen(true)}
                        />
                      </DropdownMenu>
                    ) : null
                  }
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

  // Header chrome uses shared ui-chrome-text-btn / ui-icon-button tokens.
  const modelSwitcher = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ui-chrome-text-btn text-zinc-800 transition-colors hover:bg-zinc-100 data-[state=open]:bg-black/5"
          aria-label="Choose Clauxen plan"
        >
          <span>Clauxen</span>
          <ChevronDown className="size-3.5 opacity-70" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="z-[100] w-[min(calc(100vw-2rem),280px)] rounded-[14px] border-zinc-200/90 p-1 shadow-[0_12px_32px_-14px_rgba(24,24,27,0.3)]"
      >
        <button
          type="button"
          onClick={onUpgradeClick}
          className="flex w-full items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-zinc-50"
        >
          <span className="ui-nav-icon text-zinc-800">
            <Sparkles className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-zinc-900">
              Clauxen Plus
            </span>
            <span className="block text-[12px] text-zinc-500">
              Our smartest model & more
            </span>
          </span>
          <span className="inline-flex h-[34px] shrink-0 items-center rounded-full border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-800">
            Upgrade
          </span>
        </button>
        <div className="flex w-full items-center gap-1.5 rounded-[10px] px-2 py-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[9px] font-semibold text-zinc-700">
            C
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-zinc-900">
              Clauxen
            </span>
            <span className="block text-[12px] text-zinc-500">
              Great for everyday tasks
            </span>
          </span>
          <Check
            className="size-3.5 shrink-0 text-zinc-900"
            strokeWidth={2.25}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const upgradeButton = (
    <button
      type="button"
      onClick={onUpgradeClick}
      className="ui-chrome-text-btn text-[#2f6fed] transition-colors hover:bg-[#2f6fed]/08 active:bg-[#2f6fed]/12"
      aria-label="Upgrade plan"
    >
      <Sparkles className="size-3.5 shrink-0" strokeWidth={1.75} />
      <span>Upgrade</span>
    </button>
  );

  const ghostButton = (
    <HintTooltip content="Incognito" side="bottom" align="end" sideOffset={8}>
      <button
        type="button"
        onClick={() => onOpenIncognito?.()}
        aria-label="Incognito"
        className="ui-icon-button text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
      >
        <GhostChatIcon className="size-3.5" />
      </button>
    </HintTooltip>
  );

  return (
    <div
      className={cn(
        "content-pane-top-bar relative sticky top-0 z-20 flex w-full shrink-0 items-center justify-between gap-1 overflow-visible bg-[var(--app-panel-bg)] px-3 font-sans sm:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-0.5">
        {showMobileMenu && onOpenMobileNav ? (
          <MobileMenuButton
            onClick={onOpenMobileNav}
            aria-controls="app-primary-nav"
          />
        ) : null}
        {modelSwitcher}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {upgradeButton}
        {ghostButton}
      </div>
    </div>
  );
}
