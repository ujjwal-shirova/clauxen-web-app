"use client";

import * as React from "react";
import { Upload, FileText, Plus, type LucideIcon } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";

function MenuRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[14px] text-zinc-900 outline-none focus:bg-[rgba(31,30,29,0.06)]"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      {label}
    </DropdownMenuItem>
  );
}

function GitHubMenuRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[14px] text-zinc-900 outline-none focus:bg-[rgba(31,30,29,0.06)]"
      onClick={onClick}
    >
      <GithubIcon className="h-[18px] w-[18px] opacity-90" />
      {label}
    </DropdownMenuItem>
  );
}

type ProjectFilesMenuProps = {
  onUploadFromDevice?: () => void;
  onAddTextContent?: () => void;
  onGitHub?: () => void;
  children?: React.ReactNode;
};

export function ProjectFilesMenu({
  onUploadFromDevice,
  onAddTextContent,
  onGitHub,
  children,
}: ProjectFilesMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label="Add files"
            className={cn(appBtn.ghostIcon, "-mr-2")}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        className="z-50 min-w-[220px] overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08)]"
      >
        <MenuRow
          icon={Upload}
          label="Upload from device"
          onClick={() => onUploadFromDevice?.()}
        />
        <MenuRow
          icon={FileText}
          label="Add text content"
          onClick={() => onAddTextContent?.()}
        />
        <DropdownMenuSeparator className="my-1 bg-[rgba(31,30,29,0.1)]" />
        <GitHubMenuRow label="GitHub" onClick={() => onGitHub?.()} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
