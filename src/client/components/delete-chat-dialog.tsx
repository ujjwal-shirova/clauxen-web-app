"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

type DeleteChatDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatTitle: string;
  onConfirm: () => void;
  onOpenSettings?: () => void;
};

/**
 * Delete confirmation — shared app dialog chrome (panel surface, soft border).
 */
export function DeleteChatDialog({
  open,
  onOpenChange,
  chatTitle,
  onConfirm,
  onOpenSettings,
}: DeleteChatDialogProps) {
  const displayTitle = chatTitle.trim() || "this chat";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[var(--overlay-scrim)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "app-dialog-panel fixed left-1/2 top-1/2 z-[81] flex w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden font-sans outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <header className="flex items-center justify-between border-b border-[var(--ui-border-subtle)] px-5 py-4">
            <DialogPrimitive.Title className="text-[17px] font-semibold leading-6 text-[var(--ui-fg)]">
              Delete chat?
            </DialogPrimitive.Title>
          </header>

          <div className="px-5 pb-5 pt-4 text-[14px] leading-5 text-[var(--ui-fg-muted)]">
            <p>
              This will permanently delete{" "}
              <span className="font-semibold text-[var(--ui-fg)]">{displayTitle}</span>.
            </p>
            <p className="mt-2 text-[13px] leading-5 text-[var(--ui-fg-muted)]">
              Visit{" "}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenSettings?.();
                }}
                className="clickable-label cursor-pointer font-medium text-[var(--link)] underline decoration-[var(--link-decoration)] underline-offset-2 transition-colors hover:text-[var(--link-hover)]"
              >
                settings
              </button>{" "}
              to delete any memories saved during this chat.
            </p>

            <div className="mt-5 flex w-full flex-row-reverse items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
                className="app-btn app-btn-primary app-btn-md no-hover-overlay"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="app-btn app-btn-secondary app-btn-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
