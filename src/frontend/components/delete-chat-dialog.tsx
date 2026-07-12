"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/frontend/lib/utils";

type DeleteChatDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatTitle: string;
  onConfirm: () => void;
  onOpenSettings?: () => void;
};

/**
 * Delete confirmation — matches Clauxen dialog chrome (zinc-50 panel, soft border).
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[#1a1712]/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[81] flex w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[16px] border border-zinc-200 bg-zinc-50 font-sans text-zinc-900 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.08)] outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <header className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4">
            <DialogPrimitive.Title className="text-[17px] font-semibold leading-6 text-zinc-900">
              Delete chat?
            </DialogPrimitive.Title>
          </header>

          <div className="px-5 pb-5 pt-4 text-[14px] leading-5 text-zinc-700">
            <p>
              This will permanently delete{" "}
              <span className="font-semibold text-zinc-900">{displayTitle}</span>.
            </p>
            <p className="mt-2 text-[13px] leading-5 text-zinc-500">
              Visit{" "}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenSettings?.();
                }}
                className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 hover:decoration-zinc-500"
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
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 px-4 text-[13px] font-medium leading-5 text-white transition-colors hover:bg-zinc-800"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-medium leading-5 text-zinc-700 transition-colors hover:bg-zinc-100"
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
