"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";

export type ProjectSortKey = "recent_activity" | "last_edited" | "date_created";

const SORT_OPTIONS: { value: ProjectSortKey; label: string; short: string }[] =
  [
    { value: "recent_activity", label: "Recent activity", short: "Activity" },
    { value: "last_edited", label: "Last edited", short: "Last edited" },
    { value: "date_created", label: "Date created", short: "Date created" },
  ];

type ProjectSortMenuProps = {
  value: ProjectSortKey;
  onChange: (value: ProjectSortKey) => void;
};

export function ProjectSortMenu({ value, onChange }: ProjectSortMenuProps) {
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  return (
    <div className="flex items-center gap-2 text-[13px] text-[#8f8f8f]">
      <span>Sort by</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(appBtn.secondary, "gap-1.5 text-[13.5px]")}
            aria-label="Sort projects"
          >
            <span>{current.short}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-[172px] rounded-xl border border-[rgba(11,11,11,0.1)] bg-white p-1 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(v) => onChange(v as ProjectSortKey)}
          >
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-2.5 pr-2 text-[14px] leading-5 text-zinc-900 outline-none",
                  "focus:bg-[rgba(11,11,11,0.06)] data-[highlighted]:bg-[rgba(11,11,11,0.06)]",
                  "[&>span:first-child]:hidden",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {value === option.value ? (
                  <Check
                    className="ml-4 h-5 w-5 shrink-0 text-[#2a78d6]"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : (
                  <span className="ml-4 h-5 w-5 shrink-0" aria-hidden />
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function sortProjects<T extends { created_at: string; updated_at: string }>(
  projects: T[],
  sortKey: ProjectSortKey,
): T[] {
  const copy = [...projects];
  switch (sortKey) {
    case "date_created":
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "last_edited":
    case "recent_activity":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }
}
