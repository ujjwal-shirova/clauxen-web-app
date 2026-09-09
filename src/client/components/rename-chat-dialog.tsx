"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[var(--overlay-scrim)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "app-dialog-panel fixed left-1/2 top-1/2 z-[81] flex w-[min(calc(100vw-2rem),448px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden font-sans outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <header className="flex min-h-[52px] items-center justify-between px-4 pb-2.5 pt-2.5">
            <DialogPrimitive.Title className="text-[18px] font-medium leading-7 text-[var(--ui-fg)]">
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
              className="app-field px-3 py-2.5 text-[15px]"
              aria-label="Chat title"
            />

            <div className="mt-4 flex w-full flex-row-reverse items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="app-btn app-btn-primary app-btn-md no-hover-overlay"
              >
                Save
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
