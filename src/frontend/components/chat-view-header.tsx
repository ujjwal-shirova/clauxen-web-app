"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsClient } from "@/frontend/hooks/use-is-client";
import { ChevronDown } from "lucide-react";
import { OrbCursor } from "./ui/orb-cursor";
import { HintTooltip } from "./ui/hint-tooltip";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";
import { StreamingChatTitle } from "./streaming-chat-title";
import { ChatRowMenuContent } from "./chat-row-menu-content";
import { cn } from "@/frontend/lib/utils";
import { resolveDisplayChatTitle } from "@/lib/chat-title";
import {
  DropdownMenu,
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
  thinkingEnabled?: boolean;
  onThinkingEnabledChange?: (enabled: boolean) => void;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  className?: string;
  projectBreadcrumb?: {
    label: string;
    onClick?: () => void;
  };
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
  isChatPinned = false,
  onRenameChat,
  onPinChat,
  onUnpinChat,
  onDeleteChat,
  onOpenSettings,
  onMoveToProject,
  onOpenMobileNav,
  showMobileMenu = false,
  className,
  projectBreadcrumb,
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
              {!isClient ? (
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
                        className="flex h-7 max-w-[min(70vw,420px)] items-center gap-1 rounded-l-lg px-1.5 text-[13px] font-medium text-zinc-800 transition-all hover:bg-zinc-100 sm:px-2"
                      >
                        <StreamingChatTitle
                          title={displayTitle}
                          isStreaming={isTitleStreaming}
                        />
                        {isTitleStreaming ? <OrbCursor /> : null}
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

            <div className="content-pane-top-bar__trailing-wrap flex shrink-0 items-center gap-1">
              <HintTooltip content="Artifacts">
                <button
                  type="button"
                  onClick={onToggleArtifactsPanel}
                  aria-label="Toggle artifacts panel"
                  aria-pressed={isArtifactsPanelOpen}
                  className="ui-icon-button inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-800 transition-all hover:bg-zinc-100 data-[state=open]:bg-black/[0.06]"
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
                  className="ui-button hidden h-7 min-w-[52px] items-center justify-center rounded-md border border-zinc-300 bg-transparent px-2 text-[12px] font-medium text-zinc-800 transition-all hover:bg-zinc-100 min-[420px]:flex"
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

  const upgradeButton = (
    <button
      type="button"
      onClick={onUpgradeClick}
      className="relative z-10 inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-3 text-[13px] text-zinc-500 transition-colors hover:bg-black/[0.03] hover:text-zinc-800 sm:h-10 sm:gap-2 sm:px-4 sm:text-[14px]"
      aria-label="Free plan — upgrade"
    >
      <span className="truncate">Free plan</span>
      <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
      <span className="shrink-0 underline decoration-zinc-400 underline-offset-[3px]">
        Upgrade
      </span>
    </button>
  );

  if (showMobileMenu && onOpenMobileNav) {
    return (
      <div className="content-pane-top-bar relative sticky top-0 z-20 grid h-[35px] w-full shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 bg-white px-2 font-sans sm:gap-2.5 sm:px-3">
        <MobileMenuButton
          onClick={onOpenMobileNav}
          aria-controls="app-primary-nav"
        />
        <div className="flex min-w-0 justify-center">{upgradeButton}</div>
        <span className="w-8 shrink-0" aria-hidden />
      </div>
    );
  }

  return (
    <div className="content-pane-top-bar relative sticky top-0 z-20 flex h-[35px] w-full shrink-0 items-center justify-center bg-white px-3 font-sans sm:px-5">
      {upgradeButton}
    </div>
  );
}
