'use client';

import React, { useMemo } from 'react';
import {
  Settings,
  ArrowUpCircle,
  Gift,
  HelpCircle,
  LogOut,
  MoreVertical,
  Search,
  Languages,
  Library,
  Microscope,
} from 'lucide-react';
import { 
  SidebarToggleIcon, 
  SidebarOpenIcon, 
  ClaudeStar, 
  NewChatIcon, 
  NavProjectsIcon, 
  NavArtifactsIcon, 
  NavCodeIcon,
  CreateWithClaudeIcon,
} from './icons';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

const DownloadButton = ({ size = "md", className }: { size?: "sm" | "md" | "lg", className?: string }) => (
  <div className={cn("relative group cursor-pointer", className)}>
    <div className={cn(
      "flex items-center justify-center bg-white border border-[#1f1e1d]/15 rounded-md shadow-sm transition-all hover:bg-[#f0eee6]",
      size === "sm" ? "w-6 h-6" : size === "lg" ? "w-[34px] h-[34px]" : "w-8 h-8"
    )}>
      <svg width={size === "sm" ? "16" : "20"} height={size === "sm" ? "16" : "20"} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ fill: 'rgb(20, 20, 19)' }}>
        <path className="group-hover:translate-y-[1px] transition-transform" d="M10 3C10.2761 3 10.5 3.22386 10.5 3.5V12.1855L13.626 8.66797C13.8094 8.46166 14.1256 8.44275 14.332 8.62598C14.5383 8.80936 14.5573 9.12563 14.374 9.33203L10.374 13.832L10.2949 13.9033C10.21 13.9654 10.107 14 10 14C9.85718 14 9.72086 13.9388 9.62598 13.832L5.62598 9.33203L5.56738 9.25C5.45079 9.04872 5.48735 8.78653 5.66797 8.62598C5.84854 8.46567 6.1127 8.46039 6.29883 8.59961L6.37402 8.66797L9.5 12.1855V3.5C9.5 3.22386 9.72386 3 10 3Z" />
        <path className="group-hover:translate-x-[0.5px] transition-transform" d="M3.5 13C3.22386 13 3 13.2239 3 13.5V15.5C3 16.3284 3.67157 17 4.5 17H10V16H4.5C4.22386 16 4 15.7761 4 15.5V13.5C4 13.2239 3.77614 13 3.5 13Z" />
        <path className="group-hover:-translate-x-[0.5px] transition-transform" d="M16.5 13C16.7761 13 17 13.2239 17 13.5V15.5C17 16.3284 16.3284 17 15.5 17H10V16H15.5C15.7761 16 16 15.7761 16 15.5V13.5C16 13.2239 16.2239 13 16.5 13Z" />
      </svg>
    </div>
    <span className={cn(
      "absolute pointer-events-none flex h-2 w-2 z-20",
      size === "sm" ? "-top-0.5 -right-0.5" : "-top-1 -right-1"
    )}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2c84db] opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2c84db]"></span>
    </span>
  </div>
);

const CustomizeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12.5 3C13.3284 3 14 3.67157 14 4.5V6H14.5C16.433 6 18 7.567 18 9.5V15.5C18 16.3284 17.3284 17 16.5 17H3.5C2.72334 17 2.08461 16.4097 2.00781 15.6533L2 15.5V9.5C2 7.567 3.567 6 5.5 6H6V4.5C6 3.67157 6.67157 3 7.5 3H12.5ZM3 15.5L3.00977 15.6006C3.05629 15.8286 3.25829 16 3.5 16H16.5C16.7761 16 17 15.7761 17 15.5V12H13V12.5C13 12.7761 12.7761 13 12.5 13C12.2239 13 12 12.7761 12 12.5V12H8V12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5V12H3V15.5ZM5.5 7C4.11929 7 3 8.11929 3 9.5V11H7V10.5C7 10.2239 7.22386 10 7.5 10C7.77614 10 8 10.2239 8 10.5V11H12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V11H17V9.5C17 8.11929 15.8807 7 14.5 7H5.5ZM7.5 4C7.22386 4 7 4.22386 7 4.5V6H13V4.5C13 4.22386 12.7761 4 12.5 4H7.5Z" />
  </svg>
);

interface SidebarProps {
  handleNewChat: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onUpgradeClick: () => void;
  onSettingsClick: () => void;
  onCustomizeClick: () => void;
  onAppsExtensionsClick: () => void;
  onHistoryClick: () => void;
  onGiftClick: () => void;
  onProjectsClick: () => void;
  onArtifactsClick: () => void;
  activeView?: string;
}

export function Sidebar({ 
  handleNewChat, 
  isCollapsed, 
  setIsCollapsed, 
  onUpgradeClick,
  onSettingsClick,
  onCustomizeClick,
  onAppsExtensionsClick,
  onHistoryClick,
  onGiftClick,
  onProjectsClick,
  onArtifactsClick,
  activeView
}: SidebarProps) {
  const isCustomizeActive = activeView === 'customize';

  return (
    <nav 
      onClick={() => isCollapsed && !isCustomizeActive && setIsCollapsed(false)}
      className={cn(
        "bg-[#f7f8f2] flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out select-none fixed left-0 top-0 z-30",
        isCollapsed ? "w-[48.8px] cursor-pointer" : "w-[288px]"
      )}
    >
      <div className="h-[56px] px-2 flex items-center justify-between relative shrink-0">
        <div className={cn("flex items-center pl-2 transition-opacity duration-300", isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100")}>
          <div className="flex items-center gap-2">
             <ClaudeStar className="w-[24px] h-[24px] text-[#3d3d3a]" />
             <span className="font-serif text-[20px] font-medium text-[#3d3d3a]">Clauxen</span>
          </div>
        </div>
        
        <button
          onClick={(e) => { e.stopPropagation(); if (!isCustomizeActive) setIsCollapsed(!isCollapsed); }}
          disabled={isCustomizeActive}
          className={cn("p-2 rounded-lg hover:bg-black/5 text-[#73726c] transition-all duration-300", isCollapsed ? "absolute left-1/2 -translate-x-1/2" : "", isCustomizeActive && "opacity-30 cursor-not-allowed")}
        >
          {isCollapsed ? <SidebarOpenIcon className="w-5 h-5" /> : <SidebarToggleIcon className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="px-2 space-y-0.5">
          <div className={cn("py-1 mb-1", isCollapsed ? "px-0" : "px-2")}>
            {isCollapsed ? (
              <button onClick={(e) => e.stopPropagation()} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#73726c] transition-all mx-auto"><Search className="w-5 h-5 opacity-70" /></button>
            ) : (
              <button onClick={(e) => e.stopPropagation()} className="w-full flex items-center justify-between gap-3 h-10 px-3.5 bg-[#f0f0f0]/50 border border-black/[0.04] rounded-full text-[14px] text-[#3d3d3a] hover:bg-black/5 transition-all group">
                <div className="flex items-center gap-3"><Search className="w-4 h-4 opacity-60" /><span className="opacity-60 font-[430]">Search</span></div>
                <span className="text-[11px] text-black/30 font-medium pr-1">Ctrl+K</span>
              </button>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); handleNewChat(); }}
            className={cn("w-full justify-start gap-3 h-9 px-3.5 text-[14px] font-[430] text-[#3d3d3a] hover:bg-black/5 transition-all group mb-6", isCollapsed && "justify-center px-0 w-9 h-9 mx-auto rounded-lg")}
          >
            <div className="flex items-center justify-center w-5 h-5 bg-[#73726c]/15 rounded-full shrink-0"><NewChatIcon className="w-3.5 h-3.5 text-[#3d3d3a]" /></div>
            {!isCollapsed && <span className="flex-1 text-left truncate">New chat</span>}
          </Button>

          <button
            onClick={(e) => { e.stopPropagation(); onHistoryClick(); }}
            className={cn("flex items-center w-full h-9 rounded-lg text-[#3D3D3A] text-[14px] font-[430] leading-[20px] transition-all duration-75 hover:bg-black/5 mb-1", isCollapsed ? "justify-center w-9 h-9 mx-auto" : "justify-start px-3.5")}
          >
            <div className={cn("flex items-center gap-3", !isCollapsed && "w-full")}>
              <div className="flex items-center justify-center w-5 h-5 shrink-0"><Library className="w-5 h-5" /></div>
              {!isCollapsed && <span className="truncate">Library</span>}
            </div>
          </button>

          <div className="flex flex-col gap-[1px]">
            {[
              { id: 'customize', icon: CustomizeIcon, label: 'Customize', onClick: onCustomizeClick },
              { id: 'projects', icon: NavProjectsIcon, label: 'Projects', onClick: onProjectsClick },
              { id: 'artifacts', icon: NavArtifactsIcon, label: 'Artifacts', onClick: onArtifactsClick },
            ].map((item) => (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); item.onClick(); }}
                className={cn("flex items-center w-full h-9 rounded-lg text-[#3D3D3A] text-[14px] font-[430] leading-[20px] transition-all duration-75 hover:bg-black/5", isCollapsed ? "justify-center w-9 h-9 mx-auto" : "justify-start px-3.5")}
              >
                <div className={cn("flex items-center gap-3", !isCollapsed && "w-full")}>
                  <div className="flex items-center justify-center w-5 h-5 shrink-0"><item.icon /></div>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
              </button>
            ))}

            <div className="relative group">
              <div className={cn("flex items-center w-full h-9 rounded-lg text-[#3D3D3A] text-[14px] font-[430] leading-[20px] transition-all duration-75 hover:bg-black/5", isCollapsed ? "justify-center w-9 h-9 mx-auto" : "justify-start px-3.5")}>
                <div className={cn("flex items-center gap-3", !isCollapsed && "w-full", "opacity-40")}>
                  <div className="flex items-center justify-center w-5 h-5 shrink-0"><NavCodeIcon className="w-5 h-5 text-[#141413]" /></div>
                  {!isCollapsed && <span className="truncate">Code</span>}
                </div>
                {!isCollapsed && <button onClick={(e) => { e.stopPropagation(); onUpgradeClick(); }} className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 border border-[#1f1e1d]/15 rounded-full text-[11px] font-medium text-[#1B67B2] bg-white shadow-sm hover:bg-[#F0EEE6] transition-all z-10">Upgrade</button>}
              </div>
            </div>

            {[
              { id: 'deep-research', icon: Microscope, label: 'Deep Research' },
              { id: 'clauxen-claw', icon: CreateWithClaudeIcon, label: 'Clauxen Claw' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); }}
                className={cn(
                  "flex items-center w-full h-9 rounded-lg text-[#3D3D3A] text-[14px] font-[430] leading-[20px] transition-all duration-75 hover:bg-black/5",
                  isCollapsed ? "justify-center w-9 h-9 mx-auto" : "justify-start px-3.5"
                )}
              >
                <div className={cn("flex items-center gap-3", !isCollapsed && "w-full")}>
                  <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    <item.icon className="w-5 h-5" />
                  </div>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-2 mt-auto shrink-0 flex flex-col items-center gap-1">
        {isCollapsed && <div className="mb-1"><DownloadButton size="md" /></div>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()} className={cn("menu-trigger-active w-full flex items-center gap-3 p-2 outline-none", isCollapsed ? "justify-center py-2 rounded-full" : "justify-start rounded-lg")}>
              <Avatar className="w-9 h-9 border border-black/5">
                <AvatarImage src="https://picsum.photos/seed/user/100/100" />
                <AvatarFallback className="bg-[#3d3d3a] text-[#FAF9F5] text-sm font-semibold">U</AvatarFallback>
              </Avatar>
              <div className={cn("flex-1 text-left min-w-0 flex flex-col transition-opacity duration-200", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100")}>
                <p className="text-[14px] font-medium text-[#3d3d3a] truncate">Ujjwal</p>
                <p className="text-[12px] text-[#73726c] leading-tight">Free plan</p>
              </div>
              {!isCollapsed && <div className="flex items-center gap-2 shrink-0"><DownloadButton size="md" /><MoreVertical className="w-3.5 h-3.5 text-[#73726c]/60" /></div>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-[272px] bg-white/80 backdrop-blur-3xl border-[#1f1e1d]/30 rounded-xl shadow-lg p-1.5 z-50 font-sans">
            <DropdownMenuItem onClick={onSettingsClick} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><div className="flex items-center gap-2"><Settings className="w-5 h-5 text-[#3d3d3a]" /><span>Settings</span></div></DropdownMenuItem>
            <DropdownMenuItem onClick={onUpgradeClick} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><ArrowUpCircle className="w-5 h-5 text-[#3d3d3a]" /><span>Upgrade plan</span></DropdownMenuItem>
            <DropdownMenuItem onClick={onAppsExtensionsClick} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><DownloadButton size="sm" /><span className="ml-2">Apps and extensions</span></DropdownMenuItem>
            <DropdownMenuItem onClick={onGiftClick} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><Gift className="w-5 h-5 text-[#3d3d3a]" /><span>Gift Clauxen</span></DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5 bg-[#1f1e1d]/10" />
            <DropdownMenuItem className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 cursor-pointer text-destructive"><LogOut className="w-5 h-5" /><span>Log out</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
