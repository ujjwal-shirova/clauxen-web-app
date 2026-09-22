"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const settingsFocusReset =
  "outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0";

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
 * Opens a small card with Push + Email switches (both can be on).
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
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {(
          [
            { key: "push" as const, label: "Push" },
            { key: "email" as const, label: "Email" },
          ] as const
        ).map((row) => {
          const checked = channels[row.key];
          return (
            <button
              key={row.key}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              onClick={(event) => {
                event.preventDefault();
                setChannel(row.key, !checked);
              }}
              className={cn(
                "no-hover-overlay flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[var(--settings-fg)] transition-colors hover:bg-[var(--settings-nav-hover-bg)]",
                settingsFocusReset,
              )}
            >
              <span className="min-w-0 flex-1">{row.label}</span>
              <Switch
                checked={checked}
                onCheckedChange={(next) => setChannel(row.key, next)}
                onClick={(event) => event.stopPropagation()}
                className="settings-switch"
                aria-label={row.label}
              />
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
