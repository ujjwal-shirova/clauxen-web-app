"use client";

import { Check, SlidersVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { cn } from "@/frontend/lib/utils";
import type { ChatGroupBy } from "@/frontend/lib/chat-grouping";

const groupOptions: Array<{
  value: ChatGroupBy;
  label: string;
  disabled?: boolean;
}> = [
  { value: "none", label: "None" },
  { value: "date", label: "Date" },
  { value: "project", label: "Project" },
];

const sidebarGroupTriggerClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-zinc-500 shadow-none transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-700";

export function SidebarChatGroupMenu({
  value,
  onChange,
  projectGroupingEnabled,
  onClick,
}: {
  value: ChatGroupBy;
  onChange: (value: ChatGroupBy) => void;
  projectGroupingEnabled: boolean;
  onClick?: (event: React.MouseEvent) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Group chats"
          onClick={onClick}
          className={sidebarGroupTriggerClass}
        >
          <SlidersVertical className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={6}
        avoidCollisions={false}
        className="z-50 min-w-[148px] rounded-xl border border-black/[0.08] bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      >
        <DropdownMenuLabel className="px-2.5 py-1.5 text-[12px] font-[430] text-zinc-500">
          Group by
        </DropdownMenuLabel>
        {groupOptions.map((option) => {
          const isDisabled =
            option.value === "project" && !projectGroupingEnabled;
          const isSelected = value === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onChange(option.value);
              }}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-[430] text-zinc-800 focus:bg-zinc-100",
                isDisabled && "cursor-default text-zinc-400 opacity-70",
              )}
            >
              <span>{option.label}</span>
              {isSelected ? (
                <Check className="h-3.5 w-3.5 text-[#256bc1]" strokeWidth={2} />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
