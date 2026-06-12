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
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[81] flex w-[min(calc(100vw-2rem),448px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white font-sans text-zinc-900 shadow-[0_8px_12px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.62)] outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <header className="flex min-h-[52px] items-center justify-between px-4 pb-2.5 pt-2.5">
            <h2 className="text-[18px] font-medium leading-7 text-zinc-900">
              Delete chat?
            </h2>
          </header>

          <div className="flex-1 overflow-auto px-4 pb-4 pt-1 text-[16px] leading-6 text-zinc-900">
            <p>
              This will delete{" "}
              <strong className="font-bold">{displayTitle}</strong>.
            </p>
            <p className="mt-2 text-[14px] leading-5 text-[#8f8f8f]">
              Visit{" "}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenSettings?.();
                }}
                className="underline decoration-[#8f8f8f] underline-offset-2 hover:text-zinc-800"
              >
                settings
              </button>{" "}
              to delete any memories saved during this chat.
            </p>

            <div className="mt-4 flex w-full flex-row-reverse items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-[#e02e2a] px-3 text-[14px] font-medium leading-5 text-white transition-colors hover:bg-[#c92824]"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white px-3 text-[14px] font-medium leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03]"
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
