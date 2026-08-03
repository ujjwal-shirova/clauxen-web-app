"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { TypingDots } from "./ui/typing-dots";
import { HintTooltip } from "./ui/hint-tooltip";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";
import { StreamingChatTitle } from "./streaming-chat-title";
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
  /** Desktop artifacts rail owns Artifacts + Share; hide duplicates in header. */
  hideTrailingRailControlsOnDesktop?: boolean;
  suppressArtifactsHover?: boolean;
  /** Show Artifacts icon only when the chat has files / photos / artifacts. */
  hasArtifacts?: boolean;
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
  hideTrailingRailControlsOnDesktop = false,
  suppressArtifactsHover = false,
  hasArtifacts = false,
  headerControlsLoading = false,
}: ChatViewHeaderProps) {
  const isClient = useIsClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const displayTitle = resolveDisplayChatTitle(chatTitle, isTitleStreaming);

  const commitInlineTitle = useCallback(() => {
    const next = editTitleValue.trim();
    setIsEditingTitle(false);
    if (next && next !== displayTitle) {
      onRenameChat?.(next);
    }
  }, [displayTitle, editTitleValue, onRenameChat]);

  useEffect(() => {
    if (!isEditingTitle) return;
    const input = titleInputRef.current;
    input?.focus();
    input?.select();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (titleInputRef.current?.contains(target)) return;
      commitInlineTitle();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [commitInlineTitle, isEditingTitle]);

  const startInlineEdit = () => {
    setEditTitleValue(displayTitle);
    setIsEditingTitle(true);
  };

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
                    { }
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
                  <span className="shrink-0 text-zinc-400" aria-hidden>
                    ›
                  </span>
                </div>
              ) : null}
              {!isClient || headerControlsLoading ? (
                <div className="inline-flex max-w-full items-center rounded-lg border border-transparent">
                  <span className="ui-chrome-text-btn px-2 text-zinc-800">
                    {displayTitle}
                  </span>
                </div>
              ) : (
                <DropdownMenu modal={false}>
                  <div className="inline-flex max-w-full items-stretch overflow-hidden rounded-lg border border-transparent">
                    {isEditingTitle ? (
                      <input
                        ref={titleInputRef}
                        value={editTitleValue}
                        onChange={(event) => setEditTitleValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitInlineTitle();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setIsEditingTitle(false);
                          }
                        }}
                        className="ui-chrome-text-btn w-auto min-w-[4ch] max-w-[min(70vw,420px)] rounded-l-lg border-0 bg-zinc-100 text-zinc-800 outline-none ring-0"
                        style={{ width: `${Math.max(editTitleValue.length, 4)}ch` }}
                        aria-label="Edit chat title"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={startInlineEdit}
                        className="ui-chrome-text-btn w-fit max-w-[min(70vw,420px)] rounded-l-lg text-zinc-800 transition-all hover:bg-zinc-100"
                      >
                        <StreamingChatTitle
                          title={displayTitle}
                          isStreaming={isTitleStreaming}
                          className="w-auto max-w-full whitespace-nowrap"
                        />
                        {isTitleStreaming ? <TypingDots className="ml-1 shrink-0" /> : null}
                      </button>
                    )}
                    <div className="h-5 w-px shrink-0 self-center bg-black/10" />
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Chat options"
                        className="ui-icon-button rounded-r-lg text-zinc-800 transition-all hover:bg-zinc-100 data-[state=open]:bg-black/5"
                      >
                        <ChevronDown className="size-3.5 opacity-70" />
                      </button>
                    </DropdownMenuTrigger>
                  </div>
                  <ChatRowMenuContent
                    align="start"
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
              )}
            </div>

            <div
              className={cn(
                "content-pane-top-bar__trailing-wrap flex shrink-0 items-center gap-1",
                hideTrailingRailControlsOnDesktop && "lg:hidden",
              )}
            >
              {headerControlsLoading ? null : (
                <ChatRightRailControls
                  isArtifactsPanelOpen={isArtifactsPanelOpen}
                  onToggleArtifactsPanel={
                    hasArtifacts ? onToggleArtifactsPanel : undefined
                  }
                  onShareClick={onShareClick}
                  shareClassName="hidden min-[420px]:inline-flex"
                  suppressArtifactsHover={suppressArtifactsHover}
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
          <Check className="size-3.5 shrink-0 text-zinc-900" strokeWidth={2.25} />
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
