"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const settingsFocusReset =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-focus-ring)] focus-visible:ring-offset-2";

export function parseNotificationDelivery(value: string): {
  push: boolean;
  email: boolean;
} {
  const normalized = value.trim().toLowerCase();
  if (normalized === "off" || !normalized) {
    return { push: false, email: false };
  }
  return {
    push: normalized.includes("push"),
    email: normalized.includes("email"),
  };
}

export function formatNotificationDelivery(input: {
  push: boolean;
  email: boolean;
}): string {
  if (input.push && input.email) return "Push, Email";
  if (input.push) return "Push";
  if (input.email) return "Email";
  return "Off";
}

type NotificationDeliveryPickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
};

/**
 * Delivery control: trigger shows "Push, Email" / etc.
 * Opens a keyboard-accessible menu with independently selectable channels.
 * Entire row is clickable, not only the switch thumb.
 */
export function NotificationDeliveryPicker({
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: NotificationDeliveryPickerProps) {
  const channels = parseNotificationDelivery(value);
  const label = formatNotificationDelivery(channels);

  const setChannel = (key: "push" | "email", next: boolean) => {
    onValueChange(
      formatNotificationDelivery({
        ...channels,
        [key]: next,
      }),
    );
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? `Notification delivery: ${label}`}
          className={cn(
            "no-hover-overlay settings-btn w-full justify-between sm:w-auto",
            settingsFocusReset,
            className,
          )}
        >
          <span className="max-w-[10rem] truncate text-right">{label}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-[var(--settings-fg-muted)]"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="settings-theme z-[220] w-[11.5rem] rounded-xl border border-[var(--settings-modal-border)] bg-[var(--settings-elevated-bg)] p-1.5 text-[var(--settings-fg)] shadow-[var(--settings-modal-shadow)]"
        data-nested-settings-dialog=""
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        {(
          [
            { key: "push" as const, label: "Push" },
            { key: "email" as const, label: "Email" },
          ] as const
        ).map((row) => {
          const checked = channels[row.key];
          return (
            <DropdownMenuCheckboxItem
              key={row.key}
              checked={checked}
              onCheckedChange={(next) => setChannel(row.key, next)}
              onSelect={(event) => event.preventDefault()}
              className="cursor-pointer rounded-lg py-2.5 text-[13px] focus:bg-[var(--settings-nav-hover-bg)]"
            >
              {row.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
