"use client";

import { Check, SlidersVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ChatGroupBy } from "@/lib/chat-grouping";

const groupOptions: Array<{
  value: ChatGroupBy;
  label: string;
  disabled?: boolean;
}> = [
  { value: "none", label: "None" },
  { value: "date", label: "Date" },
];

const sidebarGroupTriggerClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-zinc-800/66 shadow-none transition-colors hover:bg-black/[0.04] hover:text-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 data-[state=open]:bg-black/[0.04] data-[state=open]:text-zinc-800/80";

export function SidebarChatGroupMenu({
  value,
  onChange,
  onClick,
}: {
  value: ChatGroupBy;
  onChange: (value: ChatGroupBy) => void;
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
          <SlidersVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={6}
        avoidCollisions={false}
        className="z-50 min-w-[148px] rounded-[10px] border border-black/[0.08] bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[12px] font-medium text-zinc-500">
          Group by
        </DropdownMenuLabel>
        {groupOptions.map((option) => {
          const isSelected = value === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] font-medium text-zinc-800 focus:bg-zinc-100",
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
