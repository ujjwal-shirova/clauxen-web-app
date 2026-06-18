"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";

type RenameChatDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatTitle: string;
  onConfirm: (nextTitle: string) => void;
};

export function RenameChatDialog({
  open,
  onOpenChange,
  chatTitle,
  onConfirm,
}: RenameChatDialogProps) {
  const [value, setValue] = useState(chatTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(chatTitle.trim() || "New Chat");
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open, chatTitle]);

  const handleSave = () => {
    const next = value.trim();
    if (!next) return;
    onConfirm(next);
    onOpenChange(false);
  };

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
            <DialogPrimitive.Title className="text-[18px] font-medium leading-7 text-zinc-900">
              Rename chat
            </DialogPrimitive.Title>
          </header>

          <div className="flex-1 overflow-auto px-4 pb-4 pt-1">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSave();
                }
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px] text-zinc-900 outline-none ring-0 focus:border-zinc-300"
              aria-label="Chat title"
            />

            <div className="mt-4 flex w-full flex-row-reverse items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 px-3 text-[14px] font-medium leading-5 text-white transition-colors hover:bg-zinc-800"
              >
                Save
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
