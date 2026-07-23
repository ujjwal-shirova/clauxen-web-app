"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsClient } from "@/frontend/hooks/use-is-client";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { TypingDots } from "./ui/typing-dots";
import { HintTooltip } from "./ui/hint-tooltip";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";
import { StreamingChatTitle } from "./streaming-chat-title";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { ChatRightRailControls } from "./chat-right-rail-controls";
import { GhostChatIcon } from "./icons";
import { cn } from "@/frontend/lib/utils";
import { resolveDisplayChatTitle } from "@/lib/chat-title";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { MobileMenuButton } from "@/frontend/components/mobile-menu-button";

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
  /** Temporary / ghost chat toggle (new-chat header). */
  temporaryChat?: boolean;
  onTemporaryChatChange?: (enabled: boolean) => void;
  className?: string;
  projectBreadcrumb?: {
    label: string;
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
  temporaryChat = false,
  onTemporaryChatChange,
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
            "content-pane-top-bar pointer-events-none absolute inset-x-0 top-0 flex h-[35px] items-center bg-white font-sans",
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
                <div className="mr-1 flex min-w-0 items-center gap-1 text-[13px] font-medium text-zinc-500">
                  <button
                    type="button"
                    onClick={projectBreadcrumb.onClick}
                    className="max-w-[min(28vw,180px)] truncate transition-colors hover:text-zinc-800"
                  >
                    {projectBreadcrumb.label}
                  </button>
                  <span className="shrink-0 text-zinc-400">/</span>
                </div>
              ) : null}
              {!isClient || headerControlsLoading ? (
                <div className="inline-flex max-w-full items-center rounded-lg border border-transparent">
                  <span className="px-1.5 py-1 text-[13px] font-medium text-zinc-800 sm:px-2">
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
                        className="h-7 w-auto min-w-[4ch] max-w-[min(70vw,420px)] rounded-l-lg border-0 bg-zinc-100 px-1.5 text-[13px] font-medium text-zinc-800 outline-none ring-0 sm:px-2"
                        style={{ width: `${Math.max(editTitleValue.length, 4)}ch` }}
                        aria-label="Edit chat title"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={startInlineEdit}
                        className="inline-flex h-7 w-fit max-w-[min(70vw,420px)] items-center gap-1 rounded-l-lg px-1.5 text-[13px] font-medium text-zinc-800 transition-all hover:bg-zinc-100 sm:px-2"
                      >
                        <StreamingChatTitle
                          title={displayTitle}
                          isStreaming={isTitleStreaming}
                          className="min-w-0"
                        />
                        {isTitleStreaming ? <TypingDots className="ml-1 shrink-0" /> : null}
                      </button>
                    )}
                    <div className="h-7 w-px shrink-0 self-center bg-black/10" />
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Chat options"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-r-lg text-zinc-800 transition-all hover:bg-zinc-100 data-[state=open]:bg-black/5"
                      >
                        <ChevronDown className="icon-md opacity-70" />
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

  const modelSwitcher = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-0.5 rounded-lg px-1.5 text-[13px] font-semibold tracking-[-0.01em] text-zinc-900 transition-colors hover:bg-black/[0.04] data-[state=open]:bg-black/[0.04] sm:h-8 sm:px-2"
          aria-label="Choose Clauxen plan"
        >
          <span>Clauxen</span>
          <ChevronDown className="h-3 w-3 text-zinc-400" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="z-[100] w-[min(calc(100vw-2rem),300px)] rounded-[16px] border-zinc-200/90 p-1 shadow-[0_14px_36px_-16px_rgba(24,24,27,0.32)]"
      >
        <button
          type="button"
          onClick={onUpgradeClick}
          className="flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-zinc-50"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-zinc-800">
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-zinc-900">
              Clauxen Plus
            </span>
            <span className="block text-[11.5px] text-zinc-500">
              Our smartest model & more
            </span>
          </span>
          <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-zinc-200 bg-white px-2.5 text-[12px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50">
            Upgrade
          </span>
        </button>
        <div className="flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[10px] font-semibold text-zinc-700">
            C
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-zinc-900">
              Clauxen
            </span>
            <span className="block text-[11.5px] text-zinc-500">
              Great for everyday tasks
            </span>
          </span>
          <Check className="h-3.5 w-3.5 shrink-0 text-zinc-900" strokeWidth={2.25} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const upgradeButton = (
    <button
      type="button"
      onClick={onUpgradeClick}
      className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-[#2f6fed] transition-colors hover:bg-[#2f6fed]/08 active:bg-[#2f6fed]/12 sm:h-8 sm:px-2.5 sm:text-[13px]"
      aria-label="Upgrade plan"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>Upgrade</span>
    </button>
  );

  const ghostButton = (
    <HintTooltip
      content={
        temporaryChat
          ? "Temporary chat on — this chat won’t appear in history"
          : "Temporary chat"
      }
      side="bottom"
    >
      <button
        type="button"
        onClick={() => onTemporaryChatChange?.(!temporaryChat)}
        aria-label="Temporary chat"
        aria-pressed={temporaryChat}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-black/[0.04] sm:h-8 sm:w-8",
          temporaryChat && "bg-black/[0.05] text-zinc-900",
        )}
      >
        <GhostChatIcon className="h-4 w-4" />
      </button>
    </HintTooltip>
  );

  return (
    <div
      className={cn(
        "content-pane-top-bar relative sticky top-0 z-20 flex h-9 w-full shrink-0 items-center justify-between gap-2 bg-[var(--app-panel-bg)] px-2.5 font-sans sm:h-10 sm:px-3.5",
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
      <div className="flex shrink-0 items-center gap-0.5">
        {upgradeButton}
        {ghostButton}
      </div>
    </div>
  );
}
