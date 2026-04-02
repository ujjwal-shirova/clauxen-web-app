'use client';

import { ChevronDown, Star, Pencil, FolderPlus, Trash2 } from 'lucide-react';
import { GhostIcon } from './icons';
import { OrbCursor } from './ui/orb-cursor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/frontend/components/ui/dropdown-menu';

interface ChatViewHeaderProps {
  isConversationStarted: boolean;
  onUpgradeClick: () => void;
  onShareClick?: () => void;
  onToggleArtifactsPanel?: () => void;
  isArtifactsPanelOpen?: boolean;
  chatTitle?: string;
  isTitleStreaming?: boolean;
}

export function ChatViewHeader({
  isConversationStarted,
  onUpgradeClick,
  onShareClick,
  onToggleArtifactsPanel,
  isArtifactsPanelOpen = false,
  chatTitle = 'New Chat',
  isTitleStreaming = false,
}: ChatViewHeaderProps) {
  if (isConversationStarted) {
    return (
      <header className="sticky top-0 z-20 flex h-12 w-full shrink-0 bg-[#faf9f5] items-center font-sans">
        <div className="absolute inset-0 z-[-1] bottom-[-20px] pointer-events-none bg-gradient-to-b from-[#faf9f5] via-[#faf9f5]/65 to-transparent blur-[4px]" />
        <div className="flex h-full w-full items-center justify-between px-4">
          <div className="flex min-w-0 flex-1 items-center pr-24">
            <DropdownMenu>
              <div className="flex items-center gap-0">
                <button className="flex h-7 items-center justify-center rounded-l-lg px-2 text-[14px] font-medium text-[#3d3d3a] transition-all hover:bg-black/5">
                  <span className="truncate">{chatTitle || 'New Chat'}</span>
                  {isTitleStreaming && <OrbCursor />}
                </button>
                <div className="h-7 w-[1.5px] bg-black/10" />
                <DropdownMenuTrigger asChild>
                  <button className="flex h-7 w-7 items-center justify-center rounded-r-lg text-[#3d3d3a] transition-all hover:bg-black/5 data-[state=open]:bg-black/5">
                    <ChevronDown className="icon-md opacity-70" />
                  </button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent
                align="start"
                side="bottom"
                className="min-w-[170px] rounded-xl border border-[#1f1e1d]/30 bg-white/95 p-1.5 text-[#3d3d3a] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xl"
              >
                <DropdownMenuItem className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] transition-colors hover:bg-black/5 focus:bg-black/5">
                  <Star className="icon-md mr-2" />
                  Star
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] transition-colors hover:bg-black/5 focus:bg-black/5">
                  <Pencil className="icon-md mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] transition-colors hover:bg-black/5 focus:bg-black/5">
                  <FolderPlus className="icon-md mr-2" />
                  Add to project
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-[#1f1e1d]/15" />
                <DropdownMenuItem className="cursor-pointer rounded-lg px-2 py-1.5 text-[14px] font-[430] text-[#8a2424] transition-colors hover:bg-[#8a2424]/10 focus:bg-[#8a2424]/10">
                  <Trash2 className="icon-md mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleArtifactsPanel}
              aria-label="Open sidebar"
              aria-pressed={isArtifactsPanelOpen}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#3d3d3a] transition-all hover:bg-black/5 data-[state=open]:bg-black/5"
              data-state={isArtifactsPanelOpen ? 'open' : 'closed'}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M11.586 2a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V16.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.492-1.347L4 16.5v-13A1.5 1.5 0 0 1 5.5 2zM5.5 3a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V7h-2.5A1.5 1.5 0 0 1 11 5.5V3zm7.04 10.304a.5.5 0 0 1 .92.392c-.295.69-.871 1.304-1.66 1.304-.487 0-.892-.234-1.2-.574-.309.34-.713.574-1.2.574-.486 0-.892-.233-1.2-.574-.31.34-.714.574-1.2.574a.5.5 0 0 1 0-1c.212 0 .52-.18.74-.696l.034-.067a.5.5 0 0 1 .886.067c.221.516.528.696.74.696.213 0 .52-.18.74-.696l.035-.067a.5.5 0 0 1 .885.067c.22.516.527.696.74.696s.519-.18.74-.696m0-4a.5.5 0 0 1 .92.392c-.295.69-.871 1.304-1.66 1.304-.487 0-.892-.234-1.2-.574-.309.34-.713.574-1.2.574-.486 0-.892-.233-1.2-.574-.31.34-.714.574-1.2.574a.5.5 0 0 1 0-1c.212 0 .52-.18.74-.696l.034-.067a.5.5 0 0 1 .886.067c.221.516.528.696.74.696.213 0 .52-.18.74-.696l.035-.067a.5.5 0 0 1 .885.067c.22.516.527.696.74.696s.519-.18.74-.696M12 5.5a.5.5 0 0 0 .5.5h2.293L12 3.207z" />
              </svg>
            </button>
            <button
              onClick={onShareClick}
              className="flex h-8 min-w-[64px] items-center justify-center rounded-md border border-black/30 bg-transparent px-3 text-[12px] font-medium text-[#3d3d3a] transition-all hover:bg-black/5"
            >
              Share
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <div className="sticky top-0 z-50 flex h-14 w-full shrink-0 items-center justify-center bg-[#faf9f5] font-sans">
      <div className="flex h-8 select-none items-center gap-[6px] rounded-lg bg-[#f0eee6] px-2 text-[14px] font-medium text-[#73726c] shadow-sm">
        <span>Free plan</span>
        <div className="mt-0.5 h-[3px] w-[3px] rounded-full bg-[#73726c]/30" />
        <button
          onClick={onUpgradeClick}
          className="text-[#73726c] underline decoration-[#73726c]/40 underline-offset-[3px] hover:text-[#3d3d3a]"
        >
          Upgrade
        </button>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <button className="group rounded-md p-1.5 transition-colors hover:bg-[#f0eee6]">
          <GhostIcon className="h-5 w-5 text-[#3d3d3a] opacity-70 group-hover:opacity-100" />
        </button>
      </div>
    </div>
  );
}
