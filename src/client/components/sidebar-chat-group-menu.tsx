"use client";

import { Check, SlidersVertical } from "@/components/ui/bootstrap-icon";
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

export const sidebarSectionIconButtonClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[var(--cx-sidebar-muted)] shadow-none transition-colors hover:bg-[var(--cx-sidebar-hover)] hover:text-[var(--cx-sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] data-[state=open]:bg-[var(--cx-sidebar-hover)] data-[state=open]:text-[var(--cx-sidebar-fg)]";

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
          className={sidebarSectionIconButtonClass}
        >
          <SlidersVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={6}
        avoidCollisions={false}
        className="z-50 min-w-[148px] rounded-[10px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-1 shadow-[var(--panel-shadow)] font-sans"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[11.5px] font-medium text-[var(--ui-fg-muted)]">
          Group by
        </DropdownMenuLabel>
        {groupOptions.map((option) => {
          const isSelected = value === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "ui-menu-row flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] font-normal text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)] focus:bg-[var(--ui-hover-wash)]",
              )}
            >
              <span>{option.label}</span>
              {isSelected ? (
                <Check className="size-3.5 text-[var(--link,#256bc1)]" strokeWidth={2} />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
