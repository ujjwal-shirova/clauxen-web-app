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
            "no-hover-overlay inline-flex h-8 min-h-8 w-full shrink-0 items-center justify-between gap-1.5 rounded-lg bg-transparent px-1.5 text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-zinc-50 sm:w-auto sm:justify-end",
            settingsFocusReset,
            className,
          )}
        >
          <span className="max-w-[10rem] truncate text-right">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[120] w-[11.5rem] rounded-2xl border border-zinc-200/90 bg-white p-1.5 shadow-[0_12px_32px_rgba(24,24,27,0.12)]"
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
                "no-hover-overlay flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-[430] text-zinc-900 transition-colors hover:bg-zinc-50",
                settingsFocusReset,
              )}
            >
              <span className="min-w-0 flex-1">{row.label}</span>
              <Switch
                checked={checked}
                onCheckedChange={(next) => setChannel(row.key, next)}
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  "data-[state=checked]:bg-[#2563eb] data-[state=unchecked]:bg-zinc-300",
                  "dark:data-[state=checked]:bg-[#3b82f6]",
                )}
                aria-label={row.label}
              />
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
