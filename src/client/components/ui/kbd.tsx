"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  describeShortcut,
  shortcutKeyChips,
} from "@/lib/keyboard-shortcuts-defaults";
import { useShortcutDisplay } from "@/hooks/use-keyboard-shortcuts";

/* ------------------------------------------------------------------ */
/* Keycap chips                                                         */
/* ------------------------------------------------------------------ */

export type KbdProps = React.HTMLAttributes<HTMLElement> & {
  /** Renders the compact variant used inside buttons. */
  size?: "sm" | "md";
  /** Dark variant used inside the black hint container. */
  tone?: "light" | "dark";
};

/**
 * A single keycap chip — styled like the platform approval prompts
 * (e.g. `Allow once ⌘⏎`).
 */
export function Kbd({
  size = "md",
  tone = "light",
  className,
  children,
  ...props
}: KbdProps) {
  return (
    <kbd
      className={cn("cx-kbd", `cx-kbd--${size}`, `cx-kbd--${tone}`, className)}
      {...props}
    >
      {children}
    </kbd>
  );
}

export type KbdComboProps = {
  keys?: string[];
  /** Pre-rendered display chips (e.g. sequences like ["G", "L"]). */
  chips?: string[];
  size?: "sm" | "md";
  tone?: "light" | "dark";
  className?: string;
  /** Accessible label for the whole combo, e.g. "Shortcut: Ctrl + K". */
  ariaLabel?: string;
};

/** A key combination rendered as a row of keycap chips (`⇧ ⌘ O`). */
export function KbdCombo({
  keys,
  chips,
  size = "md",
  tone = "light",
  className,
  ariaLabel,
}: KbdComboProps) {
  const resolvedChips = chips ?? shortcutKeyChips(keys ?? []);
  if (resolvedChips.length === 0) return null;
  return (
    <span
      className={cn("cx-kbd-combo", className)}
      role="img"
      aria-label={
        ariaLabel ?? `Shortcut: ${keys ? describeShortcut(keys) : resolvedChips.join(" ")}`
      }
    >
      {resolvedChips.map((chip, index) => (
        <Kbd key={`${chip}-${index}`} size={size} tone={tone}>
          {chip}
        </Kbd>
      ))}
    </span>
  );
}

/** All chips for a shortcut including its fixed secondary binding. */
export function KbdShortcut({
  keys,
  extraKeys,
  size = "md",
  tone = "light",
}: {
  keys: string[];
  extraKeys?: string[];
  size?: "sm" | "md";
  tone?: "light" | "dark";
}) {
  return (
    <>
      <KbdCombo keys={keys} size={size} tone={tone} />
      {extraKeys && extraKeys.length > 0 ? (
        <>
          <span
            className={cn(
              "px-0.5 text-[10px] font-medium",
              tone === "dark" ? "text-white/45" : "text-black/35",
            )}
            aria-hidden
          >
            /
          </span>
          <KbdCombo keys={extraKeys} size={size} tone={tone} />
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Inline badge on buttons                                              */
/* ------------------------------------------------------------------ */

export function ShortcutBadge({
  keys,
  extraKeys,
  shortcutId,
  className,
}: {
  keys?: string[];
  extraKeys?: string[];
  shortcutId?: Parameters<typeof useShortcutDisplay>[0];
  className?: string;
}) {
  const bound = useShortcutDisplay(shortcutId);
  const resolvedKeys = shortcutId ? bound?.keys : keys;
  const resolvedExtra = shortcutId ? bound?.extraKeys : extraKeys;
  const enabled = shortcutId ? Boolean(bound?.enabled) : true;
  if (!enabled || !resolvedKeys?.length) return null;
  return (
    <span
      className={cn(
        "pointer-events-none ml-1.5 inline-flex shrink-0 items-center gap-0.5 opacity-70",
        className,
      )}
      aria-hidden
    >
      <KbdShortcut keys={resolvedKeys} extraKeys={resolvedExtra} size="sm" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Black hover hint container                                           */
/* ------------------------------------------------------------------ */

export type ShortcutHintProps = {
  /** Short action label shown next to the keys, e.g. "Search chats". */
  label: string;
  /** Combo keys (registry format). Omit and pass `shortcutId` instead. */
  keys?: string[];
  extraKeys?: string[];
  /** Pre-rendered display chips (e.g. sequence ["G", "L"]). */
  chips?: string[];
  /** Resolve the (possibly user-remapped) combo from the shortcut registry. */
  shortcutId?: Parameters<typeof useShortcutDisplay>[0];
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  align?: React.ComponentProps<typeof TooltipContent>["align"];
  sideOffset?: number;
  children: React.ReactNode;
};

/**
 * Hover/focus hint that appears near a control as a black container with the
 * label and its key combination — the app-wide shortcut affordance.
 */
export function ShortcutHint({
  label,
  keys,
  extraKeys,
  chips,
  shortcutId,
  side = "top",
  align = "center",
  sideOffset = 8,
  children,
}: ShortcutHintProps) {
  const [open, setOpen] = React.useState(false);
  const bound = useShortcutDisplay(shortcutId);

  const resolvedKeys = shortcutId ? bound?.keys : keys;
  const resolvedExtra = shortcutId ? bound?.extraKeys : extraKeys;
  const enabled = shortcutId ? Boolean(bound?.enabled) : true;

  const showHint = enabled && (Boolean(chips?.length) || Boolean(resolvedKeys && resolvedKeys.length > 0));

  const trigger = React.isValidElement(children) ? (
    React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
      onClick: (event: React.MouseEvent) => {
        setOpen(false);
        (children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick?.(event);
      },
    })
  ) : (
    <>{children}</>
  );

  return (
    <TooltipProvider delayDuration={220}>
      <Tooltip open={showHint ? open : false} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={sideOffset}
          className="z-[9999] border-0 bg-transparent p-0 shadow-none"
        >
          <div className="cx-shortcut-hint">
            <span className="text-[12px] font-medium leading-4 text-white/92">
              {label}
            </span>
            <span className="cx-kbd-combo">
              {chips && chips.length > 0 ? (
                <KbdCombo chips={chips} size="sm" tone="dark" />
              ) : (
                <KbdShortcut
                  keys={resolvedKeys ?? []}
                  extraKeys={resolvedExtra}
                  size="sm"
                  tone="dark"
                />
              )}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
