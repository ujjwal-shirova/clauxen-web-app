"use client";

import * as React from "react";
import { Keyboard, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdCombo } from "@/components/ui/kbd";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  BUILT_IN_SHORTCUTS,
  SHORTCUT_CATEGORY_ORDER,
  describeShortcut,
} from "@/lib/keyboard-shortcuts-defaults";
import { cn } from "@/lib/utils";

type HelpRow = {
  label: string;
  keys: string[];
  extraKeys?: string[];
  description?: string;
};

function Section({
  title,
  rows,
  first,
}: {
  title: string;
  rows: HelpRow[];
  first?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section
      className={cn("mt-5", first && "mt-0")}
      aria-label={`${title} shortcuts`}
    >
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ui-fg-muted)]">
        {title}
      </h3>
      <div>
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="cx-shortcut-row"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] leading-5 text-[var(--ui-fg)]">
                {row.label}
              </span>
              {row.description ? (
                <span className="block truncate text-[11.5px] leading-4 text-[var(--ui-fg-muted)]">
                  {row.description}
                </span>
              ) : null}
            </span>
            <span className="cx-kbd-combo shrink-0">
              <KbdCombo
                keys={row.keys}
                size="sm"
                ariaLabel={describeShortcut(row.keys)}
              />
              {row.extraKeys && row.extraKeys.length > 0 ? (
                <>
                  <span className="px-0.5 text-[10px] text-black/35" aria-hidden>
                    /
                  </span>
                  <KbdCombo keys={row.extraKeys} size="sm" />
                </>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShortcutsHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { shortcuts } = useKeyboardShortcuts();

  const rowsByCategory = React.useMemo(() => {
    const map = new Map<string, HelpRow[]>();
    const push = (category: string, row: HelpRow) => {
      const list = map.get(category) ?? [];
      list.push(row);
      map.set(category, list);
    };

    for (const shortcut of shortcuts) {
      if (!shortcut.enabled) continue;
      push(shortcut.category ?? "General", {
        label: shortcut.label,
        keys: shortcut.keys,
        extraKeys: shortcut.extraKeys,
      });
    }
    for (const builtIn of BUILT_IN_SHORTCUTS) {
      push(builtIn.category, {
        label: builtIn.label,
        keys: builtIn.keys,
        description: builtIn.description,
      });
    }
    return map;
  }, [shortcuts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        aria-label="Keyboard shortcuts"
        className="chat-search-dialog !flex w-[min(672px,calc(100vw-2rem))] !max-w-[672px] flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Keyboard shortcuts</DialogTitle>
        <div className="flex shrink-0 items-center gap-2 px-6 pb-3.5 pr-2.5 pt-4">
          <Keyboard
            className="-ml-1 size-5 shrink-0 text-[#898781]"
            strokeWidth={1.75}
            aria-hidden
          />
          <h2 className="flex-1 text-[15px] font-semibold tracking-[-0.01em] text-[var(--ui-fg)]">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--ui-fg-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--ui-fg)]"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="h-px w-full bg-[rgba(11,11,11,0.1)]" />
        <div
          className="max-h-[min(60vh,520px)] overflow-y-auto px-6 py-4"
          data-keynav-scroll
        >
          {SHORTCUT_CATEGORY_ORDER.map((category, index) => (
            <Section
              key={category}
              title={category}
              first={index === 0}
              rows={rowsByCategory.get(category) ?? []}
            />
          ))}
          {[...rowsByCategory.entries()]
            .filter(([category]) =>
              !(SHORTCUT_CATEGORY_ORDER as readonly string[]).includes(category),
            )
            .map(([category, rows]) => (
              <Section key={category} title={category} rows={rows} />
            ))}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[rgba(11,11,11,0.1)] px-5 py-3">
          <p className="text-[12px] leading-4 text-[#898781]">
            Tip: press{" "}
            <Kbd size="sm">?</Kbd>{" "}
            anywhere to reopen this list.
          </p>
          <div className="cx-shortcut-hint">
            <span className="text-[12px] font-medium leading-4 text-white/92">
              Close
            </span>
            <span className="cx-kbd-combo">
              <Kbd size="sm" tone="dark">
                Esc
              </Kbd>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
